/**
 * 拼接台自检 — tries every way a render is known to go wrong.
 *
 *   node scripts/test-video-studio.mjs
 *
 * Each case builds a project designed to fail in one specific way, runs the
 * real renderer against it, and checks that it was refused for the right
 * reason. The point is not that the renderer works -- one good render shows
 * that. The point is that when it cannot work it says so, because the
 * expensive failure here is not a render that stops, it is a render that
 * finishes and publishes something wrong.
 *
 * Footage is generated locally rather than pulled from 干净世界: these run in
 * seconds, they run the same way every time, and they do not depend on
 * somebody else's CDN being up.
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TMP = path.join(ROOT, "artifacts", "selftest");
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[90m${s}\x1b[0m`;

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

/** A silent test clip of a given size and length. */
function makeVideo(file, { seconds = 10, w = 1920, h = 1080 } = {}) {
  execFileSync("ffmpeg", ["-hide_banner", "-v", "error", "-f", "lavfi",
    "-i", `testsrc=size=${w}x${h}:rate=30000/1001:duration=${seconds}`,
    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "30", "-pix_fmt", "yuv420p",
    path.join(TMP, file), "-y"]);
  return path.join(TMP, file);
}

function makeAudio(file, seconds) {
  execFileSync("ffmpeg", ["-hide_banner", "-v", "error", "-f", "lavfi",
    "-i", `sine=frequency=220:duration=${seconds}`, "-c:a", "libmp3lame",
    path.join(TMP, file), "-y"]);
  return path.join(TMP, file);
}

const big = makeVideo("big.mp4", { seconds: 20 });
const tiny = makeVideo("tiny.mp4", { seconds: 1 });
const lowres = makeVideo("lowres.mp4", { seconds: 20, w: 640, h: 360 });
const music2s = makeAudio("music2.mp3", 2);
const music30s = makeAudio("music30.mp3", 30);

/** The shape of a working project; each case bends one thing. */
const base = () => ({
  output: { name: "selftest", dir: "artifacts/selftest/out", width: 1920, height: 1080, fps: "source", crf: 28 },
  clips: [
    { source: big, from: 1, to: 4, note: "一" },
    { source: big, from: 5, to: 8, note: "二" }
  ],
  music: null
});

/**
 * `expect: "ok"` must render; a string must appear in the refusal.
 *
 * Checking the message rather than only the exit code is deliberate: the
 * person reading it has to be able to act on it, and a render that stops for
 * an unrelated reason would otherwise count as a pass.
 */
const cases = [
  { name: "正常两段", project: base(), expect: "ok" },

  { name: "素材文件不存在", expect: "打不开这条素材",
    project: { ...base(), clips: [{ source: path.join(TMP, "meiyou.mp4"), from: 0, to: 3 }] } },

  { name: "取到素材结尾之后", expect: "素材结尾之后",
    project: { ...base(), clips: [{ source: big, from: 500, to: 503 }] } },

  { name: "素材比要的还短", expect: "素材结尾之后",
    project: { ...base(), clips: [{ source: tiny, from: 0, to: 3 }] } },

  { name: "素材只有 360p，却要出 1080", expect: "放大上去会糊",
    project: { ...base(), clips: [{ source: lowres, from: 1, to: 4 }] } },

  { name: "配乐比片子短，没开循环", expect: "配乐只铺了",
    project: { ...base(), music: { from: music2s, loop: false, lufs: -16 } } },

  { name: "配乐比片子短，开了循环", expect: "ok",
    project: { ...base(), music: { from: music2s, loop: true, bpm: 120, lufs: -16 } } },

  { name: "配乐够长", expect: "ok",
    project: { ...base(), music: { from: music30s, loop: true, bpm: 120, lufs: -16 } } },

  { name: "配乐地址不存在", expect: "打不开这段配乐",
    project: { ...base(), music: { from: path.join(TMP, "meiyou.mp3"), loop: true, lufs: -16 } } },

  { name: "一段都没有", expect: "一个片段都没有",
    project: { ...base(), clips: [] } },

  { name: "起点终点反了", expect: "from/to 不对",
    project: { ...base(), clips: [{ source: big, from: 8, to: 5 }] } },

  { name: "长度为零的一段", expect: "from/to 不对",
    project: { ...base(), clips: [{ source: big, from: 5, to: 5 }] } }
];

let pass = 0;
let fail = 0;
const surprises = [];

for (const c of cases) {
  const file = path.join(ROOT, "projects", `selftest-${cases.indexOf(c)}.json`);
  fs.writeFileSync(file, JSON.stringify(c.project, null, 2));
  const run = spawnSync("node", [path.join("scripts", "video-studio.mjs"), path.relative(ROOT, file), "--preview"],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 26 });
  fs.rmSync(file, { force: true });

  const out = `${run.stdout}${run.stderr}`;
  const ok = run.status === 0;

  if (c.expect === "ok") {
    if (ok) { console.log(`  ${green("✓")} ${c.name}`); pass += 1; }
    else {
      console.log(`  ${red("✗")} ${c.name} ${dim("—— 本该成功，却停了")}`);
      console.log(dim(`      ${out.trim().split("\n").slice(-3).join(" / ").slice(0, 200)}`));
      fail += 1;
    }
  } else if (c.expect === "ok?") {
    /* Cases with no settled answer yet: record what happens, judge after. */
    surprises.push({ name: c.name, status: run.status, tail: out.trim().split("\n").filter(Boolean).slice(-2).join(" / ").slice(0, 160) });
    console.log(`  ${dim("?")} ${c.name} ${dim(`—— 退出码 ${run.status}`)}`);
  } else if (!ok && out.includes(c.expect)) {
    console.log(`  ${green("✓")} ${c.name} ${dim(`—— 正确拦下：${c.expect}`)}`);
    pass += 1;
  } else {
    console.log(`  ${red("✗")} ${c.name} ${dim(ok ? "—— 本该拦下，却出片了" : `—— 拦下了，但理由不对`)}`);
    console.log(dim(`      ${out.trim().split("\n").filter(Boolean).slice(-3).join(" / ").slice(0, 220)}`));
    fail += 1;
  }
}

console.log(`\n  ${pass} 过，${fail} 败${surprises.length ? `，${surprises.length} 项待定` : ""}\n`);
if (surprises.length) {
  console.log("  待定（没想好该怎样才对）：");
  for (const s of surprises) console.log(`    ${s.name}  退出码 ${s.status}  ${dim(s.tail)}`);
  console.log("");
}
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(fail > 0 ? 1 : 0);
