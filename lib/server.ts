import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { readSession } from "./auth";
import { ensureSchema, getDb } from "./db";
import { activateCurriculum } from "./store";
import { istanbulDay } from "./study";

let schemaReady: Promise<void> | undefined;

export async function readyDb() {
  schemaReady ??= ensureSchema();
  await schemaReady;
  const db = getDb();
  const participants = await db.execute("SELECT COUNT(*) AS count FROM participants");
  if (Number(participants.rows[0].count) > 0) await activateCurriculum(db, istanbulDay(new Date()));
  return db;
}

export function sessionId(request: NextRequest): number | null {
  return readSession(request.cookies.get("session")?.value);
}

export function secureMatch(received: unknown, expected: string | undefined): boolean {
  if (typeof received !== "string" || !expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
