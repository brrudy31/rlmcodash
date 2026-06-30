import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth';
import { getDb, ensureSchema } from '@/lib/db';

export async function POST(request: NextRequest) {
  const { name, email, password, inviteCode } = await request.json();

  const expectedCode = process.env.INVITE_CODE;
  if (!expectedCode) {
    return NextResponse.json({ error: 'Signups are not configured' }, { status: 500 });
  }
  if (inviteCode !== expectedCode) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 403 });
  }
  if (!name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  await ensureSchema();
  const db = getDb();

  const { rows: existing } = await db.execute({
    sql: 'SELECT id FROM users WHERE email = ?',
    args: [email.trim().toLowerCase()],
  });
  if (existing[0]) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await db.execute({
    sql: 'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
    args: [name.trim(), email.trim().toLowerCase(), passwordHash],
  });

  const userId = Number(result.lastInsertRowid);

  // First user claims all existing unassigned data
  if (userId === 1) {
    await db.execute('UPDATE clients SET user_id = 1 WHERE user_id IS NULL');
    await db.execute('UPDATE open_houses SET user_id = 1 WHERE user_id IS NULL');
    await db.execute('UPDATE vendor_lists SET user_id = 1 WHERE user_id IS NULL');
    await db.execute('UPDATE door_knocking SET user_id = 1 WHERE user_id IS NULL');
    await db.execute('UPDATE market_stats SET user_id = 1 WHERE user_id IS NULL');
    await db.execute('UPDATE email_campaigns SET user_id = 1 WHERE user_id IS NULL');
  }

  const token = await createSessionToken(userId);
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
  return response;
}
