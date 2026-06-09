import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const sends = db
    .prepare('SELECT * FROM email_sends WHERE campaign_id = ? ORDER BY client_name ASC')
    .all(id);
  return NextResponse.json(sends);
}
