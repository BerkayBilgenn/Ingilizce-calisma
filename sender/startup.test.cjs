const assert = require("node:assert/strict");
const { startStartupWatchdog } = require("./lifecycle.cjs");

(async () => {
  let expired = 0;
  const stop = startStartupWatchdog(10, () => { expired += 1; });
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(expired, 1, "stalled initialization must be noticed");
  stop();

  const cancel = startStartupWatchdog(10, () => { expired += 1; });
  cancel();
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(expired, 1, "ready initialization must not be restarted");
  console.log("sender startup tests passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
