import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { getDb, ensureSchema } from '@/lib/db';
import { getValidAccessToken } from '@/lib/google-calendar';
import { getUnreadEmails } from '@/lib/gmail';

export const runtime = 'nodejs';

async function generateBriefing(userId: number) {
  await ensureSchema();
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  // Cold lead threshold
  const { rows: settingsRows } = await db.execute({
    sql: 'SELECT cold_lead_days FROM user_settings WHERE user_id = ?',
    args: [userId],
  });
  const coldDays = (settingsRows[0] as unknown as { cold_lead_days: number } | undefined)?.cold_lead_days ?? 7;

  const results = await Promise.allSettled([
    // 1. Calendar events today
    (async () => {
      const token = await getValidAccessToken(userId);
      if (!token) return { connected: false, events: [] };
      const timeMin = `${today}T00:00:00Z`;
      const timeMax = `${today}T23:59:59Z`;
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return { connected: true, events: [] };
      const data = await res.json();
      const events = (data.items ?? []).map((e: Record<string, unknown>) => ({
        id: e.id,
        summary: e.summary ?? '(no title)',
        start: (e.start as Record<string, string>)?.dateTime ?? (e.start as Record<string, string>)?.date,
        end: (e.end as Record<string, string>)?.dateTime ?? (e.end as Record<string, string>)?.date,
        location: e.location ?? null,
      }));
      return { connected: true, events };
    })(),

    // 2. Unread emails
    (async () => {
      const token = await getValidAccessToken(userId);
      if (!token) return { connected: false, emails: [] };
      const emails = await getUnreadEmails(userId);
      return { connected: true, emails };
    })(),

    // 3. Cold leads
    (async () => {
      const { rows } = await db.execute({
        sql: `SELECT id, name, email, phone, last_contacted_at, temperature, lead_stars
              FROM clients
              WHERE user_id = ?
              AND (last_contacted_at IS NULL OR last_contacted_at < datetime('now', ?))
              ORDER BY last_contacted_at ASC NULLS FIRST
              LIMIT 20`,
        args: [userId, `-${coldDays} days`],
      });
      return {
        threshold_days: coldDays,
        leads: rows.map((r) => r as unknown as {
          id: number; name: string; email: string; phone: string | null;
          last_contacted_at: string | null; temperature: string | null; lead_stars: number | null;
        }),
      };
    })(),

    // 4. Incomplete tasks today
    (async () => {
      const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()];
      const { rows } = await db.execute({
        sql: `SELECT ci.id, ci.label, ci.category, ci.frequency, ci.day_of_week
              FROM checklist_items ci
              WHERE (ci.user_id = ? OR ci.user_id IS NULL)
              AND ci.active = 1
              AND (ci.frequency = 'daily' OR (ci.frequency = 'weekly' AND ci.day_of_week = ?))
              AND ci.id NOT IN (
                SELECT checklist_item_id FROM checklist_completions
                WHERE user_id = ? AND date = ?
              )
              ORDER BY ci.sort_order ASC`,
        args: [userId, dayOfWeek, userId, today],
      });
      return {
        tasks: rows.map((r) => r as unknown as {
          id: number; label: string; category: string; frequency: string; day_of_week: string | null;
        }),
      };
    })(),

    // 5. Open houses today
    (async () => {
      const { rows } = await db.execute({
        sql: `SELECT id, address, city, start_time, end_time, total_attendees
              FROM open_houses WHERE date = ? AND (user_id = ? OR user_id IS NULL)
              ORDER BY start_time ASC`,
        args: [today, userId],
      });
      return {
        openHouses: rows.map((r) => r as unknown as {
          id: number; address: string; city: string;
          start_time: string | null; end_time: string | null; total_attendees: number;
        }),
      };
    })(),
  ]);

  const [calResult, emailResult, leadsResult, tasksResult, ohResult] = results;

  const briefing = {
    date: today,
    generated_at: new Date().toISOString(),
    calendar: calResult.status === 'fulfilled' ? calResult.value : { connected: false, events: [], error: true },
    emails: emailResult.status === 'fulfilled' ? emailResult.value : { connected: false, emails: [], error: true },
    cold_leads: leadsResult.status === 'fulfilled' ? leadsResult.value : { threshold_days: coldDays, leads: [], error: true },
    tasks: tasksResult.status === 'fulfilled' ? tasksResult.value : { tasks: [], error: true },
    open_houses: ohResult.status === 'fulfilled' ? ohResult.value : { openHouses: [], error: true },
  };

  // Cache it
  await db.execute({
    sql: `INSERT INTO briefing_cache (user_id, date, data_json) VALUES (?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET date = excluded.date, data_json = excluded.data_json, generated_at = datetime('now')`,
    args: [userId, today, JSON.stringify(briefing)],
  });

  return briefing;
}

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1';

  if (!forceRefresh) {
    await ensureSchema();
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const { rows } = await db.execute({
      sql: 'SELECT data_json, date FROM briefing_cache WHERE user_id = ?',
      args: [userId],
    });
    const cached = rows[0] as unknown as { data_json: string; date: string } | undefined;
    if (cached?.date === today) {
      return NextResponse.json(JSON.parse(cached.data_json));
    }
  }

  const briefing = await generateBriefing(userId);
  return NextResponse.json(briefing);
}

export async function POST(request: NextRequest) {
  // Used by the cron job — accepts CRON_SECRET header
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureSchema();
  const db = getDb();
  const { rows } = await db.execute('SELECT id FROM users');
  const userIds = (rows as unknown as { id: number }[]).map((r) => r.id);

  const results = await Promise.allSettled(userIds.map((uid) => generateBriefing(uid)));
  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  return NextResponse.json({ generated: succeeded, total: userIds.length });
}
