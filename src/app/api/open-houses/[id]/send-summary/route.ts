import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';
import { sendEmail } from '@/lib/email';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  // Need at least one email provider configured
  const hasGmail = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
  const hasResend = !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
  if (!hasGmail && !hasResend) {
    return NextResponse.json({ error: 'Email not configured' }, { status: 500 });
  }

  const toEmail = process.env.GMAIL_USER || process.env.SUMMARY_EMAIL_TO || process.env.RESEND_FROM_EMAIL!;

  await ensureSchema();
  const db = getDb();

  const { rows: houseRows } = await db.execute({
    sql: 'SELECT * FROM open_houses WHERE id = ? AND user_id = ?',
    args: [id, userId],
  });

  if (!houseRows[0]) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const house = houseRows[0];

  const { rows: signins } = await db.execute({
    sql: 'SELECT * FROM open_house_signins WHERE open_house_id = ? ORDER BY created_at ASC',
    args: [id],
  });

  try {
    await sendEmail({
      to: toEmail,
      subject: `Open House Summary — ${house.address}${house.end_time ? ` (${formatTime(String(house.end_time))})` : ''}`,
      html: buildSummaryEmail(house, signins),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  await db.execute({
    sql: 'UPDATE open_houses SET summary_sent_at = datetime("now") WHERE id = ?',
    args: [id],
  });

  return NextResponse.json({ sent: true });
}

function formatTime(hhmm: string): string {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSummaryEmail(house: any, signins: any[]): string {
  const representedSignins = signins.filter((s) => s.working_with_agent);
  const unrepresentedSignins = signins.filter((s) => !s.working_with_agent);

  const agentSection = representedSignins.length > 0 ? `
    <h2 style="margin:28px 0 12px;color:#1a1a2e;font-size:16px;border-bottom:2px solid #c9a84c;padding-bottom:6px;">
      Represented Buyers — Agent Info (${representedSignins.length})
    </h2>
    ${representedSignins.map((s) => `
      <div style="background:#fffbf0;border:1px solid #e8d9a0;border-radius:8px;padding:14px 16px;margin-bottom:10px;">
        <p style="margin:0 0 4px;font-weight:700;color:#1a1a2e;font-size:15px;">${esc(s.first_name)} ${esc(s.last_name)}</p>
        <p style="margin:0 0 8px;color:#555;font-size:13px;">${esc(s.phone)} · ${esc(s.email)}</p>
        ${s.agent_name || s.agent_brokerage || s.agent_phone || s.agent_email ? `
          <div style="border-left:3px solid #c9a84c;padding-left:10px;margin-top:8px;">
            <p style="margin:0 0 2px;font-size:12px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:1px;">Their Agent</p>
            ${s.agent_name ? `<p style="margin:2px 0;color:#333;font-size:13px;font-weight:600;">${esc(s.agent_name)}${s.agent_brokerage ? ` · ${esc(s.agent_brokerage)}` : ''}</p>` : ''}
            ${s.agent_phone ? `<p style="margin:2px 0;color:#555;font-size:13px;">${esc(s.agent_phone)}</p>` : ''}
            ${s.agent_email ? `<p style="margin:2px 0;color:#555;font-size:13px;">${esc(s.agent_email)}</p>` : ''}
          </div>` : '<p style="margin:4px 0 0;color:#999;font-size:12px;font-style:italic;">No agent details provided</p>'}
      </div>`).join('')}` : '';

  const unrepresentedSection = unrepresentedSignins.length > 0 ? `
    <h2 style="margin:28px 0 12px;color:#1a1a2e;font-size:16px;border-bottom:2px solid #1e3d70;padding-bottom:6px;">
      Unrepresented Buyers (${unrepresentedSignins.length})
    </h2>
    ${unrepresentedSignins.map((s) => `
      <div style="background:#f8f9fb;border:1px solid #e0e0e0;border-radius:8px;padding:14px 16px;margin-bottom:10px;">
        <p style="margin:0 0 4px;font-weight:700;color:#1a1a2e;font-size:15px;">${esc(s.first_name)} ${esc(s.last_name)}</p>
        <p style="margin:0 0 4px;color:#555;font-size:13px;">${esc(s.phone)} · ${esc(s.email)}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#888;">
          ${s.has_home_to_buy ? '🏠 Looking to buy &nbsp;' : ''}${s.has_home_to_sell ? '📋 Has home to sell &nbsp;' : ''}${s.is_pre_approved ? '✅ Pre-approved' : ''}
        </p>
      </div>`).join('')}` : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:30px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1);">
      <tr>
        <td style="background:linear-gradient(135deg,#0a1628,#162d57);padding:28px 36px;">
          <h1 style="margin:0;color:#c9a84c;font-size:22px;letter-spacing:4px;">RLM&amp;CO</h1>
          <p style="margin:6px 0 0;color:#8ba3c0;font-size:13px;">Open House Summary</p>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 36px;">
          <h2 style="margin:0 0 4px;color:#1a1a2e;font-size:18px;">${esc(String(house.address))}</h2>
          <p style="margin:0 0 20px;color:#888;font-size:13px;">
            ${new Date(String(house.date) + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            ${house.start_time ? ` · ${formatTime(String(house.start_time))}` : ''}
            ${house.end_time ? ` – ${formatTime(String(house.end_time))}` : ''}
          </p>
          <div style="display:flex;gap:16px;margin-bottom:24px;">
            <div style="background:#f0f4ff;border-radius:8px;padding:12px 20px;text-align:center;">
              <p style="margin:0;font-size:24px;font-weight:700;color:#1e3d70;">${signins.length}</p>
              <p style="margin:2px 0 0;font-size:11px;color:#888;text-transform:uppercase;">Total Sign-Ins</p>
            </div>
            <div style="background:#fffbf0;border-radius:8px;padding:12px 20px;text-align:center;">
              <p style="margin:0;font-size:24px;font-weight:700;color:#c9a84c;">${representedSignins.length}</p>
              <p style="margin:2px 0 0;font-size:11px;color:#888;text-transform:uppercase;">Represented</p>
            </div>
            <div style="background:#f0fff4;border-radius:8px;padding:12px 20px;text-align:center;">
              <p style="margin:0;font-size:24px;font-weight:700;color:#2d7a4f;">${unrepresentedSignins.length}</p>
              <p style="margin:2px 0 0;font-size:11px;color:#888;text-transform:uppercase;">Unrepresented</p>
            </div>
          </div>
          ${agentSection}
          ${unrepresentedSection}
          ${signins.length === 0 ? '<p style="color:#888;font-size:13px;text-align:center;margin:20px 0;">No digital sign-ins recorded for this open house.</p>' : ''}
          <p style="margin:28px 0 0;color:#888;font-size:12px;text-align:center;">Sent from your RLM&amp;CO dashboard.</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function esc(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
