import { createClient, type Client as LibSQLClient } from '@libsql/client';
import path from 'path';

let _client: LibSQLClient | null = null;

export function getDb(): LibSQLClient {
  if (!_client) {
    const url = process.env.TURSO_DATABASE_URL ?? `file:${path.join(process.cwd(), 'data/database.db')}`;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    _client = createClient({ url, authToken });
  }
  return _client;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    opted_out_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vendor_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vendors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_list_id INTEGER NOT NULL REFERENCES vendor_lists(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    trade TEXT,
    phone TEXT,
    email TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS email_campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_list_id INTEGER REFERENCES vendor_lists(id),
    vendor_list_name TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT,
    sent_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS email_sends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL REFERENCES email_campaigns(id),
    client_id INTEGER NOT NULL REFERENCES clients(id),
    client_name TEXT NOT NULL,
    client_email TEXT NOT NULL,
    resend_message_id TEXT,
    opened_at TEXT,
    opted_out_at TEXT,
    unsubscribe_token TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS open_houses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    address TEXT NOT NULL,
    neighborhood TEXT,
    city TEXT NOT NULL,
    time_of_day TEXT,
    total_attendees INTEGER NOT NULL DEFAULT 0,
    neighbors INTEGER NOT NULL DEFAULT 0,
    represented_buyers INTEGER NOT NULL DEFAULT 0,
    unrepresented_buyers INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS market_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    neighborhood TEXT NOT NULL,
    zip_code TEXT,
    month TEXT NOT NULL,
    median_price INTEGER,
    price_per_sqft REAL,
    avg_days_on_market REAL,
    homes_sold INTEGER,
    active_listings INTEGER,
    list_to_sale_ratio REAL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS door_knocking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    area TEXT NOT NULL,
    total_doors INTEGER NOT NULL DEFAULT 0,
    answered INTEGER NOT NULL DEFAULT 0,
    left_at_door INTEGER NOT NULL DEFAULT 0,
    gave_flyer INTEGER NOT NULL DEFAULT 0,
    gave_my_info INTEGER NOT NULL DEFAULT 0,
    gave_vendor_list INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_crm_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    crm_type TEXT NOT NULL DEFAULT 'none',
    api_key TEXT,
    location_id TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS open_house_signins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    open_house_id INTEGER NOT NULL REFERENCES open_houses(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    has_home_to_buy INTEGER NOT NULL DEFAULT 0,
    has_home_to_sell INTEGER NOT NULL DEFAULT 0,
    is_pre_approved INTEGER NOT NULL DEFAULT 0,
    working_with_agent INTEGER NOT NULL DEFAULT 0,
    agent_name TEXT,
    agent_phone TEXT,
    agent_email TEXT,
    agent_brokerage TEXT,
    ghl_contact_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

let _migrated = false;
export async function ensureSchema(): Promise<void> {
  if (_migrated) return;
  const db = getDb();
  // Run each CREATE TABLE statement
  const statements = SCHEMA.split(';').map((s) => s.trim()).filter((s) => s.length > 0);
  for (const sql of statements) {
    await db.execute(sql);
  }
  // Run migrations for new columns (safe to re-run — errors are caught)
  const migrations = [
    'ALTER TABLE open_houses ADD COLUMN start_time TEXT',
    'ALTER TABLE open_houses ADD COLUMN end_time TEXT',
    'ALTER TABLE open_houses ADD COLUMN summary_sent_at TEXT',
    'ALTER TABLE clients ADD COLUMN phone TEXT',
    'ALTER TABLE clients ADD COLUMN source TEXT',
    'ALTER TABLE clients ADD COLUMN open_house_id INTEGER',
    'ALTER TABLE clients ADD COLUMN agent_name TEXT',
    'ALTER TABLE clients ADD COLUMN agent_phone TEXT',
    'ALTER TABLE clients ADD COLUMN agent_email TEXT',
    'ALTER TABLE clients ADD COLUMN agent_brokerage TEXT',
    'ALTER TABLE clients ADD COLUMN working_with_agent INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE clients ADD COLUMN status TEXT',
    'ALTER TABLE clients ADD COLUMN user_id INTEGER',
    'ALTER TABLE open_houses ADD COLUMN user_id INTEGER',
    'ALTER TABLE vendor_lists ADD COLUMN user_id INTEGER',
    'ALTER TABLE door_knocking ADD COLUMN user_id INTEGER',
    'ALTER TABLE market_stats ADD COLUMN user_id INTEGER',
    'ALTER TABLE email_campaigns ADD COLUMN user_id INTEGER',
  ];
  for (const sql of migrations) {
    try { await db.execute(sql); } catch { /* column already exists */ }
  }
  _migrated = true;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type Client = {
  id: number;
  name: string;
  email: string;
  opted_out_at: string | null;
  created_at: string;
};

export type VendorList = {
  id: number;
  name: string;
  created_at: string;
};

export type Vendor = {
  id: number;
  vendor_list_id: number;
  name: string;
  trade: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
};

export type EmailCampaign = {
  id: number;
  vendor_list_id: number | null;
  vendor_list_name: string;
  subject: string;
  message: string | null;
  sent_at: string;
};

export type EmailSend = {
  id: number;
  campaign_id: number;
  client_id: number;
  client_name: string;
  client_email: string;
  resend_message_id: string | null;
  opened_at: string | null;
  opted_out_at: string | null;
  unsubscribe_token: string;
  created_at: string;
};

export type DoorKnocking = {
  id: number;
  date: string;
  area: string;
  total_doors: number;
  answered: number;
  left_at_door: number;
  gave_flyer: number;
  gave_my_info: number;
  gave_vendor_list: number;
  notes: string | null;
  created_at: string;
};

export type OpenHouse = {
  id: number;
  date: string;
  address: string;
  neighborhood: string | null;
  city: string;
  time_of_day: string | null;
  total_attendees: number;
  neighbors: number;
  represented_buyers: number;
  unrepresented_buyers: number;
  notes: string | null;
  created_at: string;
};
