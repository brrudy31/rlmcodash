import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const { eventId, name, email, phone, heardFrom } = await request.json();
  if (!eventId || !name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  await ensureSchema();
  const db = getDb();
  const { rows: eventRows } = await db.execute({ sql: 'SELECT id FROM raffle_events WHERE id = ?', args: [Number(eventId)] });
  if (!eventRows[0]) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  const result = await db.execute({
    sql: 'INSERT INTO raffle_entries (event_id, name, email, phone, heard_from) VALUES (?, ?, ?, ?, ?)',
    args: [Number(eventId), name.trim(), email?.trim() || '', phone?.trim() || null, heardFrom?.trim() || null],
  });
  return NextResponse.json({ success: true, id: Number(result.lastInsertRowid) }, { status: 201 });
}
