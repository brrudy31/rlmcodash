import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getDb, ensureSchema } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureSchema();
  const db = getDb();
  const resend = new Resend(process.env.RESEND_API_KEY);

  const today = new Date().toISOString().split('T')[0];
  const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const displayDate = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const { rows: users } = await db.execute({ sql: `SELECT id, email, name FROM users`, args: [] });
  const results = [];

  for (const userRow of users) {
    const user = userRow as any;
    const userId = user.id;

    // ── Checklist items for today ─────────────────────────────────────────────
    const { rows: allItems } = await db.execute({
      sql: `SELECT ci.*, cc.id as completion_id
            FROM checklist_items ci
            LEFT JOIN checklist_completions cc
              ON cc.checklist_item_id = ci.id AND cc.user_id = ? AND cc.date = ?
            WHERE ci.user_id = ? AND ci.active = 1`,
      args: [userId, today, userId],
    });

    // Has open house today?
    const { rows: todayOH } = await db.execute({
      sql: `SELECT id FROM open_houses WHERE user_id = ? AND date = ?`,
      args: [userId, today],
    });
    const hasOpenHouseToday = todayOH.length > 0;

    const isMonday = dayOfWeek === 'Monday';

    const todayItems = (allItems as any[]).filter((item) => {
      if (item.category === 'open_house_day' && !hasOpenHouseToday) return false;
      if (item.frequency === 'weekly' && !isMonday) return false;
      return true;
    });

    const pendingItems = todayItems.filter((i) => !i.completion_id);
    const doneItems = todayItems.filter((i) => i.completion_id);

    // ── Contacts needing follow-up ────────────────────────────────────────────
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const { rows: followUps } = await db.execute({
      sql: `SELECT name, phone, lead_stars, last_contacted_at, contact_count
            FROM clients
            WHERE user_id = ?
              AND status != 'lost' AND (status IS NULL OR status != 'lost')
              AND lead_stars >= 2
              AND (last_contacted_at IS NULL OR last_contacted_at < ?)
            ORDER BY lead_stars DESC, last_contacted_at ASC
            LIMIT 10`,
      args: [userId, sevenDaysAgo + 'T00:00:00'],
    });

    // ── Contacts with no contact at all ──────────────────────────────────────
    const { rows: neverContacted } = await db.execute({
      sql: `SELECT name, phone, lead_stars
            FROM clients
            WHERE user_id = ?
              AND (status IS NULL OR status != 'lost')
              AND lead_stars >= 3
              AND contact_count = 0
            ORDER BY lead_stars DESC
            LIMIT 5`,
      args: [userId],
    });

    if (pendingItems.length === 0 && followUps.length === 0 && neverContacted.length === 0) continue;

    const starStr = (n: number | null) => n !== null ? '★'.repeat(n) + '☆'.repeat(5 - n) : '—';

    const checklistHtml = pendingItems.length > 0 ? `
      <h2 style="font-size:16px;font-weight:700;color:#0c2749;margin:24px 0 12px;">
        📋 Today's Checklist (${doneItems.length}/${todayItems.length} done)
      </h2>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${pendingItems.map((item) => `
          <tr>
            <td style="padding:6px 0;border-bottom:1px solid #f0f0f0;">
              <span style="color:#aaa;margin-right:8px;">☐</span>
              <span style="color:#333;font-size:14px;">${item.label}</span>
              ${item.description ? `<div style="color:#888;font-size:12px;margin-left:22px;">${item.description}</div>` : ''}
            </td>
          </tr>
        `).join('')}
      </table>
    ` : `
      <h2 style="font-size:16px;font-weight:700;color:#0c2749;margin:24px 0 12px;">📋 Checklist</h2>
      <p style="color:#22c55e;font-weight:600;">✅ All ${todayItems.length} tasks complete for today!</p>
    `;

    const followUpHtml = followUps.length > 0 ? `
      <h2 style="font-size:16px;font-weight:700;color:#0c2749;margin:24px 0 12px;">
        📞 Follow-Up Needed (${followUps.length} contacts)
      </h2>
      <p style="font-size:12px;color:#888;margin-bottom:10px;">These leads haven't been contacted in 7+ days</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${(followUps as any[]).map((c) => {
          const lastContact = c.last_contacted_at
            ? Math.floor((Date.now() - new Date(c.last_contacted_at).getTime()) / 86400000) + 'd ago'
            : 'Never contacted';
          return `
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;">
              <div style="font-weight:600;color:#333;font-size:14px;">${c.name}</div>
              <div style="font-size:12px;color:#888;">
                ${c.phone || 'No phone'} &nbsp;·&nbsp;
                ${starStr(c.lead_stars)} &nbsp;·&nbsp;
                Last contact: ${lastContact}
              </div>
            </td>
          </tr>`;
        }).join('')}
      </table>
    ` : '';

    const neverHtml = neverContacted.length > 0 ? `
      <h2 style="font-size:16px;font-weight:700;color:#0c2749;margin:24px 0 12px;">
        🆕 Never Been Contacted (${neverContacted.length} leads)
      </h2>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${(neverContacted as any[]).map((c) => `
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;">
              <div style="font-weight:600;color:#333;font-size:14px;">${c.name}</div>
              <div style="font-size:12px;color:#888;">${c.phone || 'No phone'} &nbsp;·&nbsp; ${starStr(c.lead_stars)}</div>
            </td>
          </tr>
        `).join('')}
      </table>
    ` : '';

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
        <!-- Header -->
        <tr><td style="background:#0c2749;padding:24px 28px;">
          <p style="margin:0;color:#c5a84b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">RLM&CO Dashboard</p>
          <h1 style="margin:4px 0 0;color:#fff;font-size:22px;font-weight:800;">Good morning, ${user.name?.split(' ')[0] || 'Ben'} 👋</h1>
          <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">${displayDate}</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:20px 28px 32px;">
          ${checklistHtml}
          ${followUpHtml}
          ${neverHtml}
          <div style="margin-top:28px;text-align:center;">
            <a href="https://rlmcodash.vercel.app/dashboard"
               style="display:inline-block;background:#c5a84b;color:#0c2749;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;">
              Open Dashboard →
            </a>
          </div>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f8f8f8;padding:14px 28px;border-top:1px solid #eee;">
          <p style="margin:0;color:#aaa;font-size:11px;text-align:center;">RLM&CO Dashboard · Daily reminder</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    try {
      await resend.emails.send({
        from: 'RLM&CO Dashboard <onboarding@resend.dev>',
        to: user.email as string,
        subject: `${pendingItems.length > 0 ? `📋 ${pendingItems.length} tasks` : '✅ All done'}${followUps.length > 0 ? ` · 📞 ${followUps.length} follow-ups` : ''} — ${displayDate}`,
        html,
      });
      results.push({ user: user.email, sent: true });
    } catch (err) {
      results.push({ user: user.email, sent: false, error: String(err) });
    }
  }

  return NextResponse.json({ ok: true, results });
}
