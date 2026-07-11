import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const { name, email, phone } = await request.json();
  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
  }
  await ensureSchema();
  const db = getDb();
  try {
    await db.execute({ sql: 'UPDATE clients SET name = ?, email = ?, phone = ? WHERE id = ? AND user_id = ?', args: [name.trim(), email.trim().toLowerCase(), phone?.trim() || null, id, userId] });
    const { rows } = await db.execute({ sql: 'SELECT * FROM clients WHERE id = ? AND user_id = ?', args: [id, userId] });
    if (!rows[0]) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      return NextResponse.json({ error: 'A client with this email already exists' }, { status: 409 });
    }
    throw err;
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  await ensureSchema();
  const db = getDb();
  if ('open_house_id' in body) {
    await db.execute({ sql: 'UPDATE clients SET open_house_id = ? WHERE id = ? AND user_id = ?', args: [body.open_house_id ?? null, id, userId] });
  }
  if ('status' in body) {
    await db.execute({ sql: 'UPDATE clients SET status = ? WHERE id = ? AND user_id = ?', args: [body.status || null, id, userId] });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await ensureSchema();
  const db = getDb();
  await db.execute({ sql: 'DELETE FROM clients WHERE id = ? AND user_id = ?', args: [id, userId] });
  return NextResponse.json({ success: true });
}
