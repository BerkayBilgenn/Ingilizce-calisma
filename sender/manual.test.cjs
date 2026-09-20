const assert = require("node:assert/strict");
const { createManualTrigger } = require("./manual.cjs");

(async () => {
  let release;
  let calls = 0;
  const errors = [];
  const trigger = createManualTrigger(async () => {
    calls += 1;
    await new Promise((resolve) => { release = resolve; });
  }, (error) => errors.push(error));
  const first = trigger();
  assert.deepEqual(await trigger(), { busy: true });
  assert.equal(calls, 1);
  release();
  assert.deepEqual(await first, { done: true });
  assert.deepEqual(errors, []);
  console.log("sender manual tests passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
