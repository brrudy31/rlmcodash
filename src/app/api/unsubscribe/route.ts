import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Invalid unsubscribe link' }, { status: 400 });
  }

  const db = getDb();
  const send = db
    .prepare('SELECT * FROM email_sends WHERE unsubscribe_token = ?')
    .get(token) as { id: number; client_id: number; opted_out_at: string | null } | undefined;

  if (!send) {
    return NextResponse.json({ error: 'Invalid or expired unsubscribe link' }, { status: 404 });
  }

  if (send.opted_out_at) {
    return NextResponse.json({ success: true, message: 'You are already unsubscribed.' });
  }

  const now = new Date().toISOString();

  db.prepare('UPDATE email_sends SET opted_out_at = ? WHERE unsubscribe_token = ?').run(now, token);
  db.prepare('UPDATE clients SET opted_out_at = ? WHERE id = ? AND opted_out_at IS NULL').run(now, send.client_id);

  return NextResponse.json({ success: true, message: 'You have been successfully unsubscribed from all future emails.' });
}
