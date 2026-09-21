const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { sendGroup } = require("./whatsapp.cjs");

(async () => {
  const client = { sendMessage: async () => undefined };
  await assert.rejects(sendGroup(client, "group@g.us", "kelimeler"), /kimliğini döndürmedi/);
  client.sendMessage = async () => ({});
  await assert.rejects(sendGroup(client, "group@g.us", "kelimeler"), /kimliğini döndürmedi/);
  client.sendMessage = async () => ({ id: { _serialized: "message-1" } });
  assert.deepEqual(await sendGroup(client, "group@g.us", "kelimeler"), { messageId: "message-1" });

  const eventClient = new EventEmitter();
  eventClient.sendMessage = async () => {
    setImmediate(() => eventClient.emit("message_create", {
      fromMe: true,
      to: "group@g.us",
      body: "kelimeler",
      timestamp: Math.floor(Date.now() / 1000),
      id: { $1: "message-event" },
    }));
    return undefined;
  };
  assert.deepEqual(await sendGroup(eventClient, "group@g.us", "kelimeler", { confirmTimeoutMs: 100 }), { messageId: "message-event" });

  const ambiguousEventClient = new EventEmitter();
  ambiguousEventClient.sendMessage = async () => {
    setImmediate(() => ambiguousEventClient.emit("message_create", {
      fromMe: true,
      body: "kelimeler",
      timestamp: Math.floor(Date.now() / 1000),
      id: { $1: "wrong-chat" },
    }));
    return undefined;
  };
  await assert.rejects(sendGroup(ambiguousEventClient, "group@g.us", "kelimeler", { confirmTimeoutMs: 20 }), /kimliğini döndürmedi/);

  client.sendMessage = async () => ({});
  let checks = 0;
  client.getChatById = async () => ({
    fetchMessages: async () => ++checks < 2 ? [] : [{ fromMe: true, body: "kelimeler", timestamp: Math.floor(Date.now() / 1000), id: { $1: "message-2" } }],
  });
  assert.deepEqual(await sendGroup(client, "group@g.us", "kelimeler", { confirmAttempts: 2, confirmIntervalMs: 0 }), { messageId: "message-2" });

  const thrownButSent = new EventEmitter();
  thrownButSent.sendMessage = async () => {
    setImmediate(() => thrownButSent.emit("message_create", { fromMe: true, to: "group@g.us", body: "kelimeler", timestamp: Math.floor(Date.now() / 1000), id: { _serialized: "message-after-error" } }));
    throw new Error("Promise was collected");
  };
  assert.deepEqual(await sendGroup(thrownButSent, "group@g.us", "kelimeler", { confirmTimeoutMs: 100 }), { messageId: "message-after-error" });

  const hungButSent = new EventEmitter();
  hungButSent.sendMessage = async () => new Promise(() => {});
  setImmediate(() => hungButSent.emit("message_create", {
    fromMe: true,
    to: "group@g.us",
    body: "kelimeler",
    timestamp: Math.floor(Date.now() / 1000),
    id: { _serialized: "message-after-timeout" },
  }));
  const hungResult = await Promise.race([
    sendGroup(hungButSent, "group@g.us", "kelimeler", { sendTimeoutMs: 20, confirmTimeoutMs: 100 }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("sendGroup takılı kaldı")), 250)),
  ]);
  assert.deepEqual(hungResult, { messageId: "message-after-timeout" });

  const lateEventClient = new EventEmitter();
  lateEventClient.sendMessage = async () => new Promise(() => {});
  setTimeout(() => lateEventClient.emit("message_create", {
    fromMe: true,
    to: "group@g.us",
    body: "geç gelen onay",
    timestamp: Math.floor(Date.now() / 1000),
    id: { _serialized: "late-message" },
  }), 30);
  assert.deepEqual(
    await sendGroup(lateEventClient, "group@g.us", "geç gelen onay", { sendTimeoutMs: 20, confirmTimeoutMs: 20 }),
    { messageId: "late-message" },
  );

  const hungHistoryClient = new EventEmitter();
  hungHistoryClient.sendMessage = async () => undefined;
  hungHistoryClient.getChatById = async () => new Promise(() => {});
  await assert.rejects(Promise.race([
    sendGroup(hungHistoryClient, "group@g.us", "geçmiş takıldı", {
      sendTimeoutMs: 10,
      confirmTimeoutMs: 10,
      confirmAttempts: 1,
      historyTimeoutMs: 10,
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("geçmiş kontrolü takılı kaldı")), 150)),
  ]), /kimliğini döndürmedi/);
  console.log("sender send tests passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
