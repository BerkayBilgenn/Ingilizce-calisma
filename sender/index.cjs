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
const { createWhatsAppClient, listGroups, sendGroup } = require("./whatsapp.cjs");

const siteUrl = process.env.SITE_URL;
const agentSecret = process.env.AGENT_SECRET;
const groupId = process.env.WHATSAPP_GROUP_ID;
if (!siteUrl || !agentSecret) throw new Error("SITE_URL ve AGENT_SECRET gerekli.");

async function api(path, options = {}) {
  const response = await fetch(siteUrl.replace(/\/$/, "") + path, { ...options, headers: { authorization: "Bearer " + agentSecret, "content-type": "application/json", ...(options.headers || {}) } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Site isteği başarısız.");
  return data;
}

const client = createWhatsAppClient({
  sessionPath: process.env.WHATSAPP_SESSION_PATH || "./data/whatsapp",
  onQr: () => console.log("QR kodu WhatsApp > Bağlı cihazlar > Cihaz bağla menüsünden okutun."),
  onState: async (state, detail) => { console.log("WhatsApp:", state, detail || ""); await api("/api/agent/heartbeat", { method: "POST", body: JSON.stringify({ connected: state === "ready", groupName: groupId || undefined }) }).catch(() => {}); },
});

const scheduler = createScheduler({
  now: () => new Date(),
  claim: () => api("/api/agent/claim", { method: "POST" }),
  send: (message) => sendGroup(client, groupId, message),
  complete: (result) => api("/api/agent/complete", { method: "POST", body: JSON.stringify(result) }),
});

client.once("ready", async () => {
  if (!groupId) {
    const groups = await listGroups(client);
    console.log("WHATSAPP_GROUP_ID ayarlı değil. Bulunan gruplar:");
    groups.forEach((group) => console.log(group.id, "—", group.name));
    console.log("Bir grubu seçip sender/.env içine WHATSAPP_GROUP_ID olarak ekleyin, sonra yeniden başlatın.");
    return;
  }
  console.log("Gönderici hazır; dört saatlik dilimler izleniyor.");
  scheduler.start();
});

client.initialize();
