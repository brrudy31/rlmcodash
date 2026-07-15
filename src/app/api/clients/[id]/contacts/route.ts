import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';

function calcTemperature(logs: any[]): string {
  if (logs.length === 0) return 'cold';
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const recent = logs[0]; // sorted desc by logged_at
  const recentMs = new Date(recent.logged_at).getTime();
  const lastTwoResponded = logs.slice(0, 2).filter((l: any) => l.outcome === 'responded').length >= 2;
  const anyResponded = logs.some((l: any) => l.outcome === 'responded');
  const lastThreeNoResponse = logs.slice(0, 3).every((l: any) => l.outcome !== 'responded');

  if (now - recentMs <= sevenDays && lastTwoResponded) return 'hot';
  if (lastThreeNoResponse && logs.length >= 3) return 'cold';
  if (now - recentMs > thirtyDays) return 'cold';
  if (now - recentMs <= thirtyDays && anyResponded) return 'warm';
  return 'warm'; // new lead with no response pattern yet
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await ensureSchema();
  const db = getDb();
  const { rows } = await db.execute({
    sql: `SELECT * FROM contact_log WHERE client_id = ? AND user_id = ? ORDER BY logged_at DESC`,
    args: [id, userId],
  });
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const { type, outcome, notes } = await request.json();
  if (!type || !outcome) return NextResponse.json({ error: 'type and outcome required' }, { status: 400 });

  await ensureSchema();
  const db = getDb();

  await db.execute({
    sql: `INSERT INTO contact_log (client_id, user_id, type, outcome, notes) VALUES (?, ?, ?, ?, ?)`,
    args: [id, userId, type, outcome, notes?.trim() || null],
  });

  // Re-fetch logs to recalculate temperature
  const { rows: logs } = await db.execute({
    sql: `SELECT * FROM contact_log WHERE client_id = ? AND user_id = ? ORDER BY logged_at DESC`,
    args: [id, userId],
  });

  // Only auto-calc if no override
  const { rows: clientRows } = await db.execute({
    sql: `SELECT temperature_override, contact_count FROM clients WHERE id = ? AND user_id = ?`,
    args: [id, userId],
  });
  const client = clientRows[0] as any;

  const newTemperature = client?.temperature_override ? undefined : calcTemperature(logs as any[]);
  const newCount = Number(client?.contact_count ?? 0) + 1;

  await db.execute({
    sql: `UPDATE clients SET contact_count = ?, last_contacted_at = datetime('now')${newTemperature ? `, temperature = '${newTemperature}'` : ''} WHERE id = ? AND user_id = ?`,
    args: [newCount, id, userId],
  });

  return NextResponse.json({ success: true, temperature: newTemperature });
}
