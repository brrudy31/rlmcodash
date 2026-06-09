import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const clients = db.prepare('SELECT * FROM clients ORDER BY name ASC').all();
  return NextResponse.json(clients);
}

export async function POST(request: NextRequest) {
  const { name, email } = await request.json();
  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
  }
  const db = getDb();
  try {
    const result = db
      .prepare('INSERT INTO clients (name, email) VALUES (?, ?)')
      .run(name.trim(), email.trim().toLowerCase());
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json(client, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      return NextResponse.json({ error: 'A client with this email already exists' }, { status: 409 });
    }
    throw err;
  }
}
