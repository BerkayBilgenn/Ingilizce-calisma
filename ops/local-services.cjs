const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function makeJobs(root, node) {
  return [
    {
      label: "com.kelimegunlugu.site",
      directory: root,
      args: [node, path.join(root, "node_modules/next/dist/bin/next"), "start", "--port", "3001", "--hostname", "127.0.0.1"],
      log: path.join(root, "data/site.log"),
    },
    {
      label: "com.kelimegunlugu.sender",
      directory: path.join(root, "sender"),
      args: [node, path.join(root, "sender/index.cjs")],
      log: path.join(root, "sender/data/sender.log"),
    },
  ];
}

function xml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function plistFor(job) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${xml(job.label)}</string>
<key>ProgramArguments</key><array>${job.args.map((arg) => `<string>${xml(arg)}</string>`).join("")}</array>
<key>WorkingDirectory</key><string>${xml(job.directory)}</string>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>30</integer>
<key>StandardOutPath</key><string>${xml(job.log)}</string>
<key>StandardErrorPath</key><string>${xml(job.log)}</string>
</dict></plist>
`;
}

function launchctl(...args) {
  const result = spawnSync("launchctl", args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`launchctl ${args[0]}: ${result.stderr || result.stdout || result.status}`);
}

function install() {
  const root = path.resolve(__dirname, "..");
  const directory = path.join(os.homedir(), "Library/LaunchAgents");
  const domain = `gui/${process.getuid()}`;
  fs.mkdirSync(directory, { recursive: true });
  for (const job of makeJobs(root, process.execPath)) {
    fs.mkdirSync(path.dirname(job.log), { recursive: true });
    const target = `${domain}/${job.label}`;
    const file = path.join(directory, `${job.label}.plist`);
    if (spawnSync("launchctl", ["print", target], { stdio: "ignore" }).status === 0) launchctl("bootout", target);
    fs.writeFileSync(file, plistFor(job));
    launchctl("bootstrap", domain, file);
    console.log(`${job.label} başlatıldı.`);
  }
}

if (require.main === module) {
  if (process.argv[2] !== "install") throw new Error("Usage: node ops/local-services.cjs install");
  install();
}

module.exports = { makeJobs, plistFor };
