import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const { date, address, neighborhood, city, start_time, end_time, total_attendees, neighbors, represented_buyers, unrepresented_buyers, notes, price, beds, baths, sqft, description, list_date } = body;
  if (!date || !address?.trim() || !city?.trim()) {
    return NextResponse.json({ error: 'Date, address, and city are required' }, { status: 400 });
  }
  await ensureSchema();
  const db = getDb();
  await db.execute({
    sql: `UPDATE open_houses SET date = ?, address = ?, neighborhood = ?, city = ?, start_time = ?, end_time = ?,
          total_attendees = ?, neighbors = ?, represented_buyers = ?, unrepresented_buyers = ?, notes = ?,
          price = ?, beds = ?, baths = ?, sqft = ?, description = ?, list_date = ?
          WHERE id = ? AND user_id = ?`,
    args: [date, address.trim(), neighborhood?.trim() || null, city.trim(), start_time || null, end_time || null, Number(total_attendees) || 0, Number(neighbors) || 0, Number(represented_buyers) || 0, Number(unrepresented_buyers) || 0, notes?.trim() || null, price || null, beds || null, baths || null, sqft || null, description?.trim() || null, list_date || null, id, userId],
  });
  const { rows } = await db.execute({
    sql: `SELECT oh.*,
            (SELECT COUNT(*) FROM open_house_signins WHERE open_house_id = oh.id AND working_with_agent = 1) AS represented_buyers,
            (SELECT COUNT(*) FROM open_house_signins WHERE open_house_id = oh.id AND working_with_agent = 0) AS unrepresented_buyers,
            oh.neighbors + (SELECT COUNT(*) FROM open_house_signins WHERE open_house_id = oh.id) AS total_attendees
          FROM open_houses oh WHERE oh.id = ? AND oh.user_id = ?`,
    args: [id, userId],
  });
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(rows[0]);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await ensureSchema();
  const db = getDb();
  await db.execute({ sql: 'DELETE FROM open_houses WHERE id = ? AND user_id = ?', args: [id, userId] });
  return NextResponse.json({ success: true });
}
