import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';

export async function GET() {
  await ensureSchema();
  const db = getDb();
  const { rows } = await db.execute('SELECT * FROM vendor_lists ORDER BY name ASC');
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const { name } = await request.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  await ensureSchema();
  const db = getDb();
  const result = await db.execute({ sql: 'INSERT INTO vendor_lists (name) VALUES (?)', args: [name.trim()] });
  const { rows } = await db.execute({ sql: 'SELECT * FROM vendor_lists WHERE id = ?', args: [Number(result.lastInsertRowid)] });
  return NextResponse.json(rows[0], { status: 201 });
}
