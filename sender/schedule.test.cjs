const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { claimPath, createScheduler } = require("./schedule.cjs");
const { sendGroup } = require("./whatsapp.cjs");

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
  assert.equal(claimPath(new Date("2026-09-20T18:30:00Z"), Date.parse("2026-09-20T21:00:00Z")), "/api/agent/claim?noticesOnly=1");
  assert.equal(claimPath(new Date("2026-09-20T21:00:00Z"), Date.parse("2026-09-20T21:00:00Z")), "/api/agent/claim");

  const releaseSends = [];
  let overlappingClaims = 0;
  const serial = createScheduler({
    now: () => new Date(),
    claim: async () => { overlappingClaims += 1; return { slotKey: `notice-${overlappingClaims}`, message: "öğrenildi" }; },
    send: () => new Promise((resolve) => { releaseSends.push(resolve); }),
    complete: async () => {},
  });
  const firstSend = serial.tick();
  await new Promise((resolve) => setImmediate(resolve));
  const secondSend = serial.tick();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(overlappingClaims, 1, "a second poll must not start while WhatsApp is sending");
  assert.deepEqual(await secondSend, { skipped: true });
  releaseSends[0]({ messageId: "wa-1" });
  assert.deepEqual(await firstSend, { sent: true });

  const sentSlots = [];
  const observable = createScheduler({
    now: () => new Date(),
    claim: async () => ({ slotKey: "2026-09-21-22", message: "gece raporu" }),
    send: async () => ({ messageId: "wa-22" }),
    complete: async () => {},
    onSent: (result) => sentSlots.push(result),
  });
  assert.deepEqual(await observable.tick(), { sent: true });
  assert.deepEqual(sentSlots, [{ slotKey: "2026-09-21-22", messageId: "wa-22" }]);

  const loggingCompletions = [];
  const loggingFailure = createScheduler({
    now: () => new Date(),
    claim: async () => ({ slotKey: "slot-with-log-error", message: "rapor" }),
    send: async () => ({ messageId: "sent-before-log-error" }),
    complete: async (result) => loggingCompletions.push(result.status),
    onSent: () => { throw new Error("log yazılamadı"); },
  });
  assert.deepEqual(await loggingFailure.tick(), { sent: true });
  assert.deepEqual(loggingCompletions, ["sent"]);

  const stuckClient = new EventEmitter();
  stuckClient.sendMessage = async () => undefined;
  stuckClient.getChatById = async () => new Promise(() => {});
  let recoveryAttempt = 0;
  const recoveryCompletions = [];
  const recovering = createScheduler({
    now: () => new Date(),
    claim: async () => ({ slotKey: `slot-${++recoveryAttempt}`, message: "rapor" }),
    send: async (message) => recoveryAttempt === 1
      ? sendGroup(stuckClient, "group@g.us", message, { confirmTimeoutMs: 10, confirmAttempts: 1, historyTimeoutMs: 10 })
      : { messageId: "recovered-message" },
    complete: async (result) => recoveryCompletions.push(result),
  });
  const firstRecovery = await Promise.race([
    recovering.tick(),
    new Promise((_, reject) => setTimeout(() => reject(new Error("ilk zamanlayıcı dilimi takılı kaldı")), 200)),
  ]);
  assert.equal(firstRecovery.uncertain, true);
  assert.deepEqual(await recovering.tick(), { sent: true });
  assert.deepEqual(recoveryCompletions.map(({ slotKey, status }) => ({ slotKey, status })), [
    { slotKey: "slot-1", status: "uncertain" },
    { slotKey: "slot-2", status: "sent" },
  ]);
  console.log("sender schedule tests passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
