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

async function addColumn(db: Client, table: string, column: string, definition: string): Promise<void> {
  const columns = await db.execute(`PRAGMA table_info(${table})`);
  if (!columns.rows.some((row) => row.name === column)) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

const learningNoticesTable = `CREATE TABLE learning_notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id INTEGER NOT NULL REFERENCES participants(id),
  word_id INTEGER NOT NULL REFERENCES words(id),
  day TEXT NOT NULL,
  repeat_count INTEGER NOT NULL DEFAULT 1 CHECK(repeat_count BETWEEN 1 AND 3),
  message TEXT NOT NULL,
  status TEXT NOT NULL,
  message_id TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  UNIQUE(participant_id, word_id, day, repeat_count)
)`;

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
      duration_days INTEGER NOT NULL DEFAULT 7,
      program_key TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      set_id INTEGER NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
      term TEXT NOT NULL,
      meaning TEXT NOT NULL,
      pronunciation TEXT NOT NULL DEFAULT '',
      level TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      scheduled_day INTEGER NOT NULL DEFAULT 1,
      position INTEGER NOT NULL,
      UNIQUE(set_id, term)
    )`,
    `CREATE TABLE IF NOT EXISTS word_removals (
      word_id INTEGER PRIMARY KEY REFERENCES words(id) ON DELETE CASCADE,
      removed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS daily_checks (
      participant_id INTEGER NOT NULL REFERENCES participants(id),
      word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
      day TEXT NOT NULL,
      checked_at TEXT NOT NULL,
      repeat_count INTEGER NOT NULL DEFAULT 1 CHECK(repeat_count BETWEEN 1 AND 3),
      PRIMARY KEY(participant_id, word_id, day)
    )`,
    `CREATE TABLE IF NOT EXISTS learned_words (
      participant_id INTEGER NOT NULL REFERENCES participants(id),
      word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
      learned_day TEXT NOT NULL,
      learned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(participant_id, word_id)
    )`,
    `CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      participant_id INTEGER NOT NULL REFERENCES participants(id),
      word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
      quiz_day INTEGER NOT NULL,
      selected_meaning TEXT NOT NULL,
      correct_meaning TEXT NOT NULL,
      is_correct INTEGER NOT NULL CHECK(is_correct IN (0, 1)),
      attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
    learningNoticesTable.replace("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS "),
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
  await addColumn(db, "sets", "duration_days", "INTEGER NOT NULL DEFAULT 7");
  await addColumn(db, "sets", "program_key", "TEXT");
  await addColumn(db, "words", "pronunciation", "TEXT NOT NULL DEFAULT ''");
  await addColumn(db, "words", "level", "TEXT NOT NULL DEFAULT ''");
  await addColumn(db, "words", "category", "TEXT NOT NULL DEFAULT ''");
  await addColumn(db, "words", "scheduled_day", "INTEGER NOT NULL DEFAULT 1");
  await addColumn(db, "daily_checks", "repeat_count", "INTEGER NOT NULL DEFAULT 1 CHECK(repeat_count BETWEEN 1 AND 3)");
  await db.execute("CREATE UNIQUE INDEX IF NOT EXISTS sets_program_key ON sets(program_key) WHERE program_key IS NOT NULL");
  await db.execute("CREATE INDEX IF NOT EXISTS learned_words_participant_date ON learned_words(participant_id, learned_at)");
  await db.execute("CREATE INDEX IF NOT EXISTS quiz_attempts_participant_day ON quiz_attempts(participant_id, quiz_day, attempted_at)");

  const noticeColumns = await db.execute("PRAGMA table_info(learning_notices)");
  if (!noticeColumns.rows.some((row) => row.name === "repeat_count")) {
    const tx = await db.transaction("write");
    try {
      await tx.execute("ALTER TABLE learning_notices RENAME TO learning_notices_legacy");
      await tx.execute(learningNoticesTable);
      await tx.execute(`INSERT INTO learning_notices
        (id, participant_id, word_id, day, repeat_count, message, status, message_id, error, created_at, completed_at)
        SELECT id, participant_id, word_id, day, 1, message, status, message_id, error, created_at, completed_at
        FROM learning_notices_legacy`);
      await tx.execute("DROP TABLE learning_notices_legacy");
      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }
  await db.execute(`INSERT OR IGNORE INTO learned_words (participant_id, word_id, learned_day, learned_at)
    SELECT participant_id, word_id, day, checked_at FROM daily_checks WHERE repeat_count >= 3`);
}
