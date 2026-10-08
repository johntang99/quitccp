/**
 * 开工 — starts the site and opens 影片拼接台.
 *
 * One command, because the person cutting the films should not have to
 * remember that the editing bench needs a dev server, which port it is on, or
 * what ffmpeg is.
 *
 *   npm run studio
 *
 * It checks the two things that actually stop it working (ffmpeg, the env
 * file), reuses a server that is already up rather than fighting it for the
 * port, and leaves that server in the foreground so Ctrl-C ends the session
 * the way you would expect.
 */
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4020;
const PAGE = `http://localhost:${PORT}/admin/video-studio`;

const ok = (s) => `\x1b[32m${s}\x1b[0m`;
const bad = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[90m${s}\x1b[0m`;

function have(cmd) {
  try {
    execFileSync("which", [cmd], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function answering() {
  try {
    const res = await fetch(`http://localhost:${PORT}/`, { signal: AbortSignal.timeout(4000) });
    return res.ok;
  } catch {
    return false;
  }
}

console.log("\n  影片拼接台\n");

/* The two things that actually stop it working, checked before anything slow. */
if (!have("ffmpeg")) {
  console.log(`  ${bad("缺 ffmpeg")}  —— 剪片全靠它。`);
  console.log(`  装它：${dim("brew install ffmpeg")}`);
  console.log(`  没有 Homebrew 的话先装：${dim('/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/brew/HEAD/install.sh)"')}\n`);
  process.exit(1);
}
if (!fs.existsSync(path.join(ROOT, ".env.local"))) {
  console.log(`  ${bad("缺 .env.local")}  —— 没有它连不上数据库，「出片并上传」会失败。`);
  console.log(`  找 John 要一份，放在 ${dim(ROOT)} 下面。\n`);
  process.exit(1);
}
console.log(`  ${ok("ffmpeg")} ${execFileSync("ffmpeg", ["-version"], { encoding: "utf8" }).split("\n")[0].split(" ")[2]}   ${ok(".env.local")} 在`);

const open = () => {
  console.log(`\n  ${ok("开好了")}  ${PAGE}\n`);
  spawn("open", [PAGE], { stdio: "ignore", detached: true }).unref();
};

if (await answering()) {
  /* Already running -- probably the window the operator left open. Leave it be. */
  console.log(`  网站已经在 ${PORT} 端口上跑着了，直接开页面。`);
  open();
  console.log(dim("  （这个服务器不是这条命令起的，关它请回到它自己那个窗口。）\n"));
  process.exit(0);
}

console.log(`  正在启动网站…  ${dim("第一次要等十几秒")}`);
const server = spawn("npm", ["run", "dev"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: process.env });
server.stdout.on("data", (b) => process.stdout.write(dim(String(b))));
server.stderr.on("data", (b) => process.stdout.write(dim(String(b))));

for (let i = 0; i < 60; i += 1) {
  await new Promise((r) => setTimeout(r, 1500));
  if (await answering()) {
    open();
    console.log(dim("  要收工，在这个窗口按 Ctrl-C。\n"));
    break;
  }
  if (i === 59) {
    console.log(`\n  ${bad("网站没起来")}。上面的日志里应该写了原因。\n`);
    server.kill();
    process.exit(1);
  }
}

const stop = () => {
  server.kill("SIGINT");
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
