import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb, ensureSchema } from "../lib/db";
import { addActiveWord, authenticate, createInitialSetup, createSet, getDashboard, removeActiveWord, setDailyCheck } from "../lib/store";

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

  it("queues one learning notice, cancels it on undo, and restores it on recheck", async () => {
    const db = await database();
    const [adminId] = await createInitialSetup(db, people);
    await createSet(db, adminId, [{ term: "apple", meaning: "elma" }], "2026-09-20");
    const wordId = (await getDashboard(db, adminId, "2026-09-20")).words[0].id;
    await setDailyCheck(db, adminId, wordId, true, "2026-09-20");
    await setDailyCheck(db, adminId, wordId, true, "2026-09-20");
    let result = await db.execute("SELECT message, status FROM learning_notices");
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].message).toBe("📚 Ada “apple” kelimesini 1/3 kez tekrar etti.");
    expect(result.rows[0].status).toBe("pending");
    await setDailyCheck(db, adminId, wordId, false, "2026-09-20");
    expect((await getDashboard(db, adminId, "2026-09-20")).words[0].repeatCount).toBe(1);
    await setDailyCheck(db, adminId, wordId, false, "2026-09-20");
    result = await db.execute("SELECT status FROM learning_notices");
    expect(result.rows[0].status).toBe("cancelled");
    await setDailyCheck(db, adminId, wordId, true, "2026-09-20");
    result = await db.execute("SELECT status FROM learning_notices");
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].status).toBe("pending");
    await removeActiveWord(db, adminId, wordId, "2026-09-20");
    result = await db.execute("SELECT status FROM learning_notices");
    expect(result.rows[0].status).toBe("cancelled");
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
