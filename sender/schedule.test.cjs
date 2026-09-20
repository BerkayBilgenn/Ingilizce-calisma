const assert = require("node:assert/strict");
const { createScheduler } = require("./schedule.cjs");

(async () => {
  const calls = [];
  const scheduler = createScheduler({
    now: () => new Date(),
    claim: async () => ({ slotKey: "2026-09-20-12", message: "kalanlar" }),
    send: async (message) => { calls.push(message); return { messageId: "id-1" }; },
    complete: async (result) => { assert.equal(result.status, "sent"); },
  });
  assert.deepEqual(await scheduler.tick(), { sent: true });
  assert.deepEqual(calls, ["kalanlar"]);

  let completeResult;
  const uncertain = createScheduler({
    now: () => new Date(),
    claim: async () => ({ slotKey: "2026-09-20-16", message: "kalanlar" }),
    send: async () => { throw new Error("bağlantı koptu"); },
    complete: async (result) => { completeResult = result; },
  });
  assert.deepEqual(await uncertain.tick(), { uncertain: true, error: "bağlantı koptu" });
  assert.equal(completeResult.status, "uncertain");

  const unavailable = createScheduler({
    now: () => new Date(),
    claim: async () => { throw new Error("SITE_URL yanlış"); },
    send: async () => { throw new Error("gönderilmemeli"); },
    complete: async () => { throw new Error("tamamlanmamalı"); },
  });
  assert.deepEqual(await unavailable.tick(), { failed: true, error: "SITE_URL yanlış" });

  const errors = [];
  const reporting = createScheduler({
    now: () => new Date(),
    claim: async () => { throw new Error("site kapalı"); },
    send: async () => { throw new Error("gönderilmemeli"); },
    complete: async () => {},
    onFailure: (error) => errors.push(error),
    intervalMs: 25,
  });
  const stop = reporting.start();
  await new Promise((resolve) => setTimeout(resolve, 60));
  stop();
  assert.deepEqual(errors, ["site kapalı"]);

  let currentTime = new Date("2026-09-20T18:30:00Z");
  let claims = 0;
  const deferred = createScheduler({
    now: () => currentTime,
    notBefore: Date.parse("2026-09-20T21:00:00Z"),
    claim: async () => { claims += 1; return { skip: true }; },
    send: async () => { throw new Error("gönderilmemeli"); },
    complete: async () => {},
  });
  assert.deepEqual(await deferred.tick(), { skipped: true });
  assert.equal(claims, 0, "current uncertain slot must not be claimed again");
  currentTime = new Date("2026-09-20T21:00:00Z");
  assert.deepEqual(await deferred.tick(), { skipped: true });
  assert.equal(claims, 1, "next slot must resume automatically");
  console.log("sender schedule tests passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
