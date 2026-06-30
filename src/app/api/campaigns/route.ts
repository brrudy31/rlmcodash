import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureSchema();
  const db = getDb();
  const { rows } = await db.execute({
    sql: `SELECT
      ec.*,
      COUNT(es.id) as total_sent,
      SUM(CASE WHEN es.opened_at IS NOT NULL THEN 1 ELSE 0 END) as total_opened,
      SUM(CASE WHEN es.opted_out_at IS NOT NULL THEN 1 ELSE 0 END) as total_opted_out
    FROM email_campaigns ec
    LEFT JOIN email_sends es ON es.campaign_id = ec.id
    WHERE ec.user_id = ?
    GROUP BY ec.id
    ORDER BY ec.sent_at DESC`,
    args: [userId],
  });
  return NextResponse.json(rows);
}
