import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { getDb, ensureSchema } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureSchema();
  const db = getDb();
  const { rows } = await db.execute({
    sql: 'SELECT cold_lead_days FROM user_settings WHERE user_id = ?',
    args: [userId],
  });
  const row = rows[0] as unknown as { cold_lead_days: number } | undefined;
  return NextResponse.json({ cold_lead_days: row?.cold_lead_days ?? 7 });
}

export async function PUT(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { cold_lead_days } = await request.json();
  const days = Math.max(1, Math.min(365, Number(cold_lead_days) || 7));
  await ensureSchema();
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO user_settings (user_id, cold_lead_days) VALUES (?, ?)
          ON CONFLICT(user_id) DO UPDATE SET cold_lead_days = excluded.cold_lead_days, updated_at = datetime('now')`,
    args: [userId, days],
  });
  return NextResponse.json({ cold_lead_days: days });
}
