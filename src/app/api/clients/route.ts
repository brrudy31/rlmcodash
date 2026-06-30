import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureSchema();
  const db = getDb();
  const { rows } = await db.execute({ sql: 'SELECT * FROM clients WHERE user_id = ? ORDER BY name ASC', args: [userId] });
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { name, email, phone } = await request.json();
  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
  }
  await ensureSchema();
  const db = getDb();
  try {
    const result = await db.execute({
      sql: 'INSERT INTO clients (name, email, phone, user_id) VALUES (?, ?, ?, ?)',
      args: [name.trim(), email.trim().toLowerCase(), phone?.trim() || null, userId],
    });
    const { rows } = await db.execute({ sql: 'SELECT * FROM clients WHERE id = ?', args: [Number(result.lastInsertRowid)] });
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      return NextResponse.json({ error: 'A contact with this email already exists' }, { status: 409 });
    }
    throw err;
  }
}
