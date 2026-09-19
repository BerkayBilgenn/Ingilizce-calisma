const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

function createWhatsAppClient({ sessionPath = "./data/whatsapp", onState = () => {}, onQr = () => {} } = {}) {
  const client = new Client({ authStrategy: new LocalAuth({ dataPath: sessionPath }) });
  client.on("qr", (value) => { qrcode.generate(value, { small: true }); onQr(value); });
  client.on("ready", () => onState("ready"));
  client.on("authenticated", () => onState("authenticated"));
  client.on("auth_failure", (error) => onState("auth_failure", error));
  client.on("disconnected", (reason) => onState("disconnected", reason));
  return client;
}

async function listGroups(client) {
  const chats = await client.getChats();
  return chats.filter((chat) => chat.isGroup).map((chat) => ({ id: chat.id._serialized, name: chat.name }));
}

function findGroupByName(groups, name) {
  const normalized = String(name || "").trim().toLocaleLowerCase("tr-TR");
  return groups.find((group) => group.name.trim().toLocaleLowerCase("tr-TR") === normalized) || null;
}

async function sendGroup(client, groupId, text) {
  const message = await client.sendMessage(groupId, text);
  return { messageId: message.id._serialized };
}

module.exports = { createWhatsAppClient, listGroups, findGroupByName, sendGroup };
