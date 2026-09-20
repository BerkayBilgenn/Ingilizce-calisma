import { afterEach, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";

let directory: string | undefined;
afterEach(() => {
  vi.resetModules();
  delete process.env.DATABASE_URL;
  delete process.env.SETUP_SECRET;
  delete process.env.SESSION_SECRET;
  delete process.env.AGENT_SECRET;
  if (directory) rmSync(directory, { recursive: true, force: true });
  directory = undefined;
});

function request(path: string, data: unknown, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(data),
  });
}

function formRequest(path: string, values: Record<string, string>): NextRequest {
  const form = new URLSearchParams(values);
  return new NextRequest(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
}

it("protects setup and derives check identity from the login cookie", async () => {
  directory = mkdtempSync(join(tmpdir(), "kelime-api-"));
  process.env.DATABASE_URL = `file:${join(directory, "test.db")}`;
  process.env.SETUP_SECRET = "setup-secret-for-test";
  process.env.SESSION_SECRET = "session-secret-for-test-long-enough";
  const setup = await import("../app/api/setup/route");
  const login = await import("../app/api/login/route");
  const sets = await import("../app/api/sets/route");
  const checks = await import("../app/api/checks/route");
  const people = [
    { phone: "0537 000 00 00", name: "Ada", pin: "123456" },
    { phone: "0532 000 00 00", name: "Deniz", pin: "654321" },
  ];

  expect((await setup.POST(request("/api/setup", { people, secret: "wrong" }))).status).toBe(403);
  expect((await setup.POST(request("/api/setup", { people, secret: process.env.SETUP_SECRET }))).status).toBe(200);
  const memberLogin = await login.POST(request("/api/login", { phone: people[1].phone, pin: people[1].pin }));
  expect(memberLogin.status).toBe(200);
  const memberCookie = memberLogin.headers.get("set-cookie")?.split(";")[0];
  expect(memberCookie).toContain("session=");
  expect((await sets.POST(request("/api/sets", { words: [{ term: "apple", meaning: "elma" }] }, memberCookie))).status).toBe(403);

  const adminLogin = await login.POST(request("/api/login", { phone: people[0].phone, pin: people[0].pin }));
  const adminCookie = adminLogin.headers.get("set-cookie")?.split(";")[0];
  const created = await sets.POST(request("/api/sets", { words: [{ term: "apple", meaning: "elma" }] }, adminCookie));
  expect(created.status).toBe(200);
  const { getDb } = await import("../lib/db");
  const { getDashboard } = await import("../lib/store");
  const { istanbulDay } = await import("../lib/study");
  const db = getDb();
  const day = istanbulDay(new Date());
  const wordId = (await getDashboard(db, 1, day)).words[0].id;
  expect((await checks.POST(request("/api/checks", { wordId, checked: true, participantId: 1 }, memberCookie))).status).toBe(200);
  expect((await getDashboard(db, 1, day)).remaining).toBe(1);
  expect((await getDashboard(db, 2, day)).remaining).toBe(0);
  db.close();
});

it("supports a native form fallback when client hydration is unavailable", async () => {
  directory = mkdtempSync(join(tmpdir(), "kelime-api-form-"));
  process.env.DATABASE_URL = `file:${join(directory, "test.db")}`;
  process.env.SETUP_SECRET = "setup-secret-for-test";
  process.env.SESSION_SECRET = "session-secret-for-test-long-enough";
  const setup = await import("../app/api/setup/route");
  const response = await setup.POST(formRequest("/api/setup", {
    secret: process.env.SETUP_SECRET,
    name1: "Ada", phone1: "0537 000 00 00", pin1: "123456",
    name2: "Deniz", phone2: "0532 000 00 00", pin2: "654321",
    words: "apple = elma",
  }));
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe("http://localhost:3000/");
  expect(response.headers.get("set-cookie")).toContain("session=");
});

it("reports a missing session secret as a configuration error during login", async () => {
  directory = mkdtempSync(join(tmpdir(), "kelime-api-secret-"));
  process.env.DATABASE_URL = `file:${join(directory, "test.db")}`;
  process.env.SETUP_SECRET = "setup-secret-for-test";
  const setup = await import("../app/api/setup/route");
  const login = await import("../app/api/login/route");
  const people = [
    { phone: "0537 000 00 00", name: "Ada", pin: "123456" },
    { phone: "0532 000 00 00", name: "Deniz", pin: "654321" },
  ];
  expect((await setup.POST(request("/api/setup", { people, secret: process.env.SETUP_SECRET }))).status).toBe(200);
  const response = await login.POST(request("/api/login", { phone: people[0].phone, pin: people[0].pin }));
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "Vercel ayarlarında SESSION_SECRET eksik veya çok kısa." });
});

it("lets both signed-in participants add and remove words in the current set", async () => {
  directory = mkdtempSync(join(tmpdir(), "kelime-api-words-"));
  process.env.DATABASE_URL = `file:${join(directory, "test.db")}`;
  process.env.SETUP_SECRET = "setup-secret-for-test";
  process.env.SESSION_SECRET = "session-secret-for-test-long-enough";
  const setup = await import("../app/api/setup/route");
  const login = await import("../app/api/login/route");
  const sets = await import("../app/api/sets/route");
  const words = await import("../app/api/words/route");
  const people = [
    { phone: "0537 000 00 00", name: "Ada", pin: "123456" },
    { phone: "0532 000 00 00", name: "Deniz", pin: "654321" },
  ];
  await setup.POST(request("/api/setup", { people, secret: process.env.SETUP_SECRET }));
  const adminCookie = (await login.POST(request("/api/login", people[0]))).headers.get("set-cookie")?.split(";")[0];
  const memberCookie = (await login.POST(request("/api/login", people[1]))).headers.get("set-cookie")?.split(";")[0];
  expect((await sets.POST(request("/api/sets", { words: [{ term: "apple", meaning: "elma" }] }, adminCookie))).status).toBe(200);
  expect((await words.POST(request("/api/words", { term: "book", meaning: "kitap" }))).status).toBe(401);
  const added = await words.POST(request("/api/words", { term: "book", meaning: "kitap" }, memberCookie));
  expect(added.status).toBe(200);
  const { wordId } = await added.json();
  expect((await words.DELETE(new NextRequest("http://localhost:3000/api/words", { method: "DELETE", headers: { "content-type": "application/json", cookie: adminCookie || "" }, body: JSON.stringify({ wordId }) }))).status).toBe(200);
});

it("offers a new learning notice to the sender before a four-hour reminder", async () => {
  directory = mkdtempSync(join(tmpdir(), "kelime-api-notice-"));
  process.env.DATABASE_URL = `file:${join(directory, "test.db")}`;
  process.env.SETUP_SECRET = "setup-secret-for-test";
  process.env.SESSION_SECRET = "session-secret-for-test-long-enough";
  process.env.AGENT_SECRET = "agent-secret-for-test";
  const setup = await import("../app/api/setup/route");
  const login = await import("../app/api/login/route");
  const sets = await import("../app/api/sets/route");
  const checks = await import("../app/api/checks/route");
  const claim = await import("../app/api/agent/claim/route");
  const complete = await import("../app/api/agent/complete/route");
  const people = [
    { phone: "0537 000 00 00", name: "Ada", pin: "123456" },
    { phone: "0532 000 00 00", name: "Deniz", pin: "654321" },
  ];
  await setup.POST(request("/api/setup", { people, secret: process.env.SETUP_SECRET }));
  const adminCookie = (await login.POST(request("/api/login", people[0]))).headers.get("set-cookie")?.split(";")[0];
  await sets.POST(request("/api/sets", { words: [{ term: "apple", meaning: "elma" }] }, adminCookie));
  const { getDb } = await import("../lib/db");
  const db = getDb();
  const wordId = Number((await db.execute("SELECT id FROM words LIMIT 1")).rows[0].id);
  await checks.POST(request("/api/checks", { wordId, checked: true }, adminCookie));
  const senderRequest = (path: string, body?: unknown) => new NextRequest(`http://localhost:3000${path}`, { method: "POST", headers: { authorization: `Bearer ${process.env.AGENT_SECRET}`, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const claimed = await claim.POST(senderRequest("/api/agent/claim"));
  const payload = await claimed.json();
  expect(payload.slotKey).toMatch(/^notice-\d+$/);
  expect(payload.message).toBe("📚 Ada “apple” kelimesini ezberledi.");
  expect((await complete.POST(senderRequest("/api/agent/complete", { slotKey: payload.slotKey, status: "sent", messageId: "wa-1" }))).status).toBe(200);
  expect((await db.execute("SELECT status FROM learning_notices")).rows[0].status).toBe("sent");
  expect(await (await claim.POST(senderRequest("/api/agent/claim?noticesOnly=1"))).json()).toEqual({ skip: true, reason: "scheduled_paused" });
  expect((await db.execute("SELECT COUNT(*) AS count FROM send_runs")).rows[0].count).toBe(0);
  db.close();
});
