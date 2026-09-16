import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { getDb, ensureSchema } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const folder = searchParams.get('folder');
  const search = searchParams.get('search')?.trim();
  const tag = searchParams.get('tag')?.trim().toLowerCase();

  await ensureSchema();
  const db = getDb();

  let sql = `
    SELECT vd.id, vd.original_name, vd.blob_url, vd.mime_type, vd.file_size,
           vd.folder, vd.property_address, vd.client_id, vd.created_at, vd.updated_at,
           GROUP_CONCAT(vt.tag, ',') as tags
    FROM vault_documents vd
    LEFT JOIN vault_tags vt ON vt.document_id = vd.id
    WHERE vd.user_id = ?
  `;
  const args: (string | number)[] = [userId];

  if (folder) {
    sql += ' AND vd.folder = ?';
    args.push(folder);
  }

  if (search) {
    sql += ' AND (vd.original_name LIKE ? OR vd.extracted_text LIKE ? OR vd.property_address LIKE ?)';
    const pattern = `%${search}%`;
    args.push(pattern, pattern, pattern);
  }

  if (tag) {
    sql += ` AND vd.id IN (SELECT document_id FROM vault_tags WHERE tag = ?)`;
    args.push(tag);
  }

  sql += ' GROUP BY vd.id ORDER BY vd.created_at DESC LIMIT 200';

  const { rows } = await db.execute({ sql, args });
  return NextResponse.json(rows);
}
