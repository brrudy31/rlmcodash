import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Invalid unsubscribe link' }, { status: 400 });
  }
  await ensureSchema();
  const db = getDb();
  const { rows } = await db.execute({ sql: 'SELECT * FROM email_sends WHERE unsubscribe_token = ?', args: [token] });
  const send = rows[0] as unknown as { id: number | bigint; client_id: number | bigint; opted_out_at: string | null } | undefined;
  if (!send) {
    return NextResponse.json({ error: 'Invalid or expired unsubscribe link' }, { status: 404 });
  }
  if (send.opted_out_at) {
    return NextResponse.json({ success: true, message: 'You are already unsubscribed.' });
  }
  const now = new Date().toISOString();
  await db.execute({ sql: 'UPDATE email_sends SET opted_out_at = ? WHERE unsubscribe_token = ?', args: [now, token] });
  await db.execute({ sql: 'UPDATE clients SET opted_out_at = ? WHERE id = ? AND opted_out_at IS NULL', args: [now, send.client_id] });
  return NextResponse.json({ success: true, message: 'You have been successfully unsubscribed from all future emails.' });
}
