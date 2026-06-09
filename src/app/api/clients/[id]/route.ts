import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, email } = await request.json();
  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
  }
  await ensureSchema();
  const db = getDb();
  try {
    await db.execute({ sql: 'UPDATE clients SET name = ?, email = ? WHERE id = ?', args: [name.trim(), email.trim().toLowerCase(), id] });
    const { rows } = await db.execute({ sql: 'SELECT * FROM clients WHERE id = ?', args: [id] });
    if (!rows[0]) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      return NextResponse.json({ error: 'A client with this email already exists' }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureSchema();
  const db = getDb();
  await db.execute({ sql: 'DELETE FROM clients WHERE id = ?', args: [id] });
  return NextResponse.json({ success: true });
}
