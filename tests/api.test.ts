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
