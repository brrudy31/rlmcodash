import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';

export async function GET() {
  await ensureSchema();
  const db = getDb();
  const { rows } = await db.execute('SELECT * FROM open_houses ORDER BY date DESC, created_at DESC');
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { date, address, neighborhood, city, time_of_day, total_attendees, neighbors, represented_buyers, unrepresented_buyers, notes } = body;
  if (!date || !address?.trim() || !city?.trim()) {
    return NextResponse.json({ error: 'Date, address, and city are required' }, { status: 400 });
  }
  await ensureSchema();
  const db = getDb();
  const result = await db.execute({
    sql: `INSERT INTO open_houses (date, address, neighborhood, city, time_of_day, total_attendees, neighbors, represented_buyers, unrepresented_buyers, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [date, address.trim(), neighborhood?.trim() || null, city.trim(), time_of_day || null, Number(total_attendees) || 0, Number(neighbors) || 0, Number(represented_buyers) || 0, Number(unrepresented_buyers) || 0, notes?.trim() || null],
  });
  const { rows } = await db.execute({ sql: 'SELECT * FROM open_houses WHERE id = ?', args: [Number(result.lastInsertRowid)] });
  return NextResponse.json(rows[0], { status: 201 });
}
