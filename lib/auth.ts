import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const sessionDurationMs = 30 * 86_400_000;

export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  if (!/^5\d{9}$/.test(digits)) throw new Error("Geçerli bir cep telefonu numarası girin.");
  return `+90${digits}`;
}

export async function hashPin(pin: string): Promise<string> {
  if (!/^\d{6}$/.test(pin)) throw new Error("PIN 6 rakam olmalı.");
  const salt = randomBytes(16);
  const hash = (await scrypt(pin, salt, 64)) as Buffer;
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex || !/^[0-9a-f]{32}$/.test(saltHex) || !/^[0-9a-f]{128}$/.test(hashHex)) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = (await scrypt(pin, Buffer.from(saltHex, "hex"), expected.length)) as Buffer;
  return timingSafeEqual(actual, expected);
}

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 24) throw new Error("SESSION_SECRET must be at least 24 characters");
  return secret;
}

function signature(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function issueSession(participantId: number, now = Date.now()): string {
  if (!Number.isSafeInteger(participantId) || participantId <= 0) throw new Error("Invalid participant id");
  const payload = `${participantId}.${now + sessionDurationMs}`;
  return `${payload}.${signature(payload)}`;
}

export function readSession(token: string | undefined, now = Date.now()): number | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [idText, expiresText, provided] = parts;
  const id = Number(idText);
  const expires = Number(expiresText);
  if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(expires) || expires <= now) return null;
  const expected = Buffer.from(signature(`${idText}.${expiresText}`));
  const supplied = Buffer.from(provided);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  return id;
}
