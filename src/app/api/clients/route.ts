import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';

export async function GET() {
  await ensureSchema();
  const db = getDb();
  const { rows } = await db.execute('SELECT * FROM clients ORDER BY name ASC');
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const { name, email } = await request.json();
  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
  }
  await ensureSchema();
  const db = getDb();
  try {
    const result = await db.execute({
      sql: 'INSERT INTO clients (name, email) VALUES (?, ?)',
      args: [name.trim(), email.trim().toLowerCase()],
    });
    const { rows } = await db.execute({ sql: 'SELECT * FROM clients WHERE id = ?', args: [Number(result.lastInsertRowid)] });
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      return NextResponse.json({ error: 'A client with this email already exists' }, { status: 409 });
    }
    throw err;
  }
}
