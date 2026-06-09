import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';

export async function GET() {
  await ensureSchema();
  const db = getDb();
  const { rows } = await db.execute('SELECT * FROM market_stats ORDER BY month DESC, neighborhood ASC');
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { neighborhood, zip_code, month, median_price, price_per_sqft, avg_days_on_market, homes_sold, active_listings, list_to_sale_ratio, notes } = body;
  if (!neighborhood?.trim() || !month) {
    return NextResponse.json({ error: 'neighborhood and month are required' }, { status: 400 });
  }
  await ensureSchema();
  const db = getDb();
  const result = await db.execute({
    sql: `INSERT INTO market_stats (neighborhood, zip_code, month, median_price, price_per_sqft, avg_days_on_market, homes_sold, active_listings, list_to_sale_ratio, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [neighborhood.trim(), zip_code?.trim() || null, month, median_price || null, price_per_sqft || null, avg_days_on_market || null, homes_sold || null, active_listings || null, list_to_sale_ratio || null, notes?.trim() || null],
  });
  const { rows } = await db.execute({ sql: 'SELECT * FROM market_stats WHERE id = ?', args: [Number(result.lastInsertRowid)] });
  return NextResponse.json(rows[0], { status: 201 });
}
