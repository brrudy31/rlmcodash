import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const signins = db
    .prepare('SELECT * FROM open_house_signins WHERE open_house_id = ? ORDER BY created_at DESC')
    .all(Number(id));
  return NextResponse.json(signins);
}
