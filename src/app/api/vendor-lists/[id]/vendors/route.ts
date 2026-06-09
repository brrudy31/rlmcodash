import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const vendors = db
    .prepare('SELECT * FROM vendors WHERE vendor_list_id = ? ORDER BY name ASC')
    .all(id);
  return NextResponse.json(vendors);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, trade, phone, email } = await request.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Vendor name is required' }, { status: 400 });
  }
  const db = getDb();
  const result = db
    .prepare('INSERT INTO vendors (vendor_list_id, name, trade, phone, email) VALUES (?, ?, ?, ?, ?)')
    .run(id, name.trim(), trade?.trim() || null, phone?.trim() || null, email?.trim() || null);
  const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json(vendor, { status: 201 });
}
