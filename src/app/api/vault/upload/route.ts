import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getUserIdFromRequest } from '@/lib/auth';
import { getDb, ensureSchema } from '@/lib/db';

export const runtime = 'nodejs';

const ALLOWED_FOLDERS = ['Contracts', 'Listings', 'Clients', 'Vendors', 'Compliance'];

async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  try {
    if (mimeType === 'application/pdf') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      return data.text?.trim() ?? '';
    }
    if (mimeType.startsWith('text/')) {
      return buffer.toString('utf-8').trim();
    }
  } catch {
    // extraction failed — store without text
  }
  return '';
}

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const folder = (formData.get('folder') as string) || 'Contracts';
  const propertyAddress = (formData.get('property_address') as string) || null;
  const clientId = formData.get('client_id') ? Number(formData.get('client_id')) : null;
  const tagsRaw = (formData.get('tags') as string) || '';

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (!ALLOWED_FOLDERS.includes(folder)) return NextResponse.json({ error: 'Invalid folder' }, { status: 400 });

  const maxBytes = 20 * 1024 * 1024; // 20 MB
  if (file.size > maxBytes) return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 413 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const pathname = `vault/${userId}/${Date.now()}-${safeName}`;

  let blob: Awaited<ReturnType<typeof put>>;
  try {
    blob = await put(pathname, buffer, {
      access: 'public',
      contentType: file.type || 'application/octet-stream',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('token') || msg.includes('unauthorized') || msg.includes('No token')) {
      return NextResponse.json({ error: 'BLOB_READ_WRITE_TOKEN is not configured in Vercel env vars.' }, { status: 500 });
    }
    return NextResponse.json({ error: `Storage error: ${msg}` }, { status: 500 });
  }

  const extractedText = await extractText(buffer, file.type || '');

  const tags = tagsRaw
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0 && t.length <= 50);

  await ensureSchema();
  const db = getDb();

  const result = await db.execute({
    sql: `INSERT INTO vault_documents (user_id, original_name, blob_url, blob_pathname, mime_type, file_size, folder, extracted_text, property_address, client_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [userId, file.name, blob.url, blob.pathname, file.type || 'application/octet-stream', file.size, folder, extractedText || null, propertyAddress || null, clientId],
  });

  const docId = Number(result.lastInsertRowid);

  if (tags.length > 0) {
    for (const tag of tags) {
      await db.execute({
        sql: 'INSERT OR IGNORE INTO vault_tags (document_id, tag) VALUES (?, ?)',
        args: [docId, tag],
      });
    }
  }

  const { rows } = await db.execute({
    sql: `SELECT vd.*, GROUP_CONCAT(vt.tag, ',') as tags
          FROM vault_documents vd
          LEFT JOIN vault_tags vt ON vt.document_id = vd.id
          WHERE vd.id = ?
          GROUP BY vd.id`,
    args: [docId],
  });

  return NextResponse.json(rows[0], { status: 201 });
}
