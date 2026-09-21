function createScheduler({ now, claim, send, complete, notBefore = 0, onFailure = (error) => console.error("Hatırlatma gönderilemedi:", error), onSent = () => {}, intervalMs = 30000 }) {
  let timer;
  let lastFailure;
  let inFlight = false;
  async function tick() {
    if (inFlight) return { skipped: true };
    inFlight = true;
    try {
      if (now().getTime() < notBefore) return { skipped: true };
      let claimed;
      try {
        claimed = await claim();
      } catch (error) {
        return { failed: true, error: error instanceof Error ? error.message : String(error) };
      }
      if (!claimed || claimed.skip) return { skipped: true };
      try {
        const result = await send(claimed.message);
        await complete({ slotKey: claimed.slotKey, status: "sent", messageId: result.messageId });
        try {
          await onSent({ slotKey: claimed.slotKey, messageId: result.messageId });
        } catch { /* Observability must never overwrite a confirmed delivery. */ }
        return { sent: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await complete({ slotKey: claimed.slotKey, status: "uncertain", error: message });
        return { uncertain: true, error: message };
      }
    } finally {
      inFlight = false;
    }
  }
  async function report() {
    try {
      const result = await tick();
      if (result.failed || result.uncertain) {
        if (result.error !== lastFailure) onFailure(result.error);
        lastFailure = result.error;
      } else {
        lastFailure = undefined;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message !== lastFailure) onFailure(message);
      lastFailure = message;
    }
  }
  return { tick, start() { void report(); timer = setInterval(() => void report(), intervalMs); return () => clearInterval(timer); }, now };
}
function claimPath(now, notBefore) {
  return now.getTime() < notBefore ? "/api/agent/claim?noticesOnly=1" : "/api/agent/claim";
}
module.exports = { createScheduler, claimPath };
