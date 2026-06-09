import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, trade, phone, email } = await request.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Vendor name is required' }, { status: 400 });
  }
  const db = getDb();
  db.prepare('UPDATE vendors SET name = ?, trade = ?, phone = ?, email = ? WHERE id = ?')
    .run(name.trim(), trade?.trim() || null, phone?.trim() || null, email?.trim() || null, id);
  const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(id);
  if (!vendor) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(vendor);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM vendors WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}
