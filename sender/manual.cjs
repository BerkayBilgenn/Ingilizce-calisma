function createManualTrigger(sendNow, onFailure) {
  let sending = false;
  return async function trigger() {
    if (sending) return { busy: true };
    sending = true;
    try {
      await sendNow();
      return { done: true };
    } catch (error) {
      onFailure(error);
      return { failed: true };
    } finally {
      sending = false;
    }
  };
}
module.exports = { createManualTrigger };
