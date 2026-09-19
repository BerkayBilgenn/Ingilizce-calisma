const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

function createWhatsAppClient({ sessionPath = "./data/whatsapp", onState = () => {}, onQr = () => {} } = {}) {
  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: sessionPath }),
    // Always load the current WhatsApp Web page. A cached page can become
    // stale and make the first injection race with a navigation.
    webVersionCache: { type: "none" },
    authTimeoutMs: 60000,
  });
  client.on("qr", (value) => { qrcode.generate(value, { small: true }); onQr(value); });
  client.on("ready", () => onState("ready"));
  client.on("authenticated", () => onState("authenticated"));
  client.on("auth_failure", (error) => onState("auth_failure", error));
  client.on("disconnected", (reason) => onState("disconnected", reason));
  return client;
}

async function listGroups(client) {
  try {
    const chats = await client.getChats();
    return chats.filter((chat) => chat.isGroup).map((chat) => ({ id: chat.id._serialized, name: chat.name }));
  } catch (error) {
    // WhatsApp Web occasionally changes its internal serializers before
    // whatsapp-web.js catches up. In that case getChats() throws a minified
    // browser error even though the session is ready. Read only the small
    // fields needed for group selection directly from the live collection.
    if (!client.pupPage) throw error;
    console.warn("WhatsApp grup listesi standart API ile okunamadı; doğrudan oturum verisi deneniyor.");
    try {
      const groups = await client.pupPage.evaluate(() => {
        const collection = window.require("WAWebCollections").Chat;
        const models = collection.getModelsArray();
        return models.map((chat) => {
          let id = "";
          let name = "";
          let isGroup = false;
          try {
            const wid = chat.id;
            id = wid?._serialized || (wid?.user && wid?.server ? `${wid.user}@${wid.server}` : "");
            isGroup = Boolean(id && id.endsWith("@g.us"));
            if (!isGroup && typeof wid?.isGroup === "function") isGroup = Boolean(wid.isGroup());
          } catch {}
          try {
            name = String(chat.formattedTitle || chat.name || chat.subject || "");
          } catch {}
          return { id, name, isGroup };
        }).filter((chat) => chat.isGroup && chat.id && chat.name);
      });
      return groups;
    } catch (fallbackError) {
      fallbackError.cause = error;
      throw fallbackError;
    }
  }
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
