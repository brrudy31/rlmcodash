import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, trade, phone, email } = await request.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Vendor name is required' }, { status: 400 });
  }
  await ensureSchema();
  const db = getDb();
  await db.execute({
    sql: 'UPDATE vendors SET name = ?, trade = ?, phone = ?, email = ? WHERE id = ?',
    args: [name.trim(), trade?.trim() || null, phone?.trim() || null, email?.trim() || null, id],
  });
  const { rows } = await db.execute({ sql: 'SELECT * FROM vendors WHERE id = ?', args: [id] });
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(rows[0]);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureSchema();
  const db = getDb();
  await db.execute({ sql: 'DELETE FROM vendors WHERE id = ?', args: [id] });
  return NextResponse.json({ success: true });
}
