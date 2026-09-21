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

function serializedId(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  return value._serialized || value.$1 || (value.user && value.server ? `${value.user}@${value.server}` : "");
}

function outgoingMatch(item, groupId, text, startedAt, allowMissingDestination = false) {
  if (!item?.fromMe || item.body !== text || Number(item.timestamp || 0) < startedAt - 2) return false;
  const destination = serializedId(item.to) || serializedId(item.id?.remote);
  return destination === groupId || (allowMissingDestination && !destination);
}

function outgoingWatcher(client, groupId, text, startedAt) {
  if (typeof client.on !== "function" || typeof client.off !== "function") return { wait: async () => null, stop() {} };
  let finish;
  const promise = new Promise((resolve) => {
    const handler = (item) => {
      if (outgoingMatch(item, groupId, text, startedAt)) finish(item);
    };
    finish = (item) => {
      client.off("message_create", handler);
      resolve(item);
    };
    client.on("message_create", handler);
  });
  return {
    async wait(timeoutMs) {
      const timer = setTimeout(() => finish(null), timeoutMs);
      try {
        return await promise;
      } finally {
        clearTimeout(timer);
      }
    },
    stop() { finish(null); },
  };
}

function confirmedMessage(item, allowSynthetic = false) {
  if (!item) return null;
  const id = serializedId(item.id);
  if (!id && !allowSynthetic) return null;
  return { messageId: id || `confirmed-${item.timestamp || Date.now()}` };
}

function withTimeout(operation, timeoutMs, message) {
  let timer;
  return Promise.race([
    Promise.resolve(operation),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function sendGroup(client, groupId, text, {
  sendTimeoutMs = 30000,
  confirmTimeoutMs = 15000,
  confirmAttempts = 6,
  confirmIntervalMs = 1000,
  historyTimeoutMs = 5000,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
} = {}) {
  const startedAt = Math.floor(Date.now() / 1000);
  const watcher = outgoingWatcher(client, groupId, text, startedAt);
  let message;
  let sendError;
  try {
    message = await withTimeout(
      client.sendMessage(groupId, text),
      sendTimeoutMs,
      `WhatsApp gönderimi ${sendTimeoutMs} ms içinde tamamlanmadı.`,
    );
  } catch (error) {
    sendError = error;
  }
  const returned = confirmedMessage(message);
  if (returned) {
    watcher.stop();
    return returned;
  }
  const eventMessage = confirmedMessage(await watcher.wait(confirmTimeoutMs), true);
  if (eventMessage) return eventMessage;
  if (typeof client.getChatById === "function") {
    for (let attempt = 0; attempt < confirmAttempts; attempt += 1) {
      try {
        const chat = await withTimeout(client.getChatById(groupId), historyTimeoutMs, "WhatsApp sohbet geçmişi açılamadı.");
        const recent = await withTimeout(chat?.fetchMessages({ limit: 30 }), historyTimeoutMs, "WhatsApp mesaj geçmişi okunamadı.");
        const confirmed = recent?.find((item) => outgoingMatch(item, groupId, text, startedAt, true));
        const result = confirmedMessage(confirmed, true);
        if (result) return result;
      } catch { /* Keep checking: WhatsApp Web may still be updating its local chat model. */ }
      if (attempt + 1 < confirmAttempts) await sleep(confirmIntervalMs);
    }
  }
  if (sendError) throw sendError;
  throw new Error("WhatsApp mesaj kimliğini döndürmedi; gönderim durumu belirsiz. Aynı mesaj otomatik tekrar edilmeyecek.");
}

module.exports = { createWhatsAppClient, listGroups, findGroupByName, sendGroup };
