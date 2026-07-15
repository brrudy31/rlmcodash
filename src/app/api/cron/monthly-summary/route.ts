import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getDb, ensureSchema } from '@/lib/db';

export const runtime = 'nodejs';

// Vercel cron calls this with GET; protect with CRON_SECRET
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureSchema();
  const db = getDb();

  // Prior month in YYYY-MM format
  const now = new Date();
  const priorMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthStr = `${priorMonth.getFullYear()}-${String(priorMonth.getMonth() + 1).padStart(2, '0')}`;
  const monthStart = `${monthStr}-01`;
  const nextMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  // Get all users with email configured
  const { rows: users } = await db.execute({ sql: `SELECT id, email, name FROM users`, args: [] });

  const results = [];
  for (const userRow of users) {
    const user = userRow as any;
    const userId = user.id;

    // Open houses this month
    const { rows: ohRows } = await db.execute({
      sql: `SELECT oh.*, (SELECT COUNT(*) FROM open_house_signins WHERE open_house_id = oh.id) as signin_count
            FROM open_houses oh WHERE oh.user_id = ? AND oh.date >= ? AND oh.date < ?`,
      args: [userId, monthStart, nextMonthStart],
    });

    // All sign-ins for those open houses
    const ohIds = (ohRows as any[]).map((h) => h.id);
    let signins: any[] = [];
    let sourceBreakdown: Record<string, number> = {};
    if (ohIds.length > 0) {
      const placeholders = ohIds.map(() => '?').join(',');
      const { rows: siRows } = await db.execute({
        sql: `SELECT * FROM open_house_signins WHERE open_house_id IN (${placeholders})`,
        args: ohIds,
      });
      signins = siRows as any[];
      for (const s of signins) {
        const src = s.lead_source || 'Unknown';
        sourceBreakdown[src] = (sourceBreakdown[src] || 0) + 1;
      }
    }

    // Neighbor canvass totals
    let canvassTotals = { called: 0, answered: 0, engaged: 0 };
    if (ohIds.length > 0) {
      const placeholders = ohIds.map(() => '?').join(',');
      const { rows: canvassRows } = await db.execute({
        sql: `SELECT SUM(total_called) as called, SUM(total_answered) as answered, SUM(total_engaged) as engaged
              FROM neighbor_canvass WHERE open_house_id IN (${placeholders})`,
        args: ohIds,
      });
      const cv = (canvassRows[0] as any) ?? {};
      canvassTotals = { called: Number(cv.called || 0), answered: Number(cv.answered || 0), engaged: Number(cv.engaged || 0) };
    }

    // New contacts this month by source
    const { rows: newContacts } = await db.execute({
      sql: `SELECT source, COUNT(*) as n FROM clients WHERE user_id = ? AND created_at >= ? AND created_at < ? GROUP BY source`,
      args: [userId, monthStart + 'T00:00:00', nextMonthStart + 'T00:00:00'],
    });

    // Contact log stats: response rate
    const { rows: logStats } = await db.execute({
      sql: `SELECT COUNT(*) as total, SUM(CASE WHEN outcome = 'responded' THEN 1 ELSE 0 END) as responded
            FROM contact_log WHERE user_id = ? AND logged_at >= ? AND logged_at < ?`,
      args: [userId, monthStart + 'T00:00:00', nextMonthStart + 'T00:00:00'],
    });
    const ls = (logStats[0] as any) ?? {};
    const totalAttempts = Number(ls.total || 0);
    const responded = Number(ls.responded || 0);

    // Cold leads this month (3+ attempts, no response)
    const { rows: coldLeadRows } = await db.execute({
      sql: `SELECT COUNT(DISTINCT client_id) as n FROM (
              SELECT client_id, COUNT(*) as attempts,
                     SUM(CASE WHEN outcome = 'responded' THEN 1 ELSE 0 END) as resp
              FROM contact_log WHERE user_id = ? GROUP BY client_id
              HAVING attempts >= 3 AND resp = 0
            )`,
      args: [userId],
    });
    const coldLeads = Number((coldLeadRows[0] as any)?.n ?? 0);

    // Homes shown (sum of homes_shown_count from contacts touched this month)
    const { rows: homesRows } = await db.execute({
      sql: `SELECT SUM(homes_shown_count) as n FROM clients WHERE user_id = ? AND last_contacted_at >= ? AND last_contacted_at < ?`,
      args: [userId, monthStart + 'T00:00:00', nextMonthStart + 'T00:00:00'],
    });
    const homesShown = Number((homesRows[0] as any)?.n ?? 0);

    const summary = {
      month: monthStr,
      openHousesHosted: ohRows.length,
      totalSignIns: signins.length,
      signInsBySource: sourceBreakdown,
      canvass: canvassTotals,
      newContacts: Object.fromEntries((newContacts as any[]).map((r) => [r.source || 'Unknown', Number(r.n)])),
      totalContactAttempts: totalAttempts,
      responded,
      responseRate: totalAttempts > 0 ? Math.round((responded / totalAttempts) * 100) : 0,
      homesShown,
      coldLeads,
    };

    // Save to DB
    await db.execute({
      sql: `INSERT INTO monthly_summaries (user_id, month, data_json) VALUES (?, ?, ?)
            ON CONFLICT(user_id, month) DO UPDATE SET data_json = excluded.data_json`,
      args: [userId, monthStr, JSON.stringify(summary)],
    });

    // Send email via Resend
    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;
    const toEmail = process.env.SUMMARY_EMAIL_TO || user.email;

    if (resendKey && fromEmail && toEmail) {
      const resend = new Resend(resendKey);
      const monthLabel = priorMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      await resend.emails.send({
        from: fromEmail,
        to: toEmail,
        subject: `Monthly Business Summary — ${monthLabel}`,
        html: buildMonthlySummaryEmail(user.name, monthLabel, summary),
      });
      await db.execute({
        sql: `UPDATE monthly_summaries SET email_sent_at = datetime('now') WHERE user_id = ? AND month = ?`,
        args: [userId, monthStr],
      });
    }

    results.push({ userId, month: monthStr, sent: !!(resendKey && fromEmail) });
  }

  return NextResponse.json({ ok: true, processed: results });
}

function esc(s: string) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildMonthlySummaryEmail(agentName: string, monthLabel: string, s: any): string {
  const sourceRows = Object.entries(s.signInsBySource as Record<string, number>)
    .sort(([, a], [, b]) => b - a)
    .map(([src, n]) => `<tr><td style="padding:6px 12px;color:#555;font-size:13px;">${esc(src)}</td><td style="padding:6px 12px;font-weight:700;color:#1a1a2e;font-size:13px;text-align:right;">${n}</td></tr>`)
    .join('');

  const contactSourceRows = Object.entries(s.newContacts as Record<string, number>)
    .map(([src, n]) => `<tr><td style="padding:6px 12px;color:#555;font-size:13px;">${esc(src || 'Unknown')}</td><td style="padding:6px 12px;font-weight:700;color:#1a1a2e;font-size:13px;text-align:right;">${n}</td></tr>`)
    .join('');

  const engageRate = s.canvass.answered > 0 ? Math.round((s.canvass.engaged / s.canvass.answered) * 100) : 0;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:30px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1);">
  <tr>
    <td style="background:linear-gradient(135deg,#0a1628,#162d57);padding:28px 36px;">
      <h1 style="margin:0;color:#c9a84c;font-size:22px;letter-spacing:4px;">RLM&amp;CO</h1>
      <p style="margin:6px 0 0;color:#8ba3c0;font-size:13px;">Monthly Business Summary</p>
    </td>
  </tr>
  <tr><td style="padding:28px 36px;">
    <h2 style="margin:0 0 4px;color:#1a1a2e;font-size:20px;">${esc(monthLabel)}</h2>
    <p style="margin:0 0 24px;color:#888;font-size:13px;">Hey ${esc(agentName)} — here's how your month looked.</p>

    <!-- Open Houses -->
    <h3 style="margin:0 0 12px;color:#1a1a2e;font-size:15px;border-bottom:2px solid #c9a84c;padding-bottom:6px;">🏠 Open Houses</h3>
    <table width="100%" style="border-collapse:collapse;margin-bottom:20px;">
      <tr><td style="padding:6px 12px;color:#555;font-size:13px;">Open houses hosted</td><td style="padding:6px 12px;font-weight:700;color:#1a1a2e;font-size:13px;text-align:right;">${s.openHousesHosted}</td></tr>
      <tr style="background:#f8f9fb;"><td style="padding:6px 12px;color:#555;font-size:13px;">Total sign-ins</td><td style="padding:6px 12px;font-weight:700;color:#1a1a2e;font-size:13px;text-align:right;">${s.totalSignIns}</td></tr>
    </table>

    ${sourceRows ? `
    <h3 style="margin:0 0 12px;color:#1a1a2e;font-size:15px;border-bottom:2px solid #1e3d70;padding-bottom:6px;">📍 Sign-Ins by Source</h3>
    <table width="100%" style="border-collapse:collapse;margin-bottom:20px;">${sourceRows}</table>` : ''}

    <!-- Neighbor Canvassing -->
    <h3 style="margin:0 0 12px;color:#1a1a2e;font-size:15px;border-bottom:2px solid #2d7a4f;padding-bottom:6px;">🚪 Neighbor Canvassing</h3>
    <table width="100%" style="border-collapse:collapse;margin-bottom:20px;">
      <tr><td style="padding:6px 12px;color:#555;font-size:13px;">Total called</td><td style="padding:6px 12px;font-weight:700;color:#1a1a2e;font-size:13px;text-align:right;">${s.canvass.called}</td></tr>
      <tr style="background:#f8f9fb;"><td style="padding:6px 12px;color:#555;font-size:13px;">Answered</td><td style="padding:6px 12px;font-weight:700;color:#1a1a2e;font-size:13px;text-align:right;">${s.canvass.answered}</td></tr>
      <tr><td style="padding:6px 12px;color:#555;font-size:13px;">Engaged</td><td style="padding:6px 12px;font-weight:700;color:#2d7a4f;font-size:13px;text-align:right;">${s.canvass.engaged}</td></tr>
      <tr style="background:#f8f9fb;"><td style="padding:6px 12px;color:#555;font-size:13px;">Engagement rate</td><td style="padding:6px 12px;font-weight:700;color:#1a1a2e;font-size:13px;text-align:right;">${engageRate}%</td></tr>
    </table>

    <!-- New Leads -->
    <h3 style="margin:0 0 12px;color:#1a1a2e;font-size:15px;border-bottom:2px solid #c9a84c;padding-bottom:6px;">👥 New Contacts This Month</h3>
    <table width="100%" style="border-collapse:collapse;margin-bottom:20px;">${contactSourceRows || '<tr><td style="padding:6px 12px;color:#999;font-size:13px;">No new contacts</td></tr>'}</table>

    <!-- Follow-Up Stats -->
    <h3 style="margin:0 0 12px;color:#1a1a2e;font-size:15px;border-bottom:2px solid #1e3d70;padding-bottom:6px;">📞 Follow-Up Activity</h3>
    <table width="100%" style="border-collapse:collapse;margin-bottom:20px;">
      <tr><td style="padding:6px 12px;color:#555;font-size:13px;">Contact attempts</td><td style="padding:6px 12px;font-weight:700;color:#1a1a2e;font-size:13px;text-align:right;">${s.totalContactAttempts}</td></tr>
      <tr style="background:#f8f9fb;"><td style="padding:6px 12px;color:#555;font-size:13px;">Responses received</td><td style="padding:6px 12px;font-weight:700;color:#2d7a4f;font-size:13px;text-align:right;">${s.responded}</td></tr>
      <tr><td style="padding:6px 12px;color:#555;font-size:13px;">Response rate</td><td style="padding:6px 12px;font-weight:700;color:#1a1a2e;font-size:13px;text-align:right;">${s.responseRate}%</td></tr>
      <tr style="background:#f8f9fb;"><td style="padding:6px 12px;color:#555;font-size:13px;">Homes shown</td><td style="padding:6px 12px;font-weight:700;color:#1a1a2e;font-size:13px;text-align:right;">${s.homesShown}</td></tr>
      <tr><td style="padding:6px 12px;color:#555;font-size:13px;">Leads gone cold (3+ attempts, no reply)</td><td style="padding:6px 12px;font-weight:700;color:#c0392b;font-size:13px;text-align:right;">${s.coldLeads}</td></tr>
    </table>

    <p style="margin:28px 0 0;color:#888;font-size:12px;text-align:center;">Sent automatically from your RLM&amp;CO dashboard.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}
