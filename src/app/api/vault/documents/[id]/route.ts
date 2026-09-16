import { NextRequest, NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { getUserIdFromRequest } from '@/lib/auth';
import { getDb, ensureSchema } from '@/lib/db';

export const runtime = 'nodejs';

const ALLOWED_FOLDERS = ['Contracts', 'Listings', 'Clients', 'Vendors', 'Compliance'];

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await ensureSchema();
  const db = getDb();
  const { rows } = await db.execute({
    sql: `SELECT vd.*, GROUP_CONCAT(vt.tag, ',') as tags
          FROM vault_documents vd
          LEFT JOIN vault_tags vt ON vt.document_id = vd.id
          WHERE vd.id = ? AND vd.user_id = ?
          GROUP BY vd.id`,
    args: [Number(id), userId],
  });
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(rows[0]);
}

export async function PUT(request: NextRequest, { params }: Params) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const { folder, property_address, client_id, tags } = body;

  await ensureSchema();
  const db = getDb();

  // Verify ownership
  const { rows: existing } = await db.execute({
    sql: 'SELECT id FROM vault_documents WHERE id = ? AND user_id = ?',
    args: [Number(id), userId],
  });
  if (!existing[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updates: string[] = ["updated_at = datetime('now')"];
  const args: (string | number | null)[] = [];

  if (folder !== undefined) {
    if (!ALLOWED_FOLDERS.includes(folder)) return NextResponse.json({ error: 'Invalid folder' }, { status: 400 });
    updates.push('folder = ?');
    args.push(folder);
  }
  if (property_address !== undefined) { updates.push('property_address = ?'); args.push(property_address || null); }
  if (client_id !== undefined) { updates.push('client_id = ?'); args.push(client_id || null); }

  if (updates.length > 1) {
    args.push(Number(id));
    await db.execute({ sql: `UPDATE vault_documents SET ${updates.join(', ')} WHERE id = ?`, args });
  }

  // Replace tags
  if (Array.isArray(tags)) {
    await db.execute({ sql: 'DELETE FROM vault_tags WHERE document_id = ?', args: [Number(id)] });
    const clean = tags.map((t: string) => t.trim().toLowerCase()).filter((t) => t.length > 0 && t.length <= 50);
    for (const tag of clean) {
      await db.execute({ sql: 'INSERT OR IGNORE INTO vault_tags (document_id, tag) VALUES (?, ?)', args: [Number(id), tag] });
    }
  }

  const { rows } = await db.execute({
    sql: `SELECT vd.*, GROUP_CONCAT(vt.tag, ',') as tags
          FROM vault_documents vd
          LEFT JOIN vault_tags vt ON vt.document_id = vd.id
          WHERE vd.id = ? GROUP BY vd.id`,
    args: [Number(id)],
  });
  return NextResponse.json(rows[0]);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await ensureSchema();
  const db = getDb();

  const { rows } = await db.execute({
    sql: 'SELECT blob_url, blob_pathname FROM vault_documents WHERE id = ? AND user_id = ?',
    args: [Number(id), userId],
  });
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const doc = rows[0] as unknown as { blob_url: string; blob_pathname: string };

  try {
    await del(doc.blob_url);
  } catch {
    // blob already gone — continue with DB delete
  }

  await db.execute({ sql: 'DELETE FROM vault_documents WHERE id = ?', args: [Number(id)] });
  return NextResponse.json({ success: true });
}
