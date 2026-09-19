function createScheduler({ now, claim, send, complete, intervalMs = 30000 }) {
  let timer;
  async function tick() {
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
      await complete({ slotKey: claimed.slotKey, status: "uncertain", error: error instanceof Error ? error.message : String(error) });
      return { uncertain: true };
    }
  }
  return { tick, start() { void tick(); timer = setInterval(() => void tick(), intervalMs); return () => clearInterval(timer); }, now };
}
module.exports = { createScheduler };
