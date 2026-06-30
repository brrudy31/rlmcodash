import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureSchema();
  const db = getDb();
  const { rows } = await db.execute({
    sql: 'SELECT crm_type, api_key, location_id FROM user_crm_settings WHERE user_id = ?',
    args: [userId],
  });
  if (!rows[0]) {
    return NextResponse.json({ crm_type: 'none', api_key: null, location_id: null });
  }
  return NextResponse.json(rows[0]);
}

export async function PUT(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { crm_type, api_key, location_id } = await request.json();
  if (!crm_type) return NextResponse.json({ error: 'crm_type is required' }, { status: 400 });
  await ensureSchema();
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO user_crm_settings (user_id, crm_type, api_key, location_id, updated_at)
          VALUES (?, ?, ?, ?, datetime('now'))
          ON CONFLICT(user_id) DO UPDATE SET
            crm_type = excluded.crm_type,
            api_key = excluded.api_key,
            location_id = excluded.location_id,
            updated_at = excluded.updated_at`,
    args: [userId, crm_type, api_key?.trim() || null, location_id?.trim() || null],
  });
  return NextResponse.json({ success: true });
}
