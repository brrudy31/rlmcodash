import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureSchema();
  const db = getDb();
  const { rows } = await db.execute({ sql: 'SELECT * FROM vendors WHERE vendor_list_id = ? ORDER BY name ASC', args: [id] });
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, trade, phone, email } = await request.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Vendor name is required' }, { status: 400 });
  }
  await ensureSchema();
  const db = getDb();
  const result = await db.execute({
    sql: 'INSERT INTO vendors (vendor_list_id, name, trade, phone, email) VALUES (?, ?, ?, ?, ?)',
    args: [id, name.trim(), trade?.trim() || null, phone?.trim() || null, email?.trim() || null],
  });
  const { rows } = await db.execute({ sql: 'SELECT * FROM vendors WHERE id = ?', args: [Number(result.lastInsertRowid)] });
  return NextResponse.json(rows[0], { status: 201 });
}
