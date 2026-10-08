/**
 * Cuts the 30-second homepage hero film.
 *
 * Shape asked for: three speakers at three seconds each, then twenty-one
 * seconds of parade, over music.
 *
 * ## Where the pictures come from
 *
 * The speakers are pulled from 干净世界's HLS streams of the centre's own
 * uploads. They are not on tape anywhere we hold -- every 汪志远 film on the
 * site is a YouTube or 干净世界 embed, and the library has no .mp4 of him at
 * all -- so the stream is the only copy there is. ffmpeg reads the playlist
 * directly, which is why only the three seconds needed are ever fetched.
 *
 * Each speaker's window is chosen so the broadcast lower-third carrying their
 * name and title is on screen for the whole three seconds. That caption is why
 * these particular seconds and not others: it introduces them without a word
 * of new text.
 *
 * The parade is 《庆祝世界法轮大法日 纽约盛大游行 声援4.3亿人三退》, the film the
 * centre pointed me at -- 4 minutes of 1080p on their own 干净世界 channel.
 *
 * That film is itself already cut, at about one shot every two seconds, so
 * fixed three-second blocks would land mid-cut. The runs below are taken
 * between its own cut points instead -- boundaries from ffmpeg's scene
 * detector, 124 of them -- so its editor's rhythm carries through rather than
 * being chopped across. Nothing repeats; there is four minutes to choose from.
 *
 * ## The music
 *
 * Lifted from the existing hero, which is the only music track we hold -- 13
 * seconds of it, at 115 BPM. Thirty seconds means looping, and 13.04s is 25.08
 * beats, so it does not meet itself cleanly; the loop is cut to a whole number
 * of beats and crossfaded. If the centre sends a real track this is one line to
 * change and a minute to re-run.
 *
 *   node scripts/build-hero-video.mjs
 *   node scripts/build-hero-video.mjs --upload
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const UPLOAD = process.argv.includes("--upload");
const OUT_DIR = "artifacts/hero";
const FOOTAGE = "artifacts/footage";
const WORK = path.join(OUT_DIR, "work");

/** 1080p HLS of each speaker, and the window where their name caption shows. */
const SPEAKERS = [
  {
    name: "汪志远",
    role: "追查迫害法轮功国际组织主席",
    url: "https://media4-us-east.cloudokyo.cloud/video/v5/38/7f/4a/387f4a88-566c-46f6-b528-59731bf4083d/v1080p/index.m3u8",
    start: 28
  },
  {
    name: "周锋锁",
    role: "人道中国主席",
    url: "https://media1-us-east.cloudokyo.cloud/video/v14/07/a8/19/07a819d3-5444-46ad-a5c2-61fb9ffd58de/playlist_1080p.m3u8",
    start: 9
  },
  {
    name: "赵慧子",
    role: "天津法轮功学员",
    url: "https://media2-us-east.cloudokyo.cloud/video/v5/7b/26/81/7b268137-77b9-4473-b370-90299086d6a3/v1080p/index.m3u8",
    start: 19
  }
];

/**
 * The parade, as continuous runs between the source film's own cuts.
 *
 * Chosen for what each says, in this order: whose march it is, then its scale,
 * then its message, then the drums and the centre's own end card.
 */
const PARADE_FILE = path.join(FOOTAGE, "parade-4yi-1080.mp4");
const PARADE_RUNS = [
  { from: 147.81, to: 150.42, why: "全球退黨服務中心 的横幅——先亮明是谁" },
  { from: 99.80, to: 107.0, why: "法輪大法 横幅与蓝黄旗阵，最有气势的一段" },
  { from: 210.71, to: 216.38, why: "聲援 4.3 億勇士退出中共黨團隊" },
  /* Stops at 242.8. The source film's end card starts at 243, and this plays
     as a looping backdrop -- a still card that jumps back to a talking head is
     the one place a loop shows its seam. Its glow starts bleeding in by 242.4,
     so this stops at 242.3 and closes on the centre's own banner, moving. */
  { from: 237.0, to: 242.3, why: "腰鼓队与 全球退黨服務中心 横幅，停在动势上" }
];

const SHOT = 3;
const MUSIC_FROM = "artifacts/hero/hero-music-source.mp4";
const BPM = 115.4;
const BEAT = 60 / BPM;

const run = (args, label) => {
  try {
    execFileSync("ffmpeg", ["-hide_banner", "-v", "error", ...args], { stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    throw new Error(`${label} 失败：${String(err.stderr ?? err.message).slice(0, 400)}`);
  }
};

fs.mkdirSync(WORK, { recursive: true });

/*
 * Every piece is normalised to one spec before anything is joined: 1920x1080,
 * 25fps, square pixels, yuv420p. The sources disagree on all four -- the
 * streams are 29.97, the parade file is 29.97, the old hero was 25 -- and
 * concat demands they match exactly.
 */
const NORM = "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=25,setsar=1,format=yuv420p";

console.log("\n=== 1/4 取讲者片段（只拉需要的 3 秒）===");
const parts = [];
for (const [i, s] of SPEAKERS.entries()) {
  const out = path.join(WORK, `a${i}-${s.name}.mp4`);
  run(
    ["-ss", String(s.start), "-i", s.url, "-t", String(SHOT), "-an",
     "-vf", NORM, "-c:v", "libx264", "-preset", "slow", "-crf", "18", out, "-y"],
    s.name
  );
  parts.push(out);
  console.log(`  ${s.name}（${s.role}）  ${s.start}s–${s.start + SHOT}s`);
}

console.log("\n=== 2/4 切游行 ===");
let paradeLen = 0;
for (const [i, r] of PARADE_RUNS.entries()) {
  const out = path.join(WORK, `b${String(i).padStart(2, "0")}.mp4`);
  const len = +(r.to - r.from).toFixed(3);
  run(
    ["-ss", String(r.from), "-i", PARADE_FILE, "-t", String(len), "-an",
     "-vf", NORM, "-c:v", "libx264", "-preset", "slow", "-crf", "18", out, "-y"],
    `游行 ${r.from}s`
  );
  parts.push(out);
  paradeLen += len;
  console.log(`  ${r.from.toFixed(1)}–${r.to.toFixed(1)}  ${len.toFixed(2)}s  ${r.why}`);
}
console.log(`  游行共 ${paradeLen.toFixed(2)}s，没有重复`);

console.log("\n=== 3/4 接起来 ===");
const listFile = path.join(WORK, "list.txt");
fs.writeFileSync(listFile, parts.map((p) => `file '${path.resolve(p)}'`).join("\n"));
const silent = path.join(WORK, "silent.mp4");
run(["-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", silent, "-y"], "拼接");

const total = +(SHOT * SPEAKERS.length + paradeLen).toFixed(2);
console.log(`  讲者 ${SHOT * SPEAKERS.length}s + 游行 ${paradeLen.toFixed(2)}s = ${total}s`);

console.log("\n=== 4/4 铺音乐 ===");
/*
 * The loop is trimmed to a whole number of beats so the pulse carries across
 * the join, and the two halves are crossfaded over one beat so the seam lands
 * inside a beat rather than on top of one.
 */
const beats = Math.floor(13.0 / BEAT);
const loopLen = +(beats * BEAT).toFixed(3);
const bed = path.join(WORK, "bed.wav");
const oneLoop = path.join(WORK, "loop.wav");
run(["-i", MUSIC_FROM, "-vn", "-t", String(loopLen), "-ac", "2", "-ar", "48000", oneLoop, "-y"], "取音乐");
console.log(`  原曲 ${BPM} BPM，截到 ${beats} 拍 = ${loopLen}s 作为循环单元`);

const copies = Math.ceil(total / (loopLen - BEAT)) + 1;
const inputs = [];
for (let i = 0; i < copies; i += 1) inputs.push("-i", oneLoop);
let filter = "";
let prev = "0:a";
for (let i = 1; i < copies; i += 1) {
  const label = i === copies - 1 ? "mix" : `x${i}`;
  filter += `[${prev}][${i}:a]acrossfade=d=${BEAT.toFixed(3)}:c1=tri:c2=tri[${label}];`;
  prev = label;
}
/*
 * No picture fade and only a short one on the sound. The current hero carries
 * none -- it opens and closes bright, because it plays on loop and a dip to
 * black every half minute reads as a fault. The audio gets 0.25s at each end,
 * enough to stop the restart clicking.
 */
filter += `[${prev}]atrim=0:${total},afade=t=in:st=0:d=0.25,afade=t=out:st=${total - 0.25}:d=0.25,loudnorm=I=-16:TP=-1.5:LRA=11[a]`;
run([...inputs, "-filter_complex", filter, "-map", "[a]", bed, "-y"], "拼音乐");
console.log(`  ${copies} 段交叉淡接 → ${total}s，再做响度归一`);

const tag = "30s";
const final = path.join(OUT_DIR, `hero-${tag}-1920.mp4`);
run(
  ["-i", silent, "-i", bed,
   "-map", "0:v", "-map", "1:a",
   "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-pix_fmt", "yuv420p",
   "-profile:v", "high", "-level", "4.0", "-movflags", "+faststart",
   "-c:a", "aac", "-b:a", "160k", "-ar", "48000",
   final, "-y"],
  "成片"
);

const size = fs.statSync(final).size;
console.log(`\n  成片：${final}`);
console.log(`  ${(size / 1048576).toFixed(1)} MB`);

/* A 1280 copy, the same pair the current hero ships as. */
const small = path.join(OUT_DIR, `hero-${tag}-1280.mp4`);
run(
  ["-i", final, "-vf", "scale=1280:720", "-c:v", "libx264", "-preset", "slow", "-crf", "23",
   "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-c:a", "copy", small, "-y"],
  "1280 版"
);
console.log(`  ${small}  ${(fs.statSync(small).size / 1048576).toFixed(1)} MB`);

if (!UPLOAD) {
  console.log("\n  没有上传。确认片子没问题后加 --upload。");
  process.exit(0);
}

/*
 * Uploaded beside the current hero, not over it. The homepage keeps playing the
 * 13-second one until someone chooses to switch -- a hero is the first thing
 * every visitor sees, and that swap is the centre's call, not this script's.
 */
const { createClient } = await import("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = "media";
const stamp = Date.now();

console.log("\n=== 上传 ===");
const urls = {};
for (const [label, file] of [["1920", final], ["1280", small]]) {
  const key = `home/${stamp}-hero-${tag}-${label}.mp4`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(key, fs.readFileSync(file), { contentType: "video/mp4", upsert: true });
  if (upErr) throw upErr;
  urls[label] = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${key}`;
  console.log(`  ${label}: ${urls[label]}`);
}
fs.writeFileSync(path.join(OUT_DIR, `uploaded-${tag}.json`), JSON.stringify(urls, null, 2));
console.log("\n  首页还在放原来那条 13 秒的，没有动。");
