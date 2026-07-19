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


export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  await ensureSchema();
  const db = getDb();
  if ('open_house_id' in body) {
    const { rows } = await db.execute({ sql: 'SELECT open_house_id, email, name FROM clients WHERE id = ? AND user_id = ?', args: [id, userId] });
    const client = rows[0];
    const oldOhId = client?.open_house_id as number | null;
    const newOhId = body.open_house_id ?? null;
    await db.execute({ sql: 'UPDATE clients SET open_house_id = ? WHERE id = ? AND user_id = ?', args: [newOhId, id, userId] });
    // Also move the sign-in record so counts stay accurate
    if (client && oldOhId && newOhId && oldOhId !== newOhId) {
      await db.execute({
        sql: `UPDATE open_house_signins SET open_house_id = ?
              WHERE open_house_id = ? AND (
                email = ? OR (first_name || ' ' || last_name) = ?
              ) LIMIT 1`,
        args: [newOhId, oldOhId, String(client.email ?? ''), String(client.name ?? '')],
      });
    }
  }
  if ('status' in body) {
    await db.execute({ sql: 'UPDATE clients SET status = ? WHERE id = ? AND user_id = ?', args: [body.status || null, id, userId] });
  }
  if ('temperature' in body) {
    // Manual override — set flag so auto-calc stops
    await db.execute({ sql: 'UPDATE clients SET temperature = ?, temperature_override = 1 WHERE id = ? AND user_id = ?', args: [body.temperature, id, userId] });
  }
  if ('temperature_override' in body && body.temperature_override === false) {
    // Clear override — resume auto-calc
    await db.execute({ sql: 'UPDATE clients SET temperature_override = 0 WHERE id = ? AND user_id = ?', args: [id, userId] });
  }
  if ('met_in_person' in body) {
    await db.execute({ sql: 'UPDATE clients SET met_in_person = ?, met_date = ? WHERE id = ? AND user_id = ?', args: [body.met_in_person ? 1 : 0, body.met_in_person ? (body.met_date || new Date().toISOString().split('T')[0]) : null, id, userId] });
  }
  if ('homes_shown_count' in body) {
    await db.execute({ sql: 'UPDATE clients SET homes_shown_count = ? WHERE id = ? AND user_id = ?', args: [Number(body.homes_shown_count) || 0, id, userId] });
  }
  if ('working_with_agent' in body) {
    await db.execute({ sql: 'UPDATE clients SET working_with_agent = ? WHERE id = ? AND user_id = ?', args: [body.working_with_agent ? 1 : 0, id, userId] });
  }
  if ('notes' in body) {
    await db.execute({ sql: 'UPDATE clients SET notes = ? WHERE id = ? AND user_id = ?', args: [body.notes?.trim() || null, id, userId] });
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
