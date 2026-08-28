import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureSchema();
  const db = getDb();
  // Public — no auth needed (used by the public raffle sign-in page to show event name)
  const { rows } = await db.execute({ sql: 'SELECT id, name, description FROM raffle_events WHERE id = ?', args: [Number(id)] });
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(rows[0]);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await ensureSchema();
  const db = getDb();
  await db.execute({ sql: 'DELETE FROM raffle_events WHERE id = ? AND user_id = ?', args: [Number(id), userId] });
  return NextResponse.json({ success: true });
}
