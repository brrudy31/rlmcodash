import { getDb, ensureSchema } from './db';

const TIMEZONE = 'America/New_York';

async function refreshToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function getValidAccessToken(userId: number): Promise<string | null> {
  await ensureSchema();
  const db = getDb();
  const { rows } = await db.execute({
    sql: 'SELECT access_token, refresh_token, expires_at FROM google_calendar_tokens WHERE user_id = ?',
    args: [userId],
  });
  if (!rows[0]) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = rows[0] as unknown as { access_token: string; refresh_token: string; expires_at: string };
  if (Date.now() < new Date(row.expires_at).getTime() - 60_000) return row.access_token;

  const fresh = await refreshToken(row.refresh_token);
  if (!fresh) return null;

  const newExpiry = new Date(Date.now() + fresh.expires_in * 1000).toISOString();
  await db.execute({
    sql: 'UPDATE google_calendar_tokens SET access_token = ?, expires_at = ?, updated_at = datetime(\'now\') WHERE user_id = ?',
    args: [fresh.access_token, newExpiry, userId],
  });
  return fresh.access_token;
}

export async function createOpenHouseCalendarEvent(
  accessToken: string,
  oh: { address: string; city: string; date: string; start_time: string | null; end_time: string | null }
): Promise<string | null> {
  const startTime = oh.start_time || '12:00';
  const endTime = oh.end_time || '14:00';

  const event = {
    summary: `Open House: ${oh.address}`,
    location: `${oh.address}, ${oh.city}`,
    start: { dateTime: `${oh.date}T${startTime}:00`, timeZone: TIMEZONE },
    end: { dateTime: `${oh.date}T${endTime}:00`, timeZone: TIMEZONE },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 1440 },
        { method: 'popup', minutes: 60 },
      ],
    },
  };

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.id ?? null;
}

export async function deleteCalendarEvent(accessToken: string, eventId: string): Promise<void> {
  await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
