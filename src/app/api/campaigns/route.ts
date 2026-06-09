import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();

  const campaigns = db.prepare(`
    SELECT
      ec.*,
      COUNT(es.id) as total_sent,
      SUM(CASE WHEN es.opened_at IS NOT NULL THEN 1 ELSE 0 END) as total_opened,
      SUM(CASE WHEN es.opted_out_at IS NOT NULL THEN 1 ELSE 0 END) as total_opted_out
    FROM email_campaigns ec
    LEFT JOIN email_sends es ON es.campaign_id = ec.id
    GROUP BY ec.id
    ORDER BY ec.sent_at DESC
  `).all();

  return NextResponse.json(campaigns);
}
