import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name } = await request.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  const db = getDb();
  db.prepare('UPDATE vendor_lists SET name = ? WHERE id = ?').run(name.trim(), id);
  const list = db.prepare('SELECT * FROM vendor_lists WHERE id = ?').get(id);
  if (!list) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(list);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM vendor_lists WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}
