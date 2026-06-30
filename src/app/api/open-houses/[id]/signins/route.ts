import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await ensureSchema();
  const db = getDb();
  const { rows: houseRows } = await db.execute({ sql: 'SELECT id FROM open_houses WHERE id = ? AND user_id = ?', args: [Number(id), userId] });
  if (!houseRows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { rows } = await db.execute({
    sql: 'SELECT * FROM open_house_signins WHERE open_house_id = ? ORDER BY created_at DESC',
    args: [Number(id)],
  });
  return NextResponse.json(rows);
}
