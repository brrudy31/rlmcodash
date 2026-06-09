import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const lists = db.prepare('SELECT * FROM vendor_lists ORDER BY name ASC').all();
  return NextResponse.json(lists);
}

export async function POST(request: NextRequest) {
  const { name } = await request.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  const db = getDb();
  const result = db.prepare('INSERT INTO vendor_lists (name) VALUES (?)').run(name.trim());
  const list = db.prepare('SELECT * FROM vendor_lists WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json(list, { status: 201 });
}
