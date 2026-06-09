import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');

interface ParsedVendor {
  name: string;
  trade: string;
  phone: string;
  email: string;
}

/** Try to extract phone numbers from a string */
function extractPhone(text: string): string {
  const m = text.match(/(\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4})/);
  return m ? m[1].trim() : '';
}

/** Try to extract email from a string */
function extractEmail(text: string): string {
  const m = text.match(/[\w.+\-]+@[\w\-]+\.[\w.]+/);
  return m ? m[0].trim() : '';
}

/** Heuristic: parse raw PDF text into vendor rows */
function parseVendors(rawText: string): ParsedVendor[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const results: ParsedVendor[] = [];

  // Strategy: group lines into blocks. Each block is a vendor entry.
  // A new block starts when we detect a "name-like" line (no phone/email pattern).
  // Collect phone & email from any line in the block.

  let current: { lines: string[] } | null = null;

  function flush() {
    if (!current || current.lines.length === 0) return;
    const allText = current.lines.join(' ');
    const phone = extractPhone(allText);
    const email = extractEmail(allText);

    // Remove phone/email tokens to find name-like content
    const cleaned = current.lines
      .map((l) => l.replace(/(\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4})/, '').replace(/[\w.+\-]+@[\w\-]+\.[\w.]+/, '').trim())
      .filter((l) => l.length > 1);

    if (cleaned.length === 0) return;

    // First non-empty cleaned line is the name, rest is trade
    const name = cleaned[0];
    const trade = cleaned.slice(1).join(', ');

    if (name.length < 2) return;
    results.push({ name, trade, phone, email });
    current = null;
  }

  for (const line of lines) {
    const hasPhone = /\d{3}/.test(line);
    const hasEmail = /@/.test(line);

    // Skip pure header/footer lines
    if (/^page \d+/i.test(line) || /^\d+$/.test(line)) continue;

    if (!current) {
      current = { lines: [line] };
    } else if (hasPhone || hasEmail) {
      // Append contact info to current block
      current.lines.push(line);
      flush();
    } else if (line.length > 1) {
      // New name-like line — flush old block and start new
      flush();
      current = { lines: [line] };
    }
  }
  flush();

  return results;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let rawText = '';
  try {
    const parsed = await pdfParse(buffer);
    rawText = parsed.text || '';
  } catch {
    return NextResponse.json({ error: 'Could not read PDF. Make sure it is a text-based PDF, not a scanned image.' }, { status: 422 });
  }

  const preview = parseVendors(rawText);

  // If caller passes ?save=true, save to DB immediately
  const save = req.nextUrl.searchParams.get('save') === 'true';
  if (save) {
    await ensureSchema();
    const db = getDb();
    for (const v of preview) {
      await db.execute({
        sql: 'INSERT INTO vendors (vendor_list_id, name, trade, phone, email) VALUES (?, ?, ?, ?, ?)',
        args: [id, v.name, v.trade || null, v.phone || null, v.email || null],
      });
    }
    return NextResponse.json({ imported: preview.length });
  }

  // Default: return preview for user to confirm/edit
  return NextResponse.json({ preview, rawText: rawText.slice(0, 2000) });
}
