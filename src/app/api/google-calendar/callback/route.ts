import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${request.headers.get('host')}`;
  const dashUrl = `${appUrl}/dashboard/open-houses`;

  if (error || !code || !state) {
    return NextResponse.redirect(`${dashUrl}?gcal=error`);
  }

  const userId = parseInt(state, 10);
  if (!userId) return NextResponse.redirect(`${dashUrl}?gcal=error`);

  const redirectUri = `${appUrl}/api/google-calendar/callback`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) return NextResponse.redirect(`${dashUrl}?gcal=error`);

  const tokens = await tokenRes.json();
  const { access_token, refresh_token, expires_in } = tokens;

  if (!access_token || !refresh_token) return NextResponse.redirect(`${dashUrl}?gcal=error`);

  const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

  await ensureSchema();
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO google_calendar_tokens (user_id, access_token, refresh_token, expires_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            access_token = excluded.access_token,
            refresh_token = excluded.refresh_token,
            expires_at = excluded.expires_at,
            updated_at = datetime('now')`,
    args: [userId, access_token, refresh_token, expiresAt],
  });

  return NextResponse.redirect(`${dashUrl}?gcal=connected`);
}
