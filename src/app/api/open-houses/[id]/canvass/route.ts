import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await ensureSchema();
  const db = getDb();
  const { rows } = await db.execute({
    sql: `SELECT * FROM neighbor_canvass WHERE open_house_id = ? AND user_id = ?`,
    args: [id, userId],
  });
  return NextResponse.json(rows[0] ?? null);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const { total_called, total_answered, total_engaged, notes } = await request.json();
  await ensureSchema();
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO neighbor_canvass (open_house_id, user_id, total_called, total_answered, total_engaged, notes, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(open_house_id) DO UPDATE SET
            total_called = excluded.total_called,
            total_answered = excluded.total_answered,
            total_engaged = excluded.total_engaged,
            notes = excluded.notes,
            updated_at = datetime('now')`,
    args: [id, userId, Number(total_called) || 0, Number(total_answered) || 0, Number(total_engaged) || 0, notes?.trim() || null],
  });
  const { rows } = await db.execute({
    sql: `SELECT * FROM neighbor_canvass WHERE open_house_id = ? AND user_id = ?`,
    args: [id, userId],
  });
  return NextResponse.json(rows[0]);
}
