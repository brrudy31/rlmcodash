import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const { name } = await request.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  await ensureSchema();
  const db = getDb();
  await db.execute({ sql: 'UPDATE vendor_lists SET name = ? WHERE id = ? AND user_id = ?', args: [name.trim(), id, userId] });
  const { rows } = await db.execute({ sql: 'SELECT * FROM vendor_lists WHERE id = ? AND user_id = ?', args: [id, userId] });
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(rows[0]);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await ensureSchema();
  const db = getDb();
  await db.execute({ sql: 'DELETE FROM vendor_lists WHERE id = ? AND user_id = ?', args: [id, userId] });
  return NextResponse.json({ success: true });
}
