import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureSchema();
  const db = getDb();
  const { rows } = await db.execute({
    sql: 'SELECT id, address, city, neighborhood, date, start_time, end_time, price, beds, baths, sqft, description FROM open_houses WHERE id = ?',
    args: [id],
  });
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(rows[0]);
}
