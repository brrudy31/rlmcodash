import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const { type, data } = payload;
    if (type === 'email.opened' && data?.email_id) {
      await ensureSchema();
      const db = getDb();
      await db.execute({
        sql: 'UPDATE email_sends SET opened_at = datetime("now") WHERE resend_message_id = ? AND opened_at IS NULL',
        args: [data.email_id],
      });
    }
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ received: true });
  }
}
