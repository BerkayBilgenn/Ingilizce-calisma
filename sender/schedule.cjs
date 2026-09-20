function createScheduler({ now, claim, send, complete, notBefore = 0, onFailure = (error) => console.error("Hatırlatma gönderilemedi:", error), intervalMs = 30000 }) {
  let timer;
  let lastFailure;
  async function tick() {
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
      return { sent: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await complete({ slotKey: claimed.slotKey, status: "uncertain", error: message });
      return { uncertain: true, error: message };
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
module.exports = { createScheduler };
