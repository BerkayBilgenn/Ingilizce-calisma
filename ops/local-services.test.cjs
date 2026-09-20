const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { makeJobs, plistFor } = require("./local-services.cjs");

const jobs = makeJobs("/tmp/kelime-app", "/usr/local/bin/node");
assert.equal(jobs.length, 2);
const site = jobs.find((job) => job.label.endsWith(".site"));
const sender = jobs.find((job) => job.label.endsWith(".sender"));
assert.deepEqual(site.args, ["/usr/local/bin/node", "/tmp/kelime-app/node_modules/next/dist/bin/next", "start", "--port", "3001", "--hostname", "127.0.0.1"]);
assert.deepEqual(sender.args, ["/usr/local/bin/node", "/tmp/kelime-app/sender/index.cjs"]);
for (const job of jobs) {
  const result = spawnSync("plutil", ["-lint", "-"], { input: plistFor(job), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(plistFor(job), /<key>KeepAlive<\/key>\s*<true\/>/);
}
console.log("local services tests passed");
