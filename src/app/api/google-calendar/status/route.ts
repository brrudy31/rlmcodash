import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await ensureSchema();
  const db = getDb();
  const { rows } = await db.execute({
    sql: 'SELECT id FROM google_calendar_tokens WHERE user_id = ?',
    args: [userId],
  });

  return NextResponse.json({
    connected: rows.length > 0,
    configured: !!process.env.GOOGLE_CLIENT_ID,
  });
}

export async function DELETE(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await ensureSchema();
  const db = getDb();
  await db.execute({ sql: 'DELETE FROM google_calendar_tokens WHERE user_id = ?', args: [userId] });

  return NextResponse.json({ success: true });
}
