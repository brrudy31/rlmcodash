import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const { name, email, phone } = await request.json();
  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
  }
  await ensureSchema();
  const db = getDb();
  try {
    await db.execute({ sql: 'UPDATE clients SET name = ?, email = ?, phone = ? WHERE id = ? AND user_id = ?', args: [name.trim(), email.trim().toLowerCase(), phone?.trim() || null, id, userId] });
    const { rows } = await db.execute({ sql: 'SELECT * FROM clients WHERE id = ? AND user_id = ?', args: [id, userId] });
    if (!rows[0]) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      return NextResponse.json({ error: 'A client with this email already exists' }, { status: 409 });
    }
    throw err;
  }
}

async function recalcOpenHouseCounts(db: import('@libsql/client').Client, openHouseId: number) {
  await db.execute({
    sql: `UPDATE open_houses SET
            represented_buyers   = (SELECT COUNT(*) FROM clients WHERE open_house_id = ? AND working_with_agent = 1),
            unrepresented_buyers = (SELECT COUNT(*) FROM clients WHERE open_house_id = ? AND working_with_agent = 0),
            total_attendees      = neighbors + (SELECT COUNT(*) FROM clients WHERE open_house_id = ?)
          WHERE id = ?`,
    args: [openHouseId, openHouseId, openHouseId, openHouseId],
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  await ensureSchema();
  const db = getDb();
  if ('open_house_id' in body) {
    // Grab the old open_house_id before changing it
    const { rows } = await db.execute({ sql: 'SELECT open_house_id FROM clients WHERE id = ? AND user_id = ?', args: [id, userId] });
    const oldOhId = rows[0]?.open_house_id as number | null;
    await db.execute({ sql: 'UPDATE clients SET open_house_id = ? WHERE id = ? AND user_id = ?', args: [body.open_house_id ?? null, id, userId] });
    // Recalculate counts for both affected open houses
    if (oldOhId) await recalcOpenHouseCounts(db, oldOhId);
    if (body.open_house_id && body.open_house_id !== oldOhId) await recalcOpenHouseCounts(db, body.open_house_id);
  }
  if ('status' in body) {
    await db.execute({ sql: 'UPDATE clients SET status = ? WHERE id = ? AND user_id = ?', args: [body.status || null, id, userId] });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await ensureSchema();
  const db = getDb();
  await db.execute({ sql: 'DELETE FROM clients WHERE id = ? AND user_id = ?', args: [id, userId] });
  return NextResponse.json({ success: true });
}
