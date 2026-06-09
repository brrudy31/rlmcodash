import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name } = await request.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  await ensureSchema();
  const db = getDb();
  await db.execute({ sql: 'UPDATE vendor_lists SET name = ? WHERE id = ?', args: [name.trim(), id] });
  const { rows } = await db.execute({ sql: 'SELECT * FROM vendor_lists WHERE id = ?', args: [id] });
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(rows[0]);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureSchema();
  const db = getDb();
  await db.execute({ sql: 'DELETE FROM vendor_lists WHERE id = ?', args: [id] });
  return NextResponse.json({ success: true });
}
