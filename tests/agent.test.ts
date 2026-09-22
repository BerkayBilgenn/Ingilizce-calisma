import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb, ensureSchema } from "../lib/db";
import { buildArchiveSnapshot, buildSnapshot, claimLearningNotice, claimSlot, completeLearningNotice, formatArchiveMessage, formatMessage, midnightSlotKey, slotKey } from "../lib/agent";
import { createInitialSetup, createSet, getDashboard, setDailyCheck } from "../lib/store";

describe("two-hour reminder slots", () => {
  it("uses the current Istanbul two-hour slot after a late restart", () => {
    expect(slotKey(new Date("2026-09-20T05:01:00Z"))).toBe("2026-09-20-08");
    expect(slotKey(new Date("2026-09-20T07:01:00Z"))).toBe("2026-09-20-10");
    expect(slotKey(new Date("2026-09-20T19:01:00Z"))).toBe("2026-09-20-22");
    expect(slotKey(new Date("2026-09-20T21:01:00Z"))).toBe("2026-09-21-00");
  });

  it("opens one midnight archive slot during Istanbul's midnight hour", () => {
    expect(midnightSlotKey(new Date("2026-09-21T21:15:00.000Z"))).toBe("midnight-2026-09-22");
    expect(midnightSlotKey(new Date("2026-09-21T22:15:00.000Z"))).toBeNull();
    expect(midnightSlotKey(new Date("2026-09-22T20:59:59.000Z"))).toBeNull();
  });

  it("formats two separate remaining-word sections", () => {
    const message = formatMessage({ day: "2026-09-20", people: [{ name: "Ada", remaining: [{ term: "apple", meaning: "elma", repeatCount: 1 }], learned: [] }, { name: "Deniz", remaining: [{ term: "book", meaning: "kitap", repeatCount: 0 }], learned: [] }] });
    expect(message).toContain("Ada");
    expect(message).toContain("apple — elma");
    expect(message).toContain("1 kere ezberlendi, kalan ezberlenme 2");
    expect(message).toContain("0 kere ezberlendi, kalan ezberlenme 3");
    expect(message).toContain("Deniz");
    expect(message).toContain("book — kitap");
    expect(message).toContain("Bir sonraki hatırlatma 2 saat sonra.");
    const complete = formatMessage({ day: "2026-09-20", people: [{ name: "Ada", remaining: [], learned: [{ term: "apple", meaning: "elma", repeatCount: 3 }] }, { name: "Deniz", remaining: [], learned: [{ term: "book", meaning: "kitap", repeatCount: 3 }] }] });
    expect(complete).toContain("Ada · bugün tüm kelimeleri öğrendim");
    expect(complete).toContain("apple — elma");
    expect(complete).toContain("Deniz · bugün tüm kelimeleri öğrendim");
    expect(formatMessage({ day: "2026-09-20", people: [{ name: "Ada", remaining: [], learned: [] }, { name: "Deniz", remaining: [], learned: [] }] })).toBeNull();
  });

  it("builds reminder progress from today's persisted repeats", async () => {
    const directory = mkdtempSync(join(tmpdir(), "kelime-snapshot-"));
    const db = createDb(`file:${join(directory, "test.db")}`);
    await ensureSchema(db);
    const [adminId] = await createInitialSetup(db, [
      { phone: "0537 000 00 00", name: "Ada", pin: "123456" },
      { phone: "0532 000 00 00", name: "Deniz", pin: "654321" },
    ]);
    await createSet(db, adminId, [{ term: "apple", meaning: "elma" }], "2026-09-20");
    const wordId = (await getDashboard(db, adminId, "2026-09-20")).words[0].id;
    await setDailyCheck(db, adminId, wordId, true, "2026-09-20");
    expect(formatMessage(await buildSnapshot(db, "2026-09-20"))).toContain("apple — elma (1 kere ezberlendi, kalan ezberlenme 2)");
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it("formats every participant's permanent learned-word archive", async () => {
    const directory = mkdtempSync(join(tmpdir(), "kelime-archive-snapshot-"));
    const db = createDb(`file:${join(directory, "test.db")}`);
    await ensureSchema(db);
    const [adminId] = await createInitialSetup(db, [
      { phone: "0537 000 00 00", name: "Ada", pin: "123456" },
      { phone: "0532 000 00 00", name: "Deniz", pin: "654321" },
    ]);
    await createSet(db, adminId, [{ term: "apple", meaning: "elma" }], "2026-09-20");
    const wordId = (await getDashboard(db, adminId, "2026-09-20")).words[0].id;
    await setDailyCheck(db, adminId, wordId, true, "2026-09-20");
    await setDailyCheck(db, adminId, wordId, true, "2026-09-20");
    await setDailyCheck(db, adminId, wordId, true, "2026-09-20");

    const message = formatArchiveMessage(await buildArchiveSnapshot(db, "2026-09-21"));
    expect(message).toContain("🌙 Gece kelime arşivi · 2026-09-21");
    expect(message).toContain("Ada · 1 kelime");
    expect(message).toContain("apple — elma");
    expect(message).toContain("Deniz · 0 kelime");
    expect(message).toContain("Henüz arşivlenen kelime yok.");
    db.close();
    rmSync(directory, { recursive: true, force: true });
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
