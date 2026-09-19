import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hashPin, issueSession, normalizePhone, readSession, verifyPin } from "../lib/auth";

beforeEach(() => { process.env.SESSION_SECRET = "test-secret-with-enough-length-for-hmac"; });
afterEach(() => { delete process.env.SESSION_SECRET; });

describe("phone identity", () => {
  it("maps Turkish mobile formats to one key", () => {
    expect(normalizePhone("0537 000 00 00")).toBe("+905370000000");
    expect(normalizePhone("905370000000")).toBe("+905370000000");
    expect(normalizePhone("+90 (537) 000-00-00")).toBe("+905370000000");
  });

  it("rejects non-mobile and malformed numbers", () => {
    expect(() => normalizePhone("0212 000 00 00")).toThrow();
    expect(() => normalizePhone("0537000000")).toThrow();
  });
});

describe("private credentials", () => {
  it("verifies a PIN without storing the PIN", async () => {
    const hash = await hashPin("123456");
    expect(hash).not.toContain("123456");
    expect(await verifyPin("123456", hash)).toBe(true);
    expect(await verifyPin("654321", hash)).toBe(false);
  });

  it("rejects altered and expired sessions", () => {
    const start = Date.parse("2026-09-20T00:00:00Z");
    const token = issueSession(7, start);
    expect(readSession(token, start + 1000)).toBe(7);
    expect(readSession(`${token}x`, start + 1000)).toBeNull();
    expect(readSession(token, start + 31 * 86_400_000)).toBeNull();
  });
});
