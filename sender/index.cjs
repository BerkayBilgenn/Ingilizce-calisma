const fs = require("node:fs");
const path = require("node:path");
const envFile = path.join(__dirname, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}
const { createScheduler } = require("./schedule.cjs");
const { createWhatsAppClient, findGroupByName, listGroups, sendGroup } = require("./whatsapp.cjs");

function persistGroupId(id) {
  if (!fs.existsSync(envFile)) return;
  const lines = fs.readFileSync(envFile, "utf8").split(/\r?\n/);
  const index = lines.findIndex((line) => line.startsWith("WHATSAPP_GROUP_ID="));
  if (index === -1) lines.push(`WHATSAPP_GROUP_ID=${id}`);
  else lines[index] = `WHATSAPP_GROUP_ID=${id}`;
  fs.writeFileSync(envFile, lines.filter((line, i, all) => i < all.length - 1 || line !== "").join("\n"));
}

const siteUrl = process.env.SITE_URL;
const agentSecret = process.env.AGENT_SECRET;
let groupId = process.env.WHATSAPP_GROUP_ID || "";
const groupName = process.env.WHATSAPP_GROUP_NAME || "";
if (!siteUrl || !agentSecret) throw new Error("SITE_URL ve AGENT_SECRET gerekli.");

async function api(path, options = {}) {
  const response = await fetch(siteUrl.replace(/\/$/, "") + path, { ...options, headers: { authorization: "Bearer " + agentSecret, "content-type": "application/json", ...(options.headers || {}) } });
  const body = await response.text();
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error(`SITE_URL API yerine HTML döndürdü (${response.status}). Kelime uygulamasının portunu kontrol edin: ${siteUrl}`);
  }
  if (!response.ok) throw new Error(data.error || "Site isteği başarısız.");
  return data;
}

const client = createWhatsAppClient({
  sessionPath: process.env.WHATSAPP_SESSION_PATH || "./data/whatsapp",
  onQr: () => console.log("QR kodu WhatsApp > Bağlı cihazlar > Cihaz bağla menüsünden okutun."),
  onState: async (state, detail) => { console.log("WhatsApp:", state, detail || ""); await api("/api/agent/heartbeat", { method: "POST", body: JSON.stringify({ connected: state === "ready", groupName: groupName || groupId || undefined }) }).catch(() => {}); },
});

const scheduler = createScheduler({
  now: () => new Date(),
  claim: () => api("/api/agent/claim", { method: "POST" }),
  send: (message) => sendGroup(client, groupId, message),
  complete: (result) => api("/api/agent/complete", { method: "POST", body: JSON.stringify(result) }),
});

client.once("ready", async () => {
  let groups = [];
  if (!groupId) {
    try {
      groups = await listGroups(client);
    } catch (error) {
      console.error("WhatsApp grup listesi okunamadı:", error.message || error);
      console.error("Oturum açık kaldı; sender/.env içine WHATSAPP_GROUP_ID ekleyerek devam edebilirsiniz.");
      return;
    }
    if (groupName) {
      const selected = findGroupByName(groups, groupName);
      if (selected) {
        groupId = selected.id;
        persistGroupId(groupId);
        console.log("Hedef grup seçildi:", selected.name, "(", selected.id, ")");
      }
    }
  }
  if (!groupId) {
    console.log("WHATSAPP_GROUP_ID ayarlı değil. Bulunan gruplar:");
    groups.forEach((group) => console.log(group.id, "—", group.name));
    console.log("sender/.env içine WHATSAPP_GROUP_NAME olarak tam grup adını yazın.");
    return;
  }
  console.log("Gönderici hazır; dört saatlik dilimler izleniyor.");
  scheduler.start();
});

async function initializeWithRetry() {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await client.initialize();
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const transient = /Execution context was destroyed|Target closed|Session closed|Navigat/i.test(message);
      if (!transient || attempt === maxAttempts) throw error;
      console.warn(`WhatsApp Web sayfası yüklenirken yenilendi; yeniden deneniyor (${attempt}/${maxAttempts - 1}).`);
      await client.destroy().catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

initializeWithRetry().catch((error) => {
  console.error("WhatsApp başlatılamadı:", error.message || error);
  console.error("Oturum klasörü korunuyor; tekrar npm start çalıştırabilirsiniz.");
  process.exitCode = 1;
});
