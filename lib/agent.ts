import type { Client } from "@libsql/client";
import { istanbulDay } from "./study";
import { getDashboard, getParticipant, getLatestSet, type StudyWord } from "./store";

export type ReminderSnapshot = { day: string; people: { name: string; remaining: Pick<StudyWord, "term" | "meaning">[]; learned: Pick<StudyWord, "term" | "meaning">[] }[] };

export function slotKey(date: Date): string | null {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  if (minute >= 5 || hour % 4 !== 0) return null;
  return istanbulDay(date) + "-" + String(hour).padStart(2, "0");
}

export function formatMessage(snapshot: ReminderSnapshot): string | null {
  const active = snapshot.people.filter((person) => person.remaining.length > 0 || person.learned.length > 0);
  if (!active.length) return null;
  const lines = ["📚 Kelime günlüğü · " + snapshot.day, ""];
  for (const person of active) {
    if (person.remaining.length > 0) {
      lines.push("👤 " + person.name + " · kalan kelimeler");
      for (const word of person.remaining) lines.push("• " + word.term + " — " + word.meaning);
    } else {
      lines.push("✅ " + person.name + " · bugün tüm kelimeleri öğrendim");
      lines.push("Bugün öğrendiklerim:");
      for (const word of person.learned) lines.push("• " + word.term + " — " + word.meaning);
    }
    lines.push("");
  }
  lines.push("Bir sonraki hatırlatma 4 saat sonra.");
  return lines.join("\n");
}

export async function buildSnapshot(db: Client, day: string): Promise<ReminderSnapshot> {
  const people = await db.execute("SELECT id, name FROM participants ORDER BY id");
  return { day, people: await Promise.all(people.rows.slice(0, 2).map(async (row) => {
    const dashboard = await getDashboard(db, Number(row.id), day);
    return {
      name: String(row.name),
      remaining: dashboard.words.filter((word) => !word.checked).map(({ term, meaning }) => ({ term, meaning })),
      learned: dashboard.words.filter((word) => word.checked).map(({ term, meaning }) => ({ term, meaning })),
    };
  })) };
}

export async function claimSlot(db: Client, key: string, message: string | null): Promise<boolean> {
  const result = await db.execute({ sql: "INSERT OR IGNORE INTO send_runs (slot_key, status, message) VALUES (?, ?, ?)", args: [key, message ? "claimed" : "skipped", message] });
  return Number(result.rowsAffected) === 1;
}

export async function completeSlot(db: Client, key: string, status: "sent" | "failed" | "uncertain", messageId?: string, error?: string): Promise<void> {
  await db.execute({ sql: "UPDATE send_runs SET status = ?, message_id = ?, error = ?, completed_at = CURRENT_TIMESTAMP WHERE slot_key = ?", args: [status, messageId || null, error || null, key] });
}

export async function touchAgent(db: Client, connected: boolean, groupName?: string, success?: boolean): Promise<void> {
  await db.execute({ sql: "INSERT INTO agent_status (id, connected, group_name, last_seen, last_success) VALUES (1, ?, ?, CURRENT_TIMESTAMP, ?) ON CONFLICT(id) DO UPDATE SET connected = excluded.connected, group_name = COALESCE(excluded.group_name, agent_status.group_name), last_seen = excluded.last_seen, last_success = COALESCE(excluded.last_success, agent_status.last_success)", args: [connected ? 1 : 0, groupName || null, success ? new Date().toISOString() : null] });
}
