import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth';
import { getDb, ensureSchema } from '@/lib/db';

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();
  if (!email?.trim() || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  await ensureSchema();
  const db = getDb();
  const { rows } = await db.execute({
    sql: 'SELECT * FROM users WHERE email = ?',
    args: [email.trim().toLowerCase()],
  });

  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, String(user.password_hash)))) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const token = await createSessionToken(Number(user.id));
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
