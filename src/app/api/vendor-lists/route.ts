import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureSchema();
  const db = getDb();
  const { rows } = await db.execute({ sql: 'SELECT * FROM vendor_lists WHERE user_id = ? ORDER BY name ASC', args: [userId] });
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { name } = await request.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  await ensureSchema();
  const db = getDb();
  const result = await db.execute({ sql: 'INSERT INTO vendor_lists (name, user_id) VALUES (?, ?)', args: [name.trim(), userId] });
  const { rows } = await db.execute({ sql: 'SELECT * FROM vendor_lists WHERE id = ?', args: [Number(result.lastInsertRowid)] });
  return NextResponse.json(rows[0], { status: 201 });
}
