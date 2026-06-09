import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureSchema();
  const db = getDb();
  const { rows } = await db.execute({
    sql: 'SELECT * FROM email_sends WHERE campaign_id = ? ORDER BY client_name ASC',
    args: [id],
  });
  return NextResponse.json(rows);
}
