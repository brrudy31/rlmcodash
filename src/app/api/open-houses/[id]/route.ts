import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { date, address, neighborhood, city, time_of_day, total_attendees, neighbors, represented_buyers, unrepresented_buyers, notes } = body;
  if (!date || !address?.trim() || !city?.trim()) {
    return NextResponse.json({ error: 'Date, address, and city are required' }, { status: 400 });
  }
  await ensureSchema();
  const db = getDb();
  await db.execute({
    sql: `UPDATE open_houses SET date = ?, address = ?, neighborhood = ?, city = ?, time_of_day = ?,
          total_attendees = ?, neighbors = ?, represented_buyers = ?, unrepresented_buyers = ?, notes = ?
          WHERE id = ?`,
    args: [date, address.trim(), neighborhood?.trim() || null, city.trim(), time_of_day || null, Number(total_attendees) || 0, Number(neighbors) || 0, Number(represented_buyers) || 0, Number(unrepresented_buyers) || 0, notes?.trim() || null, id],
  });
  const { rows } = await db.execute({ sql: 'SELECT * FROM open_houses WHERE id = ?', args: [id] });
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(rows[0]);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureSchema();
  const db = getDb();
  await db.execute({ sql: 'DELETE FROM open_houses WHERE id = ?', args: [id] });
  return NextResponse.json({ success: true });
}
