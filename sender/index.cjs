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
const { watchBrowser, startStartupWatchdog } = require("./lifecycle.cjs");
const { createManualTrigger } = require("./manual.cjs");

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
const resumeAt = process.env.SENDER_RESUME_AT ? Date.parse(process.env.SENDER_RESUME_AT) : 0;
let groupId = process.env.WHATSAPP_GROUP_ID || "";
const groupName = process.env.WHATSAPP_GROUP_NAME || "";
if (!siteUrl || !agentSecret) throw new Error("SITE_URL ve AGENT_SECRET gerekli.");
if (!Number.isFinite(resumeAt)) throw new Error("SENDER_RESUME_AT geçerli bir zaman olmalı.");

function restartIfBrowserBroken(error) {
  if (/detached Frame|Execution context was destroyed|Target closed|Session closed/i.test(String(error))) {
    console.error("WhatsApp tarayıcısı kullanılamıyor; gönderici yeniden başlatılacak.");
    process.exit(1);
  }
}

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
  onState: async (state, detail) => { console.log("WhatsApp:", state, detail || ""); await api("/api/agent/heartbeat", { method: "POST", body: JSON.stringify({ connected: state === "ready", groupName: groupName || groupId || undefined }) }).catch((error) => console.error("Vercel bağlantısı doğrulanamadı:", error.message || error)); },
});

const scheduler = createScheduler({
  now: () => new Date(),
  notBefore: resumeAt,
  claim: () => api("/api/agent/claim", { method: "POST" }),
  send: (message) => sendGroup(client, groupId, message),
  complete: (result) => api("/api/agent/complete", { method: "POST", body: JSON.stringify(result) }),
  onFailure: (error) => {
    console.error("Hatırlatma gönderilemedi:", error);
    restartIfBrowserBroken(error);
  },
});

async function sendNow() {
  const claimed = await api("/api/agent/claim?force=1", { method: "POST" });
  if (!claimed.message) {
    console.log("Şu anda gönderilecek aktif kelime yok.");
    return;
  }
  try {
    const result = await sendGroup(client, groupId, claimed.message);
    await api("/api/agent/complete", { method: "POST", body: JSON.stringify({ slotKey: claimed.slotKey, status: "sent", messageId: result.messageId }) });
    console.log("Tek seferlik deneme mesajı gönderildi.");
  } catch (error) {
    await api("/api/agent/complete", { method: "POST", body: JSON.stringify({ slotKey: claimed.slotKey, status: "uncertain", error: error instanceof Error ? error.message : String(error) }) }).catch(() => {});
    throw error;
  }
}

const triggerManual = createManualTrigger(sendNow, (error) => {
  console.error("Tek seferlik mesaj gönderilemedi:", error.message || error);
  restartIfBrowserBroken(error);
});

client.once("ready", async () => {
  watchBrowser(client, (reason) => { console.error(reason, "Gönderici yeniden başlatılacak."); process.exit(1); });
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
  process.on("SIGUSR2", () => { void triggerManual(); });
  if (process.env.SEND_NOW === "1") await triggerManual();
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

const stopStartupWatchdog = startStartupWatchdog(5 * 60_000, () => {
  console.error("WhatsApp başlatma süresi doldu; servis yeniden başlatılacak.");
  process.exit(1);
});

initializeWithRetry().then(stopStartupWatchdog).catch((error) => {
  stopStartupWatchdog();
  console.error("WhatsApp başlatılamadı:", error.message || error);
  console.error("Oturum klasörü korunuyor; servis yeniden başlatılacak.");
  process.exit(1);
});
