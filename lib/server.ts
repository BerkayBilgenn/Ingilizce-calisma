import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { readSession } from "./auth";
import { ensureSchema, getDb } from "./db";

let schemaReady: Promise<void> | undefined;

export async function readyDb() {
  schemaReady ??= ensureSchema();
  await schemaReady;
  return getDb();
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
