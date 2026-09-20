const { spawnSync } = require("node:child_process");
const target = `gui/${process.getuid()}/com.kelimegunlugu.sender`;
const result = spawnSync("launchctl", ["kill", "SIGUSR2", target], { encoding: "utf8" });
if (result.status !== 0) {
  console.error("Gönderici çalışmıyor:", result.stderr || result.stdout || result.status);
  process.exitCode = 1;
} else {
  console.log("Anlık mesaj istendi; sonucu sender/data/sender.log dosyasında görebilirsiniz.");
}
