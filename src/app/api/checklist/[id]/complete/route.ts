import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { completed } = await request.json();
  const todayStr = new Date().toISOString().split('T')[0];

  await ensureSchema();
  const db = getDb();

  if (completed) {
    await db.execute({
      sql: `INSERT INTO checklist_completions (user_id, checklist_item_id, date, completed, completed_at)
            VALUES (?, ?, ?, 1, datetime('now'))
            ON CONFLICT(user_id, checklist_item_id, date) DO UPDATE SET completed = 1, completed_at = datetime('now')`,
      args: [userId, id, todayStr],
    });
  } else {
    await db.execute({
      sql: `DELETE FROM checklist_completions WHERE user_id = ? AND checklist_item_id = ? AND date = ?`,
      args: [userId, id, todayStr],
    });
  }

  return NextResponse.json({ success: true });
}
