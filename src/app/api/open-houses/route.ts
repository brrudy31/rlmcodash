import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureSchema();
  const db = getDb();
  const { rows } = await db.execute({
    sql: `SELECT oh.*,
            (SELECT COUNT(*) FROM open_house_signins WHERE open_house_id = oh.id AND working_with_agent = 1) AS represented_buyers,
            (SELECT COUNT(*) FROM open_house_signins WHERE open_house_id = oh.id AND working_with_agent = 0) AS unrepresented_buyers,
            oh.neighbors + (SELECT COUNT(*) FROM open_house_signins WHERE open_house_id = oh.id) AS total_attendees
          FROM open_houses oh
          WHERE oh.user_id = ?
          ORDER BY oh.date DESC, oh.created_at DESC`,
    args: [userId],
  });
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const { date, address, neighborhood, city, start_time, end_time, total_attendees, neighbors, represented_buyers, unrepresented_buyers, notes } = body;
  if (!date || !address?.trim() || !city?.trim()) {
    return NextResponse.json({ error: 'Date, address, and city are required' }, { status: 400 });
  }
  await ensureSchema();
  const db = getDb();
  const result = await db.execute({
    sql: `INSERT INTO open_houses (date, address, neighborhood, city, start_time, end_time, total_attendees, neighbors, represented_buyers, unrepresented_buyers, notes, user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [date, address.trim(), neighborhood?.trim() || null, city.trim(), start_time || null, end_time || null, Number(total_attendees) || 0, Number(neighbors) || 0, Number(represented_buyers) || 0, Number(unrepresented_buyers) || 0, notes?.trim() || null, userId],
  });
  const { rows } = await db.execute({ sql: 'SELECT * FROM open_houses WHERE id = ?', args: [Number(result.lastInsertRowid)] });
  return NextResponse.json(rows[0], { status: 201 });
}
