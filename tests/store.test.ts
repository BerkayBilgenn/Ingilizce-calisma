import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb, ensureSchema } from "../lib/db";
import { activateCurriculum, addActiveWord, authenticate, createInitialSetup, createSet, getDashboard, removeActiveWord, setDailyCheck } from "../lib/store";
import { curriculumWords } from "../lib/curriculum";

const directories: string[] = [];
afterEach(() => { for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }); });

async function database() {
  const dir = mkdtempSync(join(tmpdir(), "kelime-store-"));
  directories.push(dir);
  const db = createDb(`file:${join(dir, "test.db")}`);
  await ensureSchema(db);
  return db;
}

const people = [
  { phone: "0537 000 00 00", name: "Ada", pin: "123456" },
  { phone: "0532 000 00 00", name: "Deniz", pin: "654321" },
];

describe("two-person study state", () => {
  it("activates one 100-day curriculum and returns only the scheduled ten words", async () => {
    const db = await database();
    const [adminId] = await createInitialSetup(db, people);
    await createSet(db, adminId, [{ term: "legacy", meaning: "eski" }], "2026-09-20");
    const legacyWordId = (await getDashboard(db, adminId, "2026-09-20")).words[0].id;
    await setDailyCheck(db, adminId, legacyWordId, true, "2026-09-20");

    const firstId = await activateCurriculum(db, "2026-09-21", () => 0);
    expect(await activateCurriculum(db, "2026-09-22", () => 1)).toBe(firstId);
    expect(Number((await db.execute("SELECT COUNT(*) AS count FROM participants")).rows[0].count)).toBe(2);
    expect(Number((await db.execute("SELECT COUNT(*) AS count FROM sets WHERE program_key = 'english-1000-v2-random'")).rows[0].count)).toBe(1);
    expect(Number((await db.execute("SELECT COUNT(*) AS count FROM sets")).rows[0].count)).toBe(1);
    expect(Number((await db.execute("SELECT COUNT(*) AS count FROM daily_checks")).rows[0].count)).toBe(0);
    expect(Number((await db.execute("SELECT COUNT(*) AS count FROM learning_notices")).rows[0].count)).toBe(0);
    expect(Number((await db.execute({ sql: "SELECT COUNT(*) AS count FROM words WHERE set_id = ?", args: [firstId] })).rows[0].count)).toBe(1000);
    const days = await db.execute({ sql: "SELECT scheduled_day, COUNT(*) AS count FROM words WHERE set_id = ? GROUP BY scheduled_day ORDER BY scheduled_day", args: [firstId] });
    expect(days.rows).toHaveLength(100);
    expect(days.rows.every((row) => Number(row.count) === 10)).toBe(true);
    const first = await getDashboard(db, adminId, "2026-09-21");
    expect(first.set).toMatchObject({ startDay: "2026-09-21", dayNumber: 1, durationDays: 100, programKey: "english-1000-v2-random" });
    expect(first.words.map((word) => word.term)).not.toEqual(curriculumWords.slice(0, 10).map((word) => word.term));
    expect(first.words[0].pronunciation).toBeTruthy();
    const last = await getDashboard(db, adminId, "2026-12-29");
    expect(new Set([...first.words, ...last.words].map((word) => word.term)).size).toBe(20);
    expect((await getDashboard(db, adminId, "2026-12-30")).set).toBeNull();
    db.close();
  });
  it("allows initial setup only once and authenticates each phone", async () => {
    const db = await database();
    await createInitialSetup(db, people);
    await expect(createInitialSetup(db, people)).rejects.toThrow();
    expect((await authenticate(db, "0537 000 00 00", "123456"))?.name).toBe("Ada");
    expect(await authenticate(db, "0537 000 00 00", "654321")).toBeNull();
    expect(await authenticate(db, "0533 000 00 00", "123456")).toBeNull();
    db.close();
  });

  it("requires three daily confirmations per word and keeps each person's progress separate", async () => {
    const db = await database();
    const [adminId, memberId] = await createInitialSetup(db, people);
    await createSet(db, adminId, [{ term: "apple", meaning: "elma" }, { term: "book", meaning: "kitap" }], "2026-09-20");
    const first = await getDashboard(db, adminId, "2026-09-20");
    expect(first.remaining).toBe(2);
    expect(first.words[0].repeatCount).toBe(0);
    await setDailyCheck(db, adminId, first.words[0].id, true, "2026-09-20");
    expect((await getDashboard(db, adminId, "2026-09-20")).words[0]).toMatchObject({ repeatCount: 1, checked: false });
    expect((await getDashboard(db, adminId, "2026-09-20")).remaining).toBe(2);
    await setDailyCheck(db, adminId, first.words[0].id, true, "2026-09-20");
    expect((await getDashboard(db, adminId, "2026-09-20")).words[0].repeatCount).toBe(2);
    await setDailyCheck(db, adminId, first.words[0].id, true, "2026-09-20");
    await setDailyCheck(db, adminId, first.words[0].id, true, "2026-09-20");
    expect((await getDashboard(db, adminId, "2026-09-20")).words[0]).toMatchObject({ repeatCount: 3, checked: true });
    expect((await getDashboard(db, adminId, "2026-09-20")).remaining).toBe(1);
    expect((await getDashboard(db, memberId, "2026-09-20")).remaining).toBe(2);
    expect((await getDashboard(db, adminId, "2026-09-21")).remaining).toBe(2);
    expect((await getDashboard(db, adminId, "2026-09-27")).set).toBeNull();
    await setDailyCheck(db, adminId, first.words[0].id, false, "2026-09-20");
    expect((await getDashboard(db, adminId, "2026-09-20")).remaining).toBe(2);
    expect((await getDashboard(db, adminId, "2026-09-20")).words[0]).toMatchObject({ repeatCount: 2, checked: false });
    db.close();
  });

  it("rejects checks outside the active set and overlapping sets", async () => {
    const db = await database();
    const [adminId, memberId] = await createInitialSetup(db, people);
    await createSet(db, adminId, [{ term: "apple", meaning: "elma" }], "2026-09-20");
    await expect(createSet(db, adminId, [{ term: "book", meaning: "kitap" }], "2026-09-21")).rejects.toThrow();
    await expect(createSet(db, memberId, [{ term: "book", meaning: "kitap" }], "2026-09-27")).rejects.toThrow();
    const wordId = (await getDashboard(db, adminId, "2026-09-20")).words[0].id;
    await expect(setDailyCheck(db, memberId, wordId, true, "2026-09-27")).rejects.toThrow();
    db.close();
  });

  it("lets either participant edit the shared active list without erasing past checks", async () => {
    const db = await database();
    const [adminId, memberId] = await createInitialSetup(db, people);
    await createSet(db, adminId, [{ term: "apple", meaning: "elma" }], "2026-09-20");
    const addedId = await addActiveWord(db, memberId, { term: "book", meaning: "kitap" }, "2026-09-20");
    expect((await getDashboard(db, adminId, "2026-09-20")).words.map((word) => word.term)).toEqual(["apple", "book"]);
    await setDailyCheck(db, adminId, addedId, true, "2026-09-20");
    await removeActiveWord(db, adminId, addedId, "2026-09-20");
    expect((await getDashboard(db, memberId, "2026-09-20")).words.map((word) => word.term)).toEqual(["apple"]);
    const history = await db.execute({ sql: "SELECT COUNT(*) AS count FROM daily_checks WHERE word_id = ?", args: [addedId] });
    expect(Number(history.rows[0].count)).toBe(1);
    expect(await addActiveWord(db, memberId, { term: "book", meaning: "kitap" }, "2026-09-20")).toBe(addedId);
    expect((await getDashboard(db, memberId, "2026-09-20")).words.map((word) => word.term)).toEqual(["apple", "book"]);
    db.close();
  });

  it("rejects duplicate words and edits after the seven-day set ends", async () => {
    const db = await database();
    const [adminId, memberId] = await createInitialSetup(db, people);
    await createSet(db, adminId, [{ term: "apple", meaning: "elma" }], "2026-09-20");
    await expect(addActiveWord(db, memberId, { term: "APPLE", meaning: "elma" }, "2026-09-20")).rejects.toThrow(/zaten/i);
    await expect(addActiveWord(db, memberId, { term: "book", meaning: "kitap" }, "2026-09-27")).rejects.toThrow(/aktif/i);
    const wordId = (await getDashboard(db, adminId, "2026-09-20")).words[0].id;
    await expect(removeActiveWord(db, memberId, wordId, "2026-09-27")).rejects.toThrow(/aktif/i);
    db.close();
  });

  it("queues each repeat notice, cancels an undone pending repeat, and never duplicates a sent repeat", async () => {
    const db = await database();
    const [adminId] = await createInitialSetup(db, people);
    await createSet(db, adminId, [{ term: "apple", meaning: "elma" }], "2026-09-20");
    const wordId = (await getDashboard(db, adminId, "2026-09-20")).words[0].id;
    await setDailyCheck(db, adminId, wordId, true, "2026-09-20");
    await setDailyCheck(db, adminId, wordId, true, "2026-09-20");
    await setDailyCheck(db, adminId, wordId, true, "2026-09-20");
    await setDailyCheck(db, adminId, wordId, true, "2026-09-20");
    let result = await db.execute("SELECT repeat_count, message, status FROM learning_notices ORDER BY repeat_count");
    expect(result.rows.map((row) => row.message)).toEqual([
      "📚 Ada “apple” kelimesini 1 kez ezberledi. 2 tekrar kaldı.",
      "📚 Ada “apple” kelimesini 2 kez ezberledi. 1 tekrar kaldı.",
      "⭐ Ada “apple” kelimesini bugün 3 kez ezberledi. Tamamlandı!",
    ]);
    expect(result.rows.length).toBe(3);
    await setDailyCheck(db, adminId, wordId, false, "2026-09-20");
    expect((await getDashboard(db, adminId, "2026-09-20")).words[0].repeatCount).toBe(2);
    result = await db.execute("SELECT status FROM learning_notices WHERE repeat_count = 3");
    expect(result.rows[0].status).toBe("cancelled");
    await setDailyCheck(db, adminId, wordId, true, "2026-09-20");
    result = await db.execute("SELECT status FROM learning_notices WHERE repeat_count = 3");
    expect(result.rows[0].status).toBe("pending");
    await db.execute("UPDATE learning_notices SET status = 'sent' WHERE repeat_count = 3");
    await setDailyCheck(db, adminId, wordId, false, "2026-09-20");
    await setDailyCheck(db, adminId, wordId, true, "2026-09-20");
    expect((await db.execute("SELECT status FROM learning_notices WHERE repeat_count = 3")).rows[0].status).toBe("sent");
    await removeActiveWord(db, adminId, wordId, "2026-09-20");
    result = await db.execute("SELECT repeat_count, status FROM learning_notices ORDER BY repeat_count");
    expect(result.rows.map((row) => row.status)).toEqual(["cancelled", "cancelled", "sent"]);
    db.close();
  });

  it("keeps existing one-check rows as one of three repeats during schema migration", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kelime-legacy-"));
    directories.push(dir);
    const db = createDb(`file:${join(dir, "test.db")}`);
    await db.execute(`CREATE TABLE daily_checks (
      participant_id INTEGER NOT NULL, word_id INTEGER NOT NULL, day TEXT NOT NULL,
      checked_at TEXT NOT NULL, PRIMARY KEY(participant_id, word_id, day)
    )`);
    await ensureSchema(db);
    const [adminId] = await createInitialSetup(db, people);
    await createSet(db, adminId, [{ term: "apple", meaning: "elma" }], "2026-09-20");
    const wordId = (await getDashboard(db, adminId, "2026-09-20")).words[0].id;
    await db.execute({ sql: "INSERT INTO daily_checks (participant_id, word_id, day, checked_at) VALUES (?, ?, ?, ?)", args: [adminId, wordId, "2026-09-20", new Date().toISOString()] });
    expect((await getDashboard(db, adminId, "2026-09-20")).words[0]).toMatchObject({ repeatCount: 1, checked: false });
    db.close();
  });
});
