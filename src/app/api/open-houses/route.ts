import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const houses = db.prepare('SELECT * FROM open_houses ORDER BY date DESC, created_at DESC').all();
  return NextResponse.json(houses);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    date, address, neighborhood, city, time_of_day,
    total_attendees, neighbors, represented_buyers, unrepresented_buyers, notes,
  } = body;

  if (!date || !address?.trim() || !city?.trim()) {
    return NextResponse.json({ error: 'Date, address, and city are required' }, { status: 400 });
  }

  const db = getDb();
  const result = db.prepare(`
    INSERT INTO open_houses
      (date, address, neighborhood, city, time_of_day, total_attendees, neighbors, represented_buyers, unrepresented_buyers, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    date,
    address.trim(),
    neighborhood?.trim() || null,
    city.trim(),
    time_of_day || null,
    Number(total_attendees) || 0,
    Number(neighbors) || 0,
    Number(represented_buyers) || 0,
    Number(unrepresented_buyers) || 0,
    notes?.trim() || null,
  );

  const house = db.prepare('SELECT * FROM open_houses WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json(house, { status: 201 });
}
