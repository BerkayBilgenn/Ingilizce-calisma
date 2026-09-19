import { afterEach, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb, ensureSchema } from "../lib/db";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
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
