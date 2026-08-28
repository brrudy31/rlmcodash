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
    sql: `SELECT re.*,
            (SELECT COUNT(*) FROM raffle_entries WHERE event_id = re.id AND excluded = 0) AS entry_count
          FROM raffle_events re WHERE re.user_id = ? ORDER BY re.created_at DESC`,
    args: [userId],
  });
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { name, description } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  await ensureSchema();
  const db = getDb();
  const result = await db.execute({
    sql: 'INSERT INTO raffle_events (user_id, name, description) VALUES (?, ?, ?)',
    args: [userId, name.trim(), description?.trim() || null],
  });
  const { rows } = await db.execute({ sql: 'SELECT * FROM raffle_events WHERE id = ?', args: [Number(result.lastInsertRowid)] });
  return NextResponse.json(rows[0], { status: 201 });
}
