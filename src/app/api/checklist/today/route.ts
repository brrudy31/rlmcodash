import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';

// ── Default items seeded per user on first access ────────────────────────────
const DEFAULT_ITEMS = [
  // Morning
  { category: 'morning', label: 'New sign-ins not yet in CRM', description: 'Visitors from the last 24 hrs who haven\'t been pushed to your CRM yet.', is_dynamic: 1, dynamic_key: 'unsynced_signins_24h', frequency: 'daily', sort_order: 1 },
  { category: 'morning', label: 'Hot leads needing follow-up', description: 'Score 4+/6 leads from recent open houses who need a call or text.', is_dynamic: 1, dynamic_key: 'hot_leads_pending', frequency: 'daily', sort_order: 2 },
  { category: 'morning', label: 'Open house today', description: 'You have an open house scheduled — confirm signage, promo, and materials.', is_dynamic: 1, dynamic_key: 'open_house_today', frequency: 'daily', sort_order: 3 },
  { category: 'morning', label: 'Upcoming open house (3–5 days)', description: 'Post promo content and confirm signage for your upcoming open house.', is_dynamic: 1, dynamic_key: 'upcoming_open_house', frequency: 'daily', sort_order: 4 },

  // Daily lead-gen
  { category: 'daily_leadgen', label: 'Post one piece of content today', description: 'Share a market update, listing highlight, or client story.', is_dynamic: 0, dynamic_key: null, frequency: 'daily', sort_order: 10 },
  { category: 'daily_leadgen', label: 'Make 3–5 SOI / past-client touches', description: 'Call, text, or DM someone from your sphere. Aim for value, not a pitch.', is_dynamic: 0, dynamic_key: null, frequency: 'daily', sort_order: 11 },
  { category: 'daily_leadgen', label: 'Contacts with no status (needs follow-up)', description: 'New contacts added without a buyer/seller/lost status set.', is_dynamic: 1, dynamic_key: 'clients_no_status', frequency: 'daily', sort_order: 12 },

  // Open house day — only shown when an OH is scheduled today
  { category: 'open_house_day', label: 'Log every visitor before leaving', description: 'Don\'t leave the property with uncaptured guests.', is_dynamic: 0, dynamic_key: null, frequency: 'daily', sort_order: 20 },
  { category: 'open_house_day', label: 'Send same-day follow-up to all sign-ins', description: 'Shoot a quick text or email to everyone who signed in today.', is_dynamic: 0, dynamic_key: null, frequency: 'daily', sort_order: 21 },
  { category: 'open_house_day', label: 'Flag hot leads for tomorrow\'s call', description: 'Review today\'s sign-ins and mark the 4+/6 scores for a morning call.', is_dynamic: 0, dynamic_key: null, frequency: 'daily', sort_order: 22 },
  { category: 'open_house_day', label: 'Add detailed notes on each new lead', description: 'Generic notes don\'t help. Record what they said, their timeline, motivation.', is_dynamic: 0, dynamic_key: null, frequency: 'daily', sort_order: 23 },

  // End of day
  { category: 'end_of_day', label: 'Sign-ins still not in CRM (48+ hrs)', description: 'Stricter check — anyone unsynced for over 48 hours needs to be pushed now.', is_dynamic: 1, dynamic_key: 'unsynced_signins_48h', frequency: 'daily', sort_order: 30 },
  { category: 'end_of_day', label: 'Preview tomorrow\'s open houses', description: 'Check if you have an open house tomorrow and confirm everything is ready.', is_dynamic: 1, dynamic_key: 'open_house_tomorrow', frequency: 'daily', sort_order: 31 },

  // Weekly (Mondays)
  { category: 'weekly', label: 'Referral ask to 1–2 recent closings', description: 'Reach out to past clients who closed in the last 90 days and ask for a referral.', is_dynamic: 0, dynamic_key: null, frequency: 'weekly', day_of_week: 'Monday', sort_order: 40 },
  { category: 'weekly', label: 'Review pipeline — move stale leads to nurture', description: 'Leads you haven\'t touched in 30+ days should be moved to a long-term nurture track.', is_dynamic: 0, dynamic_key: null, frequency: 'weekly', day_of_week: 'Monday', sort_order: 41 },
];

// ── Dynamic query resolver ────────────────────────────────────────────────────
async function resolveDynamic(
  key: string,
  userId: number,
  todayStr: string,
  db: ReturnType<typeof getDb>,
): Promise<{ count: number; label?: string; link?: string; hidden?: boolean }> {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const plus3 = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const plus5 = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  switch (key) {
    case 'unsynced_signins_24h': {
      const { rows } = await db.execute({
        sql: `SELECT COUNT(*) as n FROM open_house_signins s
              JOIN open_houses oh ON oh.id = s.open_house_id
              WHERE oh.user_id = ? AND s.ghl_contact_id IS NULL AND s.created_at >= ?`,
        args: [userId, yesterday],
      });
      const n = Number((rows[0] as any)?.n ?? 0);
      return { count: n, label: `${n} sign-in${n !== 1 ? 's' : ''} not yet in CRM`, link: '/dashboard/open-houses' };
    }

    case 'unsynced_signins_48h': {
      const { rows } = await db.execute({
        sql: `SELECT COUNT(*) as n FROM open_house_signins s
              JOIN open_houses oh ON oh.id = s.open_house_id
              WHERE oh.user_id = ? AND s.ghl_contact_id IS NULL AND s.created_at <= ?`,
        args: [userId, twoDaysAgo],
      });
      const n = Number((rows[0] as any)?.n ?? 0);
      return { count: n, label: `${n} sign-in${n !== 1 ? 's' : ''} unsynced 48+ hrs`, link: '/dashboard/open-houses', hidden: n === 0 };
    }

    case 'hot_leads_pending': {
      const { rows } = await db.execute({
        sql: `SELECT COUNT(*) as n FROM open_house_signins s
              JOIN open_houses oh ON oh.id = s.open_house_id
              WHERE oh.user_id = ? AND s.lead_score >= 4
              AND s.created_at >= ?`,
        args: [userId, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()],
      });
      const n = Number((rows[0] as any)?.n ?? 0);
      return { count: n, label: `${n} hot lead${n !== 1 ? 's' : ''} to follow up`, link: '/dashboard/clients' };
    }

    case 'open_house_today': {
      const { rows } = await db.execute({
        sql: `SELECT address, city FROM open_houses WHERE user_id = ? AND date = ? LIMIT 1`,
        args: [userId, todayStr],
      });
      if (rows.length === 0) return { count: 0, hidden: true };
      const oh = rows[0] as any;
      return { count: 1, label: `Today: ${oh.address}, ${oh.city}`, link: '/dashboard/open-houses' };
    }

    case 'upcoming_open_house': {
      const { rows } = await db.execute({
        sql: `SELECT address, city, date FROM open_houses WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date ASC LIMIT 1`,
        args: [userId, plus3, plus5],
      });
      if (rows.length === 0) return { count: 0, hidden: true };
      const oh = rows[0] as any;
      const daysOut = Math.round((new Date(oh.date + 'T12:00:00').getTime() - Date.now()) / (24 * 60 * 60 * 1000));
      return { count: 1, label: `${oh.address} in ${daysOut} day${daysOut !== 1 ? 's' : ''}`, link: '/dashboard/open-houses' };
    }

    case 'open_house_tomorrow': {
      const { rows } = await db.execute({
        sql: `SELECT address, city FROM open_houses WHERE user_id = ? AND date = ? LIMIT 1`,
        args: [userId, tomorrow],
      });
      if (rows.length === 0) return { count: 0, hidden: true };
      const oh = rows[0] as any;
      return { count: 1, label: `Tomorrow: ${oh.address}, ${oh.city}`, link: '/dashboard/open-houses' };
    }

    case 'clients_no_status': {
      const { rows } = await db.execute({
        sql: `SELECT COUNT(*) as n FROM clients WHERE user_id = ? AND (status IS NULL OR status = '') AND created_at >= ?`,
        args: [userId, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()],
      });
      const n = Number((rows[0] as any)?.n ?? 0);
      return { count: n, label: `${n} contact${n !== 1 ? 's' : ''} without a status`, link: '/dashboard/clients', hidden: n === 0 };
    }

    default:
      return { count: 0 };
  }
}

// ── Seed default items for a new user ────────────────────────────────────────
async function seedItems(userId: number, db: ReturnType<typeof getDb>) {
  for (const item of DEFAULT_ITEMS) {
    await db.execute({
      sql: `INSERT INTO checklist_items
              (user_id, category, label, description, is_dynamic, dynamic_key, frequency, day_of_week, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        userId,
        item.category,
        item.label,
        item.description ?? null,
        item.is_dynamic,
        item.dynamic_key ?? null,
        item.frequency,
        (item as any).day_of_week ?? null,
        item.sort_order,
      ],
    });
  }
}

// ── Streak calculator ─────────────────────────────────────────────────────────
async function getStreak(userId: number, todayStr: string, db: ReturnType<typeof getDb>): Promise<number> {
  // Count consecutive past days (not today) that had at least one completion
  const { rows } = await db.execute({
    sql: `SELECT DISTINCT date FROM checklist_completions
          WHERE user_id = ? AND date < ? AND completed = 1
          ORDER BY date DESC
          LIMIT 90`,
    args: [userId, todayStr],
  });
  let streak = 0;
  let expected = new Date(todayStr);
  expected.setDate(expected.getDate() - 1);
  for (const row of rows) {
    const d = (row as any).date as string;
    const expectedStr = expected.toISOString().split('T')[0];
    if (d === expectedStr) {
      streak++;
      expected.setDate(expected.getDate() - 1);
    } else {
      break;
    }
  }
  // Also count today if anything is completed today
  const { rows: todayRows } = await db.execute({
    sql: `SELECT COUNT(*) as n FROM checklist_completions WHERE user_id = ? AND date = ? AND completed = 1`,
    args: [userId, todayStr],
  });
  if (Number((todayRows[0] as any)?.n ?? 0) > 0) streak++;
  return streak;
}

// ── GET handler ───────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await ensureSchema();
  const db = getDb();

  // Seed if first time
  const { rows: existing } = await db.execute({
    sql: `SELECT id FROM checklist_items WHERE user_id = ? LIMIT 1`,
    args: [userId],
  });
  if (existing.length === 0) await seedItems(userId, db);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayDOW = new Date().toLocaleDateString('en-US', { weekday: 'long' }); // "Monday"

  // Fetch all active items for this user
  const { rows: items } = await db.execute({
    sql: `SELECT * FROM checklist_items WHERE user_id = ? AND active = 1 ORDER BY sort_order`,
    args: [userId],
  });

  // Fetch today's completions
  const { rows: completions } = await db.execute({
    sql: `SELECT checklist_item_id, completed FROM checklist_completions WHERE user_id = ? AND date = ?`,
    args: [userId, todayStr],
  });
  const completedSet = new Set(
    completions
      .filter((c) => Number((c as any).completed) === 1)
      .map((c) => Number((c as any).checklist_item_id)),
  );

  // Whether there's an open house today (controls open_house_day visibility)
  const { rows: ohToday } = await db.execute({
    sql: `SELECT id FROM open_houses WHERE user_id = ? AND date = ? LIMIT 1`,
    args: [userId, todayStr],
  });
  const hasOpenHouseToday = ohToday.length > 0;

  // Resolve each item
  const resolved = await Promise.all(
    items.map(async (row) => {
      const item = row as any;

      // Filter weekly items by day
      if (item.frequency === 'weekly' && item.day_of_week && item.day_of_week !== todayDOW) {
        return null;
      }

      // Filter open_house_day items if no OH today
      if (item.category === 'open_house_day' && !hasOpenHouseToday) {
        return null;
      }

      let dynamicData: { count: number; label?: string; link?: string; hidden?: boolean } = { count: 0 };
      if (item.is_dynamic && item.dynamic_key) {
        dynamicData = await resolveDynamic(item.dynamic_key, userId, todayStr, db);
        if (dynamicData.hidden) return null;
      }

      return {
        id: item.id,
        category: item.category,
        label: item.label,
        description: item.description,
        is_dynamic: Boolean(item.is_dynamic),
        dynamic_count: dynamicData.count,
        dynamic_label: dynamicData.label ?? null,
        dynamic_link: dynamicData.link ?? null,
        frequency: item.frequency,
        completed: completedSet.has(item.id),
      };
    }),
  );

  const visibleItems = resolved.filter(Boolean);
  const streak = await getStreak(userId, todayStr, db);
  const completedCount = visibleItems.filter((i) => i!.completed).length;

  return NextResponse.json({
    date: todayStr,
    items: visibleItems,
    streak,
    completedCount,
    totalCount: visibleItems.length,
  });
}
