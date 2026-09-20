import { createClient, type Client } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

let sharedDb: Client | undefined;

export function createDb(url: string, token?: string): Client {
  return createClient({ url, authToken: token });
}

export function databaseConfig(env: Record<string, string | undefined>): { url: string; token?: string } {
  const url = env.DATABASE_URL || env.TURSO_DATABASE_URL || (env.VERCEL ? "" : "file:./data/local.db");
  if (!url) throw new Error("DATABASE_URL or TURSO_DATABASE_URL is required on Vercel");
  if (env.VERCEL && url.startsWith("file:")) throw new Error("A persistent database is required on Vercel");
  return { url, token: env.DATABASE_AUTH_TOKEN || env.TURSO_AUTH_TOKEN };
}

export function getDb(): Client {
  if (sharedDb) return sharedDb;
  const { url, token } = databaseConfig(process.env);
  if (url.startsWith("file:") && url !== "file::memory:") mkdirSync(dirname(url.slice(5)), { recursive: true });
  sharedDb = createDb(url, token);
  return sharedDb;
}

export async function ensureSchema(db: Client = getDb()): Promise<void> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'member')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_day TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      set_id INTEGER NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
      term TEXT NOT NULL,
      meaning TEXT NOT NULL,
      position INTEGER NOT NULL,
      UNIQUE(set_id, term)
    )`,
    `CREATE TABLE IF NOT EXISTS daily_checks (
      participant_id INTEGER NOT NULL REFERENCES participants(id),
      word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
      day TEXT NOT NULL,
      checked_at TEXT NOT NULL,
      PRIMARY KEY(participant_id, word_id, day)
    )`,
    `CREATE TABLE IF NOT EXISTS send_runs (
      slot_key TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      message TEXT,
      message_id TEXT,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS login_attempts (
      phone_hash TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      locked_until INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS agent_status (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      connected INTEGER NOT NULL DEFAULT 0,
      group_name TEXT,
      last_seen TEXT,
      last_success TEXT
    )`,
  ];
  for (const sql of statements) await db.execute(sql);
}
