import { createHash } from "node:crypto";
import type { Client } from "@libsql/client";
import { hashPin, normalizePhone, verifyPin } from "./auth";
import { activeOn, dayIndex } from "./study";

export type PersonInput = { phone: string; name: string; pin: string };
export type WordInput = { term: string; meaning: string };
export type Participant = { id: number; phone: string; name: string; role: "admin" | "member" };
export type StudyWord = { id: number; term: string; meaning: string; checked: boolean };
export type Dashboard = {
  person: Participant;
  set: { id: number; startDay: string; dayNumber: number } | null;
  words: StudyWord[];
  remaining: number;
  completed: number;
  history: { day: string; completed: number }[];
};

function rowNumber(value: unknown): number { return Number(value); }
function rowString(value: unknown): string { return String(value); }

export async function createInitialSetup(db: Client, people: PersonInput[]): Promise<[number, number]> {
  if (people.length !== 2) throw new Error("Exactly two people are required");
  const normalized = people.map((person) => ({
    phone: normalizePhone(person.phone),
    name: person.name.trim(),
    pin: person.pin,
  }));
  if (normalized.some((person) => !person.name || person.name.length > 60)) throw new Error("Names must be 1–60 characters");
  if (normalized[0].phone === normalized[1].phone) throw new Error("Phone numbers must differ");
  const hashes = await Promise.all(normalized.map((person) => hashPin(person.pin)));
  const tx = await db.transaction("write");
  try {
    const existing = await tx.execute("SELECT COUNT(*) AS count FROM participants");
    if (rowNumber(existing.rows[0].count) !== 0) throw new Error("Setup has already been completed");
    const ids: number[] = [];
    for (let index = 0; index < 2; index++) {
      const result = await tx.execute({
        sql: "INSERT INTO participants (phone, name, pin_hash, role) VALUES (?, ?, ?, ?)",
        args: [normalized[index].phone, normalized[index].name, hashes[index], index === 0 ? "admin" : "member"],
      });
      ids.push(Number(result.lastInsertRowid));
    }
    await tx.commit();
    return [ids[0], ids[1]];
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

export async function authenticate(db: Client, rawPhone: string, pin: string, now = Date.now()): Promise<Participant | null> {
  let phone: string;
  try { phone = normalizePhone(rawPhone); } catch { return null; }
  const phoneHash = createHash("sha256").update(phone).digest("hex");
  const attemptsResult = await db.execute({ sql: "SELECT count, locked_until FROM login_attempts WHERE phone_hash = ?", args: [phoneHash] });
  const previous = attemptsResult.rows[0];
  if (previous && rowNumber(previous.locked_until) > now) return null;
  const result = await db.execute({ sql: "SELECT id, phone, name, role, pin_hash FROM participants WHERE phone = ?", args: [phone] });
  const row = result.rows[0];
  const valid = row ? await verifyPin(pin, rowString(row.pin_hash)) : false;
  if (valid) {
    await db.execute({ sql: "DELETE FROM login_attempts WHERE phone_hash = ?", args: [phoneHash] });
    return { id: rowNumber(row.id), phone: rowString(row.phone), name: rowString(row.name), role: row.role === "admin" ? "admin" : "member" };
  }
  const count = previous && rowNumber(previous.locked_until) === 0 ? rowNumber(previous.count) + 1 : 1;
  const lockedUntil = count >= 5 ? now + 15 * 60_000 : 0;
  await db.execute({
    sql: "INSERT INTO login_attempts (phone_hash, count, locked_until) VALUES (?, ?, ?) ON CONFLICT(phone_hash) DO UPDATE SET count = excluded.count, locked_until = excluded.locked_until",
    args: [phoneHash, count, lockedUntil],
  });
  return null;
}

export async function getParticipant(db: Client, id: number): Promise<Participant | null> {
  const result = await db.execute({ sql: "SELECT id, phone, name, role FROM participants WHERE id = ?", args: [id] });
  const row = result.rows[0];
  return row ? { id: rowNumber(row.id), phone: rowString(row.phone), name: rowString(row.name), role: row.role === "admin" ? "admin" : "member" } : null;
}

export async function getLatestSet(db: Client): Promise<{ id: number; startDay: string } | null> {
  const result = await db.execute("SELECT id, start_day FROM sets ORDER BY id DESC LIMIT 1");
  const row = result.rows[0];
  return row ? { id: rowNumber(row.id), startDay: rowString(row.start_day) } : null;
}

export async function createSet(db: Client, adminId: number, inputWords: WordInput[], startDay: string): Promise<number> {
  const admin = await getParticipant(db, adminId);
  if (admin?.role !== "admin") throw new Error("Only the admin can create word sets");
  const words = inputWords.map((word) => ({ term: word.term.trim(), meaning: word.meaning.trim() }));
  if (words.length < 1 || words.length > 100) throw new Error("A set needs 1–100 words");
  if (words.some((word) => !word.term || !word.meaning || word.term.length > 100 || word.meaning.length > 300)) throw new Error("Invalid word or meaning");
  if (new Set(words.map((word) => word.term.toLocaleLowerCase("en"))).size !== words.length) throw new Error("Duplicate words are not allowed");
  const latest = await getLatestSet(db);
  if (latest && activeOn(latest.startDay, startDay)) throw new Error("An active set already exists");
  const tx = await db.transaction("write");
  try {
    const result = await tx.execute({ sql: "INSERT INTO sets (start_day) VALUES (?)", args: [startDay] });
    const setId = Number(result.lastInsertRowid);
    for (const [position, word] of words.entries()) {
      await tx.execute({ sql: "INSERT INTO words (set_id, term, meaning, position) VALUES (?, ?, ?, ?)", args: [setId, word.term, word.meaning, position] });
    }
    await tx.commit();
    return setId;
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

async function editableSet(db: Client, participantId: number, day: string) {
  const person = await getParticipant(db, participantId);
  const set = await getLatestSet(db);
  if (!person || !set || !activeOn(set.startDay, day)) throw new Error("Aktif haftalık liste bulunamadı.");
  return set;
}

export async function addActiveWord(db: Client, participantId: number, input: WordInput, day: string): Promise<number> {
  const set = await editableSet(db, participantId, day);
  const term = typeof input?.term === "string" ? input.term.trim() : "";
  const meaning = typeof input?.meaning === "string" ? input.meaning.trim() : "";
  if (!term || !meaning || term.length > 100 || meaning.length > 300) throw new Error("Kelime ve Türkçesini girin.");
  const tx = await db.transaction("write");
  try {
    const existing = await tx.execute({
      sql: `SELECT w.id, r.word_id AS removed FROM words w LEFT JOIN word_removals r ON r.word_id = w.id
            WHERE w.set_id = ? AND lower(w.term) = lower(?) LIMIT 1`,
      args: [set.id, term],
    });
    const row = existing.rows[0];
    if (row && row.removed === null) throw new Error("Bu kelime listede zaten var.");
    const count = await tx.execute({ sql: `SELECT COUNT(*) AS count FROM words w LEFT JOIN word_removals r ON r.word_id = w.id WHERE w.set_id = ? AND r.word_id IS NULL`, args: [set.id] });
    if (Number(count.rows[0].count) >= 100) throw new Error("Haftalık listede en fazla 100 kelime olabilir.");
    const last = await tx.execute({ sql: "SELECT COALESCE(MAX(position), -1) AS position FROM words WHERE set_id = ?", args: [set.id] });
    const position = Number(last.rows[0].position) + 1;
    let id: number;
    if (row) {
      id = Number(row.id);
      await tx.execute({ sql: "UPDATE words SET meaning = ?, position = ? WHERE id = ?", args: [meaning, position, id] });
      await tx.execute({ sql: "DELETE FROM word_removals WHERE word_id = ?", args: [id] });
    } else {
      const result = await tx.execute({ sql: "INSERT INTO words (set_id, term, meaning, position) VALUES (?, ?, ?, ?)", args: [set.id, term, meaning, position] });
      id = Number(result.lastInsertRowid);
    }
    await tx.commit();
    return id;
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

export async function removeActiveWord(db: Client, participantId: number, wordId: number, day: string): Promise<void> {
  const set = await editableSet(db, participantId, day);
  if (!Number.isSafeInteger(wordId) || wordId <= 0) throw new Error("Geçersiz kelime.");
  const tx = await db.transaction("write");
  try {
    const result = await tx.execute({
      sql: `INSERT OR IGNORE INTO word_removals (word_id)
            SELECT w.id FROM words w WHERE w.id = ? AND w.set_id = ?`,
      args: [wordId, set.id],
    });
    if (Number(result.rowsAffected) !== 1) throw new Error("Kelime aktif listede bulunamadı.");
    await tx.execute({ sql: "UPDATE learning_notices SET status = 'cancelled' WHERE word_id = ? AND status = 'pending'", args: [wordId] });
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

export async function getDashboard(db: Client, participantId: number, day: string): Promise<Dashboard> {
  const person = await getParticipant(db, participantId);
  if (!person) throw new Error("Participant not found");
  const latest = await getLatestSet(db);
  if (!latest || !activeOn(latest.startDay, day)) return { person, set: null, words: [], remaining: 0, completed: 0, history: [] };
  const result = await db.execute({
    sql: `SELECT w.id, w.term, w.meaning, c.word_id IS NOT NULL AS checked
          FROM words w LEFT JOIN daily_checks c
          ON c.word_id = w.id AND c.participant_id = ? AND c.day = ?
          WHERE w.set_id = ? AND NOT EXISTS (SELECT 1 FROM word_removals r WHERE r.word_id = w.id) ORDER BY w.position`,
    args: [participantId, day, latest.id],
  });
  const words = result.rows.map((row) => ({
    id: rowNumber(row.id), term: rowString(row.term), meaning: rowString(row.meaning), checked: Boolean(rowNumber(row.checked)),
  }));
  const historyResult = await db.execute({
    sql: `SELECT c.day, COUNT(*) AS completed FROM daily_checks c JOIN words w ON w.id = c.word_id
          WHERE c.participant_id = ? AND w.set_id = ? GROUP BY c.day ORDER BY c.day`,
    args: [participantId, latest.id],
  });
  return {
    person,
    set: { id: latest.id, startDay: latest.startDay, dayNumber: dayIndex(latest.startDay, day) },
    words,
    remaining: words.filter((word) => !word.checked).length,
    completed: words.filter((word) => word.checked).length,
    history: historyResult.rows.map((row) => ({ day: rowString(row.day), completed: rowNumber(row.completed) })),
  };
}

export async function setDailyCheck(db: Client, participantId: number, wordId: number, checked: boolean, day: string): Promise<void> {
  const person = await getParticipant(db, participantId);
  const latest = await getLatestSet(db);
  if (!person || !latest || !activeOn(latest.startDay, day)) throw new Error("No active set");
  const word = await db.execute({ sql: "SELECT id, term FROM words WHERE id = ? AND set_id = ? AND NOT EXISTS (SELECT 1 FROM word_removals WHERE word_id = words.id)", args: [wordId, latest.id] });
  if (!word.rows.length) throw new Error("Word is not in the active set");
  const tx = await db.transaction("write");
  try {
    if (checked) {
      const result = await tx.execute({
        sql: "INSERT OR IGNORE INTO daily_checks (participant_id, word_id, day, checked_at) VALUES (?, ?, ?, ?)",
        args: [participantId, wordId, day, new Date().toISOString()],
      });
      if (Number(result.rowsAffected) === 1) {
        const message = `📚 ${person.name} “${String(word.rows[0].term)}” kelimesini ezberledi.`;
        await tx.execute({
          sql: `INSERT INTO learning_notices (participant_id, word_id, day, message, status) VALUES (?, ?, ?, ?, 'pending')
                ON CONFLICT(participant_id, word_id, day) DO UPDATE SET
                status = CASE WHEN learning_notices.status = 'cancelled' THEN 'pending' ELSE learning_notices.status END,
                created_at = CASE WHEN learning_notices.status = 'cancelled' THEN CURRENT_TIMESTAMP ELSE learning_notices.created_at END`,
          args: [participantId, wordId, day, message],
        });
      }
    } else {
      await tx.execute({ sql: "DELETE FROM daily_checks WHERE participant_id = ? AND word_id = ? AND day = ?", args: [participantId, wordId, day] });
      await tx.execute({ sql: "UPDATE learning_notices SET status = 'cancelled' WHERE participant_id = ? AND word_id = ? AND day = ? AND status = 'pending'", args: [participantId, wordId, day] });
    }
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}
