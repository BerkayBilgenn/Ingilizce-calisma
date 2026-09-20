import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb, ensureSchema } from "../lib/db";
import { claimLearningNotice, claimSlot, completeLearningNotice, formatMessage, slotKey } from "../lib/agent";

describe("four-hour reminder slots", () => {
  it("uses the current Istanbul four-hour slot after a late restart", () => {
    expect(slotKey(new Date("2026-09-20T05:01:00Z"))).toBe("2026-09-20-08");
    expect(slotKey(new Date("2026-09-20T06:37:00Z"))).toBe("2026-09-20-08");
    expect(slotKey(new Date("2026-09-20T21:01:00Z"))).toBe("2026-09-21-00");
  });

  it("formats two separate remaining-word sections", () => {
    const message = formatMessage({ day: "2026-09-20", people: [{ name: "Ada", remaining: [{ term: "apple", meaning: "elma" }], learned: [] }, { name: "Deniz", remaining: [{ term: "book", meaning: "kitap" }], learned: [] }] });
    expect(message).toContain("Ada");
    expect(message).toContain("apple — elma");
    expect(message).toContain("Deniz");
    expect(message).toContain("book — kitap");
    const complete = formatMessage({ day: "2026-09-20", people: [{ name: "Ada", remaining: [], learned: [{ term: "apple", meaning: "elma" }] }, { name: "Deniz", remaining: [], learned: [{ term: "book", meaning: "kitap" }] }] });
    expect(complete).toContain("Ada · bugün tüm kelimeleri öğrendim");
    expect(complete).toContain("apple — elma");
    expect(complete).toContain("Deniz · bugün tüm kelimeleri öğrendim");
    expect(formatMessage({ day: "2026-09-20", people: [{ name: "Ada", remaining: [], learned: [] }, { name: "Deniz", remaining: [], learned: [] }] })).toBeNull();
  });

  it("claims a slot only once", async () => {
    const directory = mkdtempSync(join(tmpdir(), "kelime-agent-"));
    const db = createDb(`file:${join(directory, "test.db")}`);
    await ensureSchema(db);
    expect(await claimSlot(db, "2026-09-20-12", "message")).toBe(true);
    expect(await claimSlot(db, "2026-09-20-12", "message")).toBe(false);
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it("claims pending learning notices once and expires old notices", async () => {
    const directory = mkdtempSync(join(tmpdir(), "kelime-notice-"));
    const db = createDb(`file:${join(directory, "test.db")}`);
    await ensureSchema(db);
    await db.execute({ sql: "INSERT INTO participants (phone, name, pin_hash, role) VALUES (?, ?, ?, ?)", args: ["+905370000000", "Ada", "hash", "admin"] });
    await db.execute({ sql: "INSERT INTO sets (start_day) VALUES (?)", args: ["2026-09-20"] });
    await db.execute({ sql: "INSERT INTO words (set_id, term, meaning, position) VALUES (1, ?, ?, 0)", args: ["apple", "elma"] });
    await db.execute({ sql: "INSERT INTO learning_notices (participant_id, word_id, day, message, status, created_at) VALUES (1, 1, ?, ?, 'pending', ?)", args: ["2026-09-20", "old", "2026-09-20 11:00:00"] });
    await db.execute({ sql: "INSERT INTO learning_notices (participant_id, word_id, day, message, status, created_at) VALUES (1, 1, ?, ?, 'pending', ?)", args: ["2026-09-21", "new", "2026-09-20 12:00:00"] });
    const claimed = await claimLearningNotice(db, new Date("2026-09-20T12:05:00Z"));
    expect(claimed?.message).toBe("new");
    expect(claimed?.slotKey).toMatch(/^notice-\d+$/);
    expect(await claimLearningNotice(db, new Date("2026-09-20T12:05:00Z"))).toBeNull();
    await completeLearningNotice(db, Number(claimed?.slotKey.slice(7)), "sent", "msg-1");
    const rows = await db.execute("SELECT status FROM learning_notices ORDER BY id");
    expect(rows.rows.map((row) => row.status)).toEqual(["expired", "sent"]);
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });
});
