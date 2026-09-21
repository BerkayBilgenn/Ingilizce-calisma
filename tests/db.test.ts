import { afterEach, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb, databaseConfig, ensureSchema } from "../lib/db";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

it("uses Turso credentials injected by Vercel when DATABASE_URL is empty", () => {
  expect(databaseConfig({
    VERCEL: "1",
    DATABASE_URL: "",
    TURSO_DATABASE_URL: "libsql://study.turso.io",
    TURSO_AUTH_TOKEN: "token",
  })).toEqual({ url: "libsql://study.turso.io", token: "token" });
});

it("rejects local file databases on Vercel", () => {
  expect(() => databaseConfig({ VERCEL: "1", DATABASE_URL: "file:./data/local.db" })).toThrow(/persistent database/i);
});

it("creates durable tables and prevents duplicate daily checks", async () => {
  const directory = mkdtempSync(join(tmpdir(), "kelime-db-"));
  directories.push(directory);
  const db = createDb(`file:${join(directory, "test.db")}`);
  await ensureSchema(db);
  await ensureSchema(db);

  await db.execute({
    sql: "INSERT INTO participants (phone, name, pin_hash, role) VALUES (?, ?, ?, ?)",
    args: ["+905370000000", "Ada", "hash", "admin"],
  });
  await db.execute({ sql: "INSERT INTO sets (start_day) VALUES (?)", args: ["2026-09-20"] });
  await db.execute({ sql: "INSERT INTO words (set_id, term, meaning, position) VALUES (1, ?, ?, 0)", args: ["apple", "elma"] });
  const check = {
    sql: "INSERT INTO daily_checks (participant_id, word_id, day, checked_at) VALUES (1, 1, ?, ?)",
    args: ["2026-09-20", "2026-09-20T12:00:00.000Z"],
  };
  await db.execute(check);
  await expect(db.execute(check)).rejects.toThrow();

  const run = { sql: "INSERT INTO send_runs (slot_key, status) VALUES (?, ?)", args: ["2026-09-20-12", "claimed"] };
  await db.execute(run);
  await expect(db.execute(run)).rejects.toThrow();
  db.close();
});

it("adds 100-day curriculum columns idempotently", async () => {
  const directory = mkdtempSync(join(tmpdir(), "kelime-program-schema-"));
  directories.push(directory);
  const db = createDb(`file:${join(directory, "test.db")}`);
  await ensureSchema(db);
  await ensureSchema(db);
  const sets = await db.execute("PRAGMA table_info(sets)");
  expect(sets.rows.map((row) => row.name)).toEqual(expect.arrayContaining(["duration_days", "program_key"]));
  const words = await db.execute("PRAGMA table_info(words)");
  expect(words.rows.map((row) => row.name)).toEqual(expect.arrayContaining(["pronunciation", "level", "category", "scheduled_day"]));
  const notices = await db.execute("PRAGMA table_info(learning_notices)");
  expect(notices.rows.map((row) => row.name)).toContain("repeat_count");
  db.close();
});

it("preserves legacy notices and allows one notice per repeat", async () => {
  const directory = mkdtempSync(join(tmpdir(), "kelime-notice-schema-"));
  directories.push(directory);
  const db = createDb(`file:${join(directory, "test.db")}`);
  await db.execute("CREATE TABLE participants (id INTEGER PRIMARY KEY, phone TEXT NOT NULL UNIQUE, name TEXT NOT NULL, pin_hash TEXT NOT NULL, role TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  await db.execute("CREATE TABLE sets (id INTEGER PRIMARY KEY, start_day TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  await db.execute("CREATE TABLE words (id INTEGER PRIMARY KEY, set_id INTEGER NOT NULL, term TEXT NOT NULL, meaning TEXT NOT NULL, position INTEGER NOT NULL, UNIQUE(set_id, term))");
  await db.execute(`CREATE TABLE learning_notices (
    id INTEGER PRIMARY KEY AUTOINCREMENT, participant_id INTEGER NOT NULL, word_id INTEGER NOT NULL,
    day TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL, message_id TEXT, error TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT,
    UNIQUE(participant_id, word_id, day)
  )`);
  await db.execute("INSERT INTO participants (id, phone, name, pin_hash, role) VALUES (1, '+905370000000', 'Ada', 'hash', 'admin')");
  await db.execute("INSERT INTO sets (id, start_day) VALUES (1, '2026-09-21')");
  await db.execute("INSERT INTO words (id, set_id, term, meaning, position) VALUES (1, 1, 'accept', 'kabul etmek', 0)");
  await db.execute("INSERT INTO learning_notices (participant_id, word_id, day, message, status) VALUES (1, 1, '2026-09-21', 'legacy', 'sent')");

  await ensureSchema(db);
  const legacy = await db.execute("SELECT message, status, repeat_count FROM learning_notices");
  expect(legacy.rows[0]).toMatchObject({ message: "legacy", status: "sent", repeat_count: 1 });
  await db.execute("INSERT INTO learning_notices (participant_id, word_id, day, repeat_count, message, status) VALUES (1, 1, '2026-09-21', 2, 'second', 'pending')");
  expect((await db.execute("SELECT COUNT(*) AS count FROM learning_notices")).rows[0].count).toBe(2);
  db.close();
});
