import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Resend webhook handler for open tracking
// Configure this endpoint URL in your Resend dashboard under Webhooks
// Event: email.opened
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const { type, data } = payload;

    if (type === 'email.opened' && data?.email_id) {
      const db = getDb();
      db.prepare('UPDATE email_sends SET opened_at = datetime("now") WHERE resend_message_id = ? AND opened_at IS NULL')
        .run(data.email_id);
    }

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ received: true });
  }
}
