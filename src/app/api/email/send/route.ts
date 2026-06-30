import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import crypto from 'crypto';
import { getDb, ensureSchema } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';
import type { Vendor, Client } from '@/lib/db';

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { vendorListId, clientIds, subject, message } = await request.json();

  if (!vendorListId || !clientIds?.length || !subject?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!resendKey || !fromEmail) {
    return NextResponse.json({ error: 'Email not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL in .env' }, { status: 500 });
  }

  await ensureSchema();
  const db = getDb();

  const { rows: vlRows } = await db.execute({ sql: 'SELECT * FROM vendor_lists WHERE id = ? AND user_id = ?', args: [vendorListId, userId] });
  const vendorList = vlRows[0] as unknown as { id: number | bigint; name: string } | undefined;
  if (!vendorList) {
    return NextResponse.json({ error: 'Vendor list not found' }, { status: 404 });
  }

  const { rows: vendorRows } = await db.execute({ sql: 'SELECT * FROM vendors WHERE vendor_list_id = ? ORDER BY name ASC', args: [vendorListId] });
  const vendors = vendorRows as unknown as Vendor[];

  const placeholders = clientIds.map(() => '?').join(',');
  const { rows: clientRows } = await db.execute({
    sql: `SELECT * FROM clients WHERE id IN (${placeholders}) AND opted_out_at IS NULL`,
    args: clientIds,
  });
  const clients = clientRows as unknown as Client[];

  if (!clients.length) {
    return NextResponse.json({ error: 'No eligible clients (all may have opted out)' }, { status: 400 });
  }

  const campaignResult = await db.execute({
    sql: 'INSERT INTO email_campaigns (vendor_list_id, vendor_list_name, subject, message, user_id) VALUES (?, ?, ?, ?, ?)',
    args: [vendorListId, vendorList.name, subject.trim(), message?.trim() || null, userId],
  });
  const campaignId = Number(campaignResult.lastInsertRowid);

  const resend = new Resend(resendKey);
  const results = [];

  for (const client of clients) {
    const token = crypto.randomBytes(32).toString('hex');
    const sendResult = await db.execute({
      sql: 'INSERT INTO email_sends (campaign_id, client_id, client_name, client_email, unsubscribe_token) VALUES (?, ?, ?, ?, ?)',
      args: [campaignId, client.id, client.name, client.email, token],
    });
    const sendId = Number(sendResult.lastInsertRowid);
    const unsubscribeUrl = `${appUrl}/unsubscribe?token=${token}`;
    const html = buildEmailHtml(client.name, vendorList.name, vendors, message, unsubscribeUrl);

    try {
      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: client.email,
        subject: subject.trim(),
        html,
      });
      if (error) {
        results.push({ clientEmail: client.email, success: false, error: error.message });
      } else {
        await db.execute({ sql: 'UPDATE email_sends SET resend_message_id = ? WHERE id = ?', args: [data?.id || null, sendId] });
        results.push({ clientEmail: client.email, success: true });
      }
    } catch (err) {
      results.push({ clientEmail: client.email, success: false, error: String(err) });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  return NextResponse.json({ success: true, sent: successCount, total: clients.length, results });
}

function buildEmailHtml(clientName: string, listName: string, vendors: Vendor[], customMessage: string | null, unsubscribeUrl: string): string {
  const vendorRows = vendors.map((v) => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #e8e8e8;font-weight:500;color:#000000;">${escHtml(v.name)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e8e8e8;color:#444;">${escHtml(v.trade || '—')}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e8e8e8;color:#444;">${escHtml(v.phone || '—')}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e8e8e8;color:#444;">${v.email ? `<a href="mailto:${escHtml(v.email)}" style="color:#111111;">${escHtml(v.email)}</a>` : '—'}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:30px 0;">
  <tr><td align="center">
    <table width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1);">
      <tr>
        <td style="background:#000000;padding:36px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:28px;letter-spacing:6px;font-weight:700;">RLM&amp;CO</h1>
          <p style="margin:8px 0 0;color:#aaaaaa;font-size:13px;letter-spacing:1px;">VENDOR RESOURCE LIST</p>
        </td>
      </tr>
      <tr>
        <td style="padding:36px 40px;">
          <p style="margin:0 0 8px;color:#555;font-size:14px;">Dear ${escHtml(clientName)},</p>
          ${customMessage ? `<p style="margin:16px 0;color:#333;font-size:15px;line-height:1.6;">${escHtml(customMessage).replace(/\n/g, '<br>')}</p>` : ''}
          <p style="margin:16px 0;color:#333;font-size:15px;line-height:1.6;">
            Please find below our curated <strong>${escHtml(listName)}</strong> vendor list.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:6px;overflow:hidden;margin-top:24px;border:1px solid #e0e0e0;">
            <thead>
              <tr style="background:#0a1628;">
                <th style="padding:12px 14px;text-align:left;color:#ffffff;font-size:12px;letter-spacing:1px;">NAME</th>
                <th style="padding:12px 14px;text-align:left;color:#ffffff;font-size:12px;letter-spacing:1px;">TRADE</th>
                <th style="padding:12px 14px;text-align:left;color:#ffffff;font-size:12px;letter-spacing:1px;">PHONE</th>
                <th style="padding:12px 14px;text-align:left;color:#ffffff;font-size:12px;letter-spacing:1px;">EMAIL</th>
              </tr>
            </thead>
            <tbody>${vendorRows}</tbody>
          </table>
          <p style="margin:28px 0 0;color:#555;font-size:14px;line-height:1.6;">Please don't hesitate to reach out if you have any questions.</p>
          <p style="margin:8px 0 0;color:#555;font-size:14px;">Warm regards,<br><strong>RLM&amp;CO</strong></p>
        </td>
      </tr>
      <tr>
        <td style="background:#f8f9fb;border-top:1px solid #e8e8e8;padding:20px 40px;text-align:center;">
          <p style="margin:0;color:#999;font-size:12px;">
            You received this email because you are on our client list.<br>
            To unsubscribe, <a href="${unsubscribeUrl}" style="color:#111111;">click here</a>.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}