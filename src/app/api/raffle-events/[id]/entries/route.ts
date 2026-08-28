import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await ensureSchema();
  const db = getDb();
  const { rows: eventRows } = await db.execute({ sql: 'SELECT id FROM raffle_events WHERE id = ? AND user_id = ?', args: [Number(id), userId] });
  if (!eventRows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { rows } = await db.execute({
    sql: 'SELECT * FROM raffle_entries WHERE event_id = ? ORDER BY created_at ASC',
    args: [Number(id)],
  });
  return NextResponse.json(rows);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const { entryId, excluded } = await request.json();
  await ensureSchema();
  const db = getDb();
  const { rows: eventRows } = await db.execute({ sql: 'SELECT id FROM raffle_events WHERE id = ? AND user_id = ?', args: [Number(id), userId] });
  if (!eventRows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await db.execute({ sql: 'UPDATE raffle_entries SET excluded = ? WHERE id = ? AND event_id = ?', args: [excluded ? 1 : 0, entryId, Number(id)] });
  return NextResponse.json({ success: true });
}
