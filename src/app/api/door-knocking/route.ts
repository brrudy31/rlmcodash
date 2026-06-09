import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';

export async function GET() {
  await ensureSchema();
  const db = getDb();
  const { rows } = await db.execute('SELECT * FROM door_knocking ORDER BY date DESC, created_at DESC');
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { date, area, total_doors, answered, left_at_door, gave_flyer, gave_my_info, gave_vendor_list, notes } = body;
  if (!date || !area) return NextResponse.json({ error: 'date and area required' }, { status: 400 });
  await ensureSchema();
  const db = getDb();
  const result = await db.execute({
    sql: `INSERT INTO door_knocking (date, area, total_doors, answered, left_at_door, gave_flyer, gave_my_info, gave_vendor_list, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [date, area, total_doors || 0, answered || 0, left_at_door || 0, gave_flyer || 0, gave_my_info || 0, gave_vendor_list || 0, notes || null],
  });
  const { rows } = await db.execute({ sql: 'SELECT * FROM door_knocking WHERE id = ?', args: [Number(result.lastInsertRowid)] });
  return NextResponse.json(rows[0], { status: 201 });
}
