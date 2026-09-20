const assert = require("node:assert/strict");
const { sendGroup } = require("./whatsapp.cjs");

(async () => {
  const client = { sendMessage: async () => undefined };
  await assert.rejects(sendGroup(client, "group@g.us", "kelimeler"), /kimliğini döndürmedi/);
  client.sendMessage = async () => ({ id: { _serialized: "message-1" } });
  assert.deepEqual(await sendGroup(client, "group@g.us", "kelimeler"), { messageId: "message-1" });

  client.sendMessage = async () => undefined;
  client.getChatById = async () => ({
    fetchMessages: async () => [{ fromMe: true, body: "kelimeler", timestamp: Math.floor(Date.now() / 1000), id: { _serialized: "message-2" } }],
  });
  assert.deepEqual(await sendGroup(client, "group@g.us", "kelimeler"), { messageId: "message-2" });
  console.log("sender send tests passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
