/**
 * 影片拼接台 — a small editing bench for the short films the site needs.
 *
 * It does one job: take a list of clips, join them, lay music under, and hand
 * back a file. Everything that makes a film good -- which three seconds, which
 * order -- stays a human decision, written down in a project file.
 *
 * ## Why this and not just an editor
 *
 * It is not a replacement for DaVinci or Final Cut; those are where the
 * creative work belongs. This is for the half of the job that is not creative:
 *
 * - **Repeatable.** The project file names the cut in seconds. Change one
 *   speaker and re-run; the other nine shots come back frame-identical.
 * - **Nothing to download.** 干净世界 films are read straight off their HLS
 *   stream, so a three-second clip fetches three seconds, not a 400MB file.
 * - **Ends in the right place.** It uploads to Storage *and* registers the file
 *   in 图片视频库, which hand-uploading repeatedly got wrong.
 *
 * ## Using it
 *
 *   node scripts/video-studio.mjs projects/hero.json            剪片
 *   node scripts/video-studio.mjs projects/hero.json --preview  快出小样（360p，快很多）
 *   node scripts/video-studio.mjs projects/hero.json --upload   剪完上传并登记
 *
 * Finding the moments -- the part that actually takes time:
 *
 *   node scripts/video-studio.mjs --resolve <干净世界地址>   嵌入地址 → 可直接读的流
 *   node scripts/video-studio.mjs --scan <来源> [--every 8]  每 N 秒一帧的总览图
 *   node scripts/video-studio.mjs --cuts <来源>              它自己的镜头切点
 *   node scripts/video-studio.mjs --look <来源> 12 18 40     指定几个时刻各看一帧
 *
 * A source is a local path, an https .mp4, an .m3u8, or a 干净世界 embed URL --
 * the last is resolved automatically wherever a source is accepted.
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
const WORK = "artifacts/studio";
const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
/* Machine-readable output, so the admin UI can drive this same script rather
   than growing a second implementation that drifts from it. */
const JSONOUT = has("--json");
const say = (human, data) => {
  if (JSONOUT) console.log(JSON.stringify(data));
  else console.log(human);
};
const valueOf = (flag, fallback) => {
  const i = argv.indexOf(flag);
  return i === -1 ? fallback : argv[i + 1];
};

const ff = (args, label) => {
  try {
    return execFileSync("ffmpeg", ["-hide_banner", "-v", "error", ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024
    });
  } catch (err) {
    throw new Error(`${label}：${String(err.stderr ?? err.message).slice(0, 500)}`);
  }
};

const probe = (src, entries) =>
  execFileSync("ffprobe", ["-v", "error", "-show_entries", entries, "-of", "default=noprint_wrappers=1:nokey=1", src], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024
  }).trim();

/**
 * A 干净世界 embed address turned into a stream ffmpeg can read.
 *
 * The embed page carries the real address in its own payload as `video_url`,
 * with the quotes backslash-escaped by Next.js. Reading it from there means no
 * browser is needed -- the first version of this drove a headless Chrome and
 * watched the network, which worked but could not run unattended.
 */
async function resolveGanjing(url) {
  const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(90000) });
  if (!res.ok) throw new Error(`取不到 ${url}（HTTP ${res.status}）`);
  const flat = (await res.text()).replaceAll('\\"', '"').replaceAll("\\/", "/");
  const m = flat.match(/"video_url"\s*:\s*"(https:\/\/[^"]+?master\.m3u8)"/);
  if (!m) throw new Error(`这个页面里没有找到视频流地址：${url}`);
  return m[1];
}

/** Any of the four kinds of source, as something ffmpeg will open. */
async function openable(src) {
  if (/ganjingworld\.com\/(embed|video)\//i.test(src)) return resolveGanjing(src);
  return src;
}

/**
 * Prefers a single-resolution playlist over the master.
 *
 * Handed a master, ffmpeg picks a rendition itself and has been seen choosing
 * a 360p one. These streams publish 1080p under two different names depending
 * on when the film was uploaded, so both are tried before giving up.
 */
async function bestRendition(streamUrl) {
  if (!streamUrl.endsWith("master.m3u8")) return streamUrl;
  const base = streamUrl.replace(/\/master\.m3u8$/, "");
  for (const candidate of ["playlist_1080p.m3u8", "v1080p/index.m3u8", "playlist_720p.m3u8", "v720p/index.m3u8"]) {
    try {
      const res = await fetch(`${base}/${candidate}`, {
        method: "HEAD",
        headers: { "user-agent": UA },
        signal: AbortSignal.timeout(30000)
      });
      if (res.ok) return `${base}/${candidate}`;
    } catch {
      /* try the next shape */
    }
  }
  return streamUrl;
}

/* ---------- the three helpers for finding moments ---------- */

async function cmdResolve(src) {
  const stream = await openable(src);
  const best = await bestRendition(stream);
  const dur = Number(probe(best, "format=duration")) || 0;
  const size = probe(best, "stream=width,height").split("\n").slice(0, 2).join("x");
  say(
    `\n  流地址  ${best}\n  时长    ${Math.floor(dur / 60)}:${String(Math.round(dur % 60)).padStart(2, "0")}  (${dur.toFixed(1)}s)\n  画面    ${size}\n\n  放进项目文件的 source 里直接用这个地址，或者直接写嵌入地址也行。\n`,
    { stream: best, duration: dur, size }
  );
}

async function cmdScan(src, every) {
  const best = await bestRendition(await openable(src));
  const dur = Number(probe(best, "format=duration")) || 0;
  const cells = Math.min(42, Math.max(1, Math.floor(dur / every)));
  const cols = cells > 24 ? 7 : 6;
  const rows = Math.ceil(cells / cols);
  fs.mkdirSync(WORK, { recursive: true });
  const out = path.join(WORK, `scan-${Date.now()}.jpg`);
  ff(
    ["-i", best, "-vf", `fps=1/${every},scale=300:169,setsar=1,tile=${cols}x${rows}`, "-frames:v", "1", out, "-y"],
    "总览图"
  );
  say(
    `\n  ${out}\n  每 ${every} 秒一帧，${cols}×${rows}，从 0 秒起，从左到右、从上到下。\n  第 n 格 ≈ 第 ${every}×(n−1) 秒。看中哪格，再用 --look 把那几秒看清楚。\n`,
    { image: out, every, cols, rows, duration: dur }
  );
}

async function cmdCuts(src) {
  const best = await bestRendition(await openable(src));
  const dur = Number(probe(best, "format=duration")) || 0;
  /* metadata=print writes to stderr, not stdout -- reading only stdout found
     no cuts at all and reported the whole film as one shot. */
  const run = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-i", best, "-filter:v", "select='gt(scene,0.3)',metadata=print", "-an", "-f", "null", "-"],
    { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 }
  );
  const raw = `${run.stdout ?? ""}${run.stderr ?? ""}`;
  const times = [...raw.matchAll(/pts_time:([0-9.]+)/g)].map((m) => Number(m[1]));
  const shots = [];
  let prev = 0;
  for (const t of times) {
    shots.push({ from: prev, to: t, len: t - prev });
    prev = t;
  }
  shots.push({ from: prev, to: dur, len: dur - prev });
  const avg = shots.reduce((n, s) => n + s.len, 0) / shots.length;
  const usable = shots.filter((x) => x.len >= 2.5);
  say(
    `\n  ${shots.length} 个镜头，平均 ${avg.toFixed(2)}s\n\n  够长、可以整段拿来用的（≥2.5s）：\n` +
      usable.map((x) => `     "from": ${x.from.toFixed(2)}, "to": ${x.to.toFixed(2)}     ${x.len.toFixed(2)}s`).join("\n") +
      `\n\n  片子本身剪得越碎，越该按它自己的切点取整段，\n  否则固定秒数的硬切会落在它的刀口中间。\n`,
    { shots, usable, average: avg, duration: dur }
  );
}

async function cmdLook(src, times) {
  const best = await bestRendition(await openable(src));
  fs.mkdirSync(WORK, { recursive: true });
  const stamp = Date.now();
  const files = [];
  for (const t of times) {
    const f = path.join(WORK, `look-${stamp}-${t}.jpg`);
    ff(["-ss", String(t), "-i", best, "-frames:v", "1", "-vf", "scale=320:180,setsar=1", f, "-y"], `第 ${t}s`);
    files.push(f);
  }
  const out = path.join(WORK, `look-${stamp}.jpg`);
  const inputs = files.flatMap((f) => ["-i", f]);
  const refs = files.map((_, i) => `[${i}:v]`).join("");
  ff([...inputs, "-filter_complex", `${refs}hstack=inputs=${files.length}`, out, "-y"], "拼帧");
  say(`\n  ${out}\n  从左到右：${times.join("s  ")}s\n`, { image: out, frames: files, times });
}

/* ---------- rendering ---------- */

/**
 * Everything is normalised to one spec before anything is joined.
 *
 * Sources never agree: the streams run at 29.97, old-site files at 29.97, the
 * first hero at 25, and aspect ratios vary. concat refuses to join clips that
 * differ, so each one is conformed first -- scaled to cover, cropped to fill,
 * resampled, square pixels, 8-bit 4:2:0.
 */
const conform = (w, h, fps) =>
  `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},fps=${fps},setsar=1,format=yuv420p`;

/**
 * The frame rate to cut at.
 *
 * `"source"` -- the default -- reads it off the first clip and keeps it, which
 * is almost always what you want: these sources are 29.97, and asking for 25
 * throws away five frames a second. On a parade that pans, that judder is the
 * most visible flaw in the whole film, and it costs nothing to avoid.
 *
 * A number or an exact fraction ("30000/1001") still forces a rate for the
 * rare case where something downstream insists on one.
 */
async function frameRateFor(project, firstSource) {
  const asked = project.output?.fps;
  if (asked && asked !== "source") return String(asked);
  try {
    const raw = probe(firstSource, "stream=r_frame_rate").split("\n")[0].trim();
    if (/^\d+\/\d+$/.test(raw) && !raw.startsWith("0/")) return raw;
  } catch {
    /* fall through to a safe default */
  }
  return "30000/1001";
}

async function render(projectPath) {
  const project = JSON.parse(fs.readFileSync(projectPath, "utf8"));
  const preview = has("--preview");
  const out = project.output ?? {};
  const width = preview ? 640 : out.width ?? 1920;
  const height = preview ? 360 : out.height ?? 1080;
  /* Resolved after the first source is openable -- it is read off that file. */
  let fps = "30000/1001";
  const crf = preview ? 30 : out.crf ?? 18;
  const name = out.name ?? path.basename(projectPath, ".json");
  const clips = project.clips ?? [];
  if (clips.length === 0) throw new Error("项目里一个片段都没有");

  const work = path.join(WORK, name, preview ? "preview" : "full");
  fs.mkdirSync(work, { recursive: true });
  const outDir = out.dir ?? "artifacts/hero";
  fs.mkdirSync(outDir, { recursive: true });

  if (!JSONOUT) console.log(`\n=== ${name}${preview ? "（小样）" : ""} ===\n`);

  /* Each distinct source is resolved once, however many clips come from it. */
  const resolved = new Map();
  const openFor = async (src) => {
    if (!resolved.has(src)) resolved.set(src, await bestRendition(await openable(src)));
    return resolved.get(src);
  };

  /*
   * Check every source before cutting anything.
   *
   * A render is minutes of work, and the two ways a project is wrong are both
   * knowable in seconds: a source that cannot be opened at all, and a clip
   * that asks for a moment past the end of its source.
   *
   * The second one is not hypothetical and not harmless. 干净世界's stream
   * clamps an out-of-range seek to the tail rather than failing, so asking for
   * three seconds from a point past the end returns three perfectly valid
   * seconds of the wrong thing -- the end card. Length-checking a clip cannot
   * catch that; only knowing how long the source is can.
   */
  const srcDurations = new Map();
  for (const src of new Set(clips.map((c) => c.source))) {
    let opened;
    try {
      opened = await openFor(src);
    } catch (err) {
      throw new Error(`打不开这条素材：${src}\n  ${String(err.message).slice(0, 200)}`);
    }
    const dur = Number(probe(opened, "format=duration")) || 0;
    srcDurations.set(src, dur);

    /*
     * Which rendition did we actually get?
     *
     * bestRendition asks for 1080p by four different names and, when none of
     * them answer, quietly hands back the master playlist -- at which point
     * ffmpeg chooses for itself and has been seen taking a 360p one. Every
     * check downstream would pass: right length, right frame count, right
     * output size. The film would simply be blurry, upscaled from 360p, and
     * nothing would say so.
     *
     * The four names are guesses about someone else's CDN. They will stop
     * being right one day, and this is what will notice.
     */
    const dims = probe(opened, "stream=width,height").split("\n").map(Number);
    const srcH = dims[1] || 0;
    const finalH = out.height ?? 1080;
    if (srcH > 0 && srcH < finalH * 0.6) {
      throw new Error(
        `这条素材只有 ${dims[0]}×${srcH}，正式版要出 ${out.width ?? 1920}×${finalH}——放大上去会糊。\n` +
        `  源：${src}\n` +
        `  多半是没找到高清那一路（干净世界改了命名），也可能这条片子本来就只有这个清晰度。\n` +
        `  确实想用的话，把「出片设置」里的高改成 ${srcH} 或更低。`
      );
    }
    const deepest = Math.max(...clips.filter((c) => c.source === src).map((c) => Number(c.to) || 0));
    if (dur > 0 && deepest > dur + 0.5) {
      throw new Error(
        `有片段取到了素材结尾之后：这条素材只有 ${dur.toFixed(1)} 秒，却要取到第 ${deepest} 秒。\n` +
        `  源：${src}\n` +
        `  注意：这种情况不会报错，只会给你素材最后那几秒（通常是片尾卡），所以必须先拦下来。`
      );
    }
    if (!JSONOUT) {
      console.log(`  素材 ${dur ? `${dur.toFixed(1)}s` : "时长未知"}  ${dims[0] || "?"}×${srcH || "?"}  ${src.slice(0, 56)}`);
    }
  }

  const parts = [];
  let total = 0;
  fps = await frameRateFor(project, await openFor(clips[0].source));
  if (!JSONOUT) console.log(`  帧率 ${fps}${out.fps && out.fps !== "source" ? "（项目指定）" : "（跟着素材）"}`);
  for (let i = 0; i < clips.length; i += 1) {
    const clip = clips[i];
    const from = Number(clip.from ?? 0);
    const to = Number(clip.to ?? from + 3);
    const len = +(to - from).toFixed(3);
    if (!(len > 0)) throw new Error(`第 ${i + 1} 个片段的 from/to 不对：${from} → ${to}`);
    let src = await openFor(clip.source);
    const file = path.join(work, `${String(i).padStart(3, "0")}.mp4`);
    /*
     * Seeking in two stages: a coarse jump before `-i`, then a fine one after.
     *
     * `-ss` before `-i` alone is fast but lands on a keyframe, and on an HLS
     * stream that means a segment boundary -- after which `-t` counts from the
     * time that was asked for rather than the time that was reached, so the
     * clip comes out short. Asking for 7.2 seconds of the parade returned 5.0.
     * Putting `-ss` only after `-i` is exact but decodes the whole file up to
     * that point, which on a 24-minute source is a long wait per clip.
     *
     * The coarse seek gets within PAD seconds cheaply; the fine seek walks the
     * rest exactly. Same frames as a local file, without the wait.
     */
    const PAD = 6;
    const coarse = Math.max(0, from - PAD);
    const fine = +(from - coarse).toFixed(3);

    /*
     * Cut it, then check it actually got cut.
     *
     * ffmpeg exiting 0 is not proof that anything came out. Pulling segments
     * from a remote HLS stream can fail in a way that writes a valid but
     * empty file and still reports success -- an older ffmpeg seeking deep
     * into 干净世界's stream does exactly this, and did: four parade clips at
     * 99s, 147s, 210s and 237s all came back empty while the three clips near
     * the head of their sources were fine. The film was assembled from them,
     * uploaded, and announced as finished, two thirds of it missing.
     *
     * So every clip is measured against what was asked for, and a short one
     * is retried before it is allowed to fail the whole render. Better to
     * stop with a clear reason than to publish a film with holes in it.
     */
    const want = len;
    let got = 0;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      ff(
        ["-ss", String(coarse), "-i", src, "-ss", String(fine), "-t", String(len), "-an",
         "-vf", conform(width, height, fps),
         "-c:v", "libx264", "-preset", preview ? "veryfast" : "veryslow",
         "-crf", String(preview ? 30 : crf), "-pix_fmt", "yuv420p",
         "-profile:v", "high", "-level", "4.0",
         file, "-y"],
        `片段 ${i + 1}`
      );
      got = Number(probe(file, "format=duration")) || 0;
      if (got >= want * 0.9) break;
      if (attempt < 3) {
        if (!JSONOUT) {
          console.log(`  片段 ${i + 1} 只取到 ${got.toFixed(2)}s（要 ${want.toFixed(2)}s），再试一次…`);
        }
        /* A failed pull is often a stale stream address rather than a bad
           file, so drop the cached one and resolve it again. */
        resolved.delete(clip.source);
        src = await openFor(clip.source);

        /*
         * Last attempt: stop streaming and fetch the source outright.
         *
         * Seeking deep into a remote HLS stream is where this breaks -- on
         * GitHub's runners the three clips near the head of their sources came
         * back fine while every clip past 99 seconds came back empty. Whatever
         * the cause (an older ffmpeg, a slow pull, the CDN), a local file does
         * not have the problem: seeking in one is just arithmetic.
         *
         * It costs one download of the whole source, so it is the fallback
         * rather than the default, and it is cached like any other opened
         * source -- the other clips from the same film reuse it, which is why
         * only the first deep clip ever pays for it.
         *
         * Taken on the first failure rather than the second: streaming has
         * already been shown not to work on this machine for this source, and
         * trying the same thing again mostly spends another minute proving it.
         */
        if (/^https?:/i.test(src)) {
          const local = path.join(work, `src-${resolved.size}-${i}.mp4`);
          if (!JSONOUT) console.log(`  改成先把整条源下下来再剪…`);
          try {
            ff(["-i", src, "-c", "copy", "-bsf:a", "aac_adtstoasc", local, "-y"], `下载源 ${i + 1}`);
            if ((Number(probe(local, "format=duration")) || 0) > 0) {
              resolved.set(clip.source, local);
              src = local;
            }
          } catch (err) {
            if (!JSONOUT) console.log(`  整条下载也没成：${String(err.message).slice(0, 160)}`);
          }
        }
      }
    }
    if (got < want * 0.9) {
      throw new Error(
        `片段 ${i + 1} 没取到画面：要 ${want.toFixed(2)} 秒，只拿到 ${got.toFixed(2)} 秒。\n` +
        `  源：${clip.source}\n` +
        `  从第 ${from} 秒起。已经重试并改用整条下载，都没取到。\n` +
        (from > 60
          ? `  这一段在源片较深的位置，这台机器上取不到那么深——多半是拉不到这条流。`
          : `  确认一下这条源还在、而且真有这么长。`)
      );
    }
    parts.push(file);
    total += len;
    if (!JSONOUT) console.log(`  ${String(i + 1).padStart(2)}. ${from.toFixed(1)}–${to.toFixed(1)}  ${len.toFixed(2)}s  ${clip.note ?? ""}`);
  }
  total = +total.toFixed(3);
  if (!JSONOUT) console.log(`\n  共 ${clips.length} 段，${total.toFixed(2)}s`);

  const listFile = path.join(work, "list.txt");
  fs.writeFileSync(listFile, parts.map((p) => `file '${path.resolve(p)}'`).join("\n"));
  const silent = path.join(work, "silent.mp4");
  ff(["-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", silent, "-y"], "拼接");

  /* ---- music ---- */
  let bed = null;
  const music = project.music;
  if (music?.from) {
    bed = path.join(work, "bed.wav");
    const srcLen = Number(probe(music.from, "format=duration")) || 0;
    const loudness = music.lufs ?? -16;

    if (music.loop && srcLen > 0 && srcLen < total) {
      /*
       * Looping a track that is shorter than the film.
       *
       * Cut to a whole number of beats so the pulse carries across the join,
       * then crossfade by one beat so the seam lands inside a beat rather than
       * on top of one. Without a bpm it falls back to a half-second fade, which
       * is audible on anything with a strong rhythm -- give it the bpm.
       */
      const beat = music.bpm ? 60 / music.bpm : 0.5;
      const beats = Math.max(1, Math.floor(srcLen / beat));
      const unit = +(beats * beat).toFixed(3);
      const one = path.join(work, "loop.wav");
      ff(["-i", music.from, "-vn", "-t", String(unit), "-ac", "2", "-ar", "48000", one, "-y"], "取音乐");
      const copies = Math.ceil(total / Math.max(0.1, unit - beat)) + 1;
      const inputs = [];
      for (let i = 0; i < copies; i += 1) inputs.push("-i", one);
      let filter = "";
      let prev = "0:a";
      for (let i = 1; i < copies; i += 1) {
        const label = i === copies - 1 ? "mix" : `x${i}`;
        filter += `[${prev}][${i}:a]acrossfade=d=${beat.toFixed(3)}:c1=tri:c2=tri[${label}];`;
        prev = label;
      }
      filter += `[${prev}]atrim=0:${total},afade=t=in:st=0:d=0.25,afade=t=out:st=${(total - 0.25).toFixed(3)}:d=0.25,loudnorm=I=${loudness}:TP=-1.5:LRA=11[a]`;
      ff([...inputs, "-filter_complex", filter, "-map", "[a]", bed, "-y"], "拼音乐");
      if (!JSONOUT) console.log(`  音乐：${music.bpm ?? "?"} BPM，循环单元 ${unit}s × ${copies} 段交叉淡接`);
    } else {
      const start = music.from_ ?? music.start ?? 0;
      ff(
        ["-ss", String(start), "-i", music.from, "-vn", "-ac", "2", "-ar", "48000",
         "-filter:a", `atrim=0:${total},afade=t=in:st=0:d=0.25,afade=t=out:st=${(total - 0.25).toFixed(3)}:d=0.25,loudnorm=I=${loudness}:TP=-1.5:LRA=11`,
         bed, "-y"],
        "音乐"
      );
      if (!JSONOUT) console.log(`  音乐：从 ${start}s 起，截 ${total.toFixed(2)}s`);
    }

    /*
     * And it has to reach the end.
     *
     * When the track's duration cannot be read -- an address that answers but
     * is not quite a media file, say -- srcLen is 0, looping is skipped, and
     * atrim simply yields however much there was. The film then plays with the
     * music stopping partway through and nothing said so. Measure the bed.
     */
    const bedLen = Number(probe(bed, "format=duration")) || 0;
    if (bedLen < total - 0.25) {
      throw new Error(
        `配乐只铺了 ${bedLen.toFixed(2)} 秒，片子有 ${total.toFixed(2)} 秒，后面会没声音。\n` +
        `  配乐：${music.from}\n` +
        (music.loop
          ? `  已经开了循环，但读不出这首曲子多长，所以没能接。换一个地址或上传一个文件试试。`
          : `  勾上「music 比片子短时循环」就会自动接满。`)
      );
    }
  }

  /*
   * No picture fade by default: these play on loop as a backdrop, and a dip to
   * black every half minute reads as a fault rather than as an ending. Set
   * "fade": true for a film that is watched once and stops.
   */
  /*
   * The clips were just encoded at the final quality, so the mux copies them
   * through. An earlier version encoded each clip at CRF 18 and then encoded
   * the joined film again at CRF 21 -- a whole generation of loss for nothing.
   * Only a fade needs the second pass, because that paints new pixels.
   */
  const fade = out.fade === true;
  const final = path.join(outDir, `${name}${preview ? "-preview" : ""}-${width}.mp4`);
  const args = ["-i", silent];
  if (bed) args.push("-i", bed);
  args.push("-map", "0:v");
  if (bed) args.push("-map", "1:a");
  if (fade) {
    args.push("-vf", `fade=t=in:st=0:d=0.5,fade=t=out:st=${(total - 1).toFixed(3)}:d=1`);
    args.push(
      "-c:v", "libx264", "-preset", preview ? "veryfast" : "veryslow", "-crf", String(crf),
      "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.0"
    );
  } else {
    args.push("-c:v", "copy");
  }
  args.push("-movflags", "+faststart");
  if (bed) args.push("-c:a", "aac", "-b:a", "160k", "-ar", "48000");
  args.push(final, "-y");
  ff(args, "成片");

  if (!JSONOUT) console.log(`\n  ${final}   ${(fs.statSync(final).size / 1048576).toFixed(1)} MB`);

  const made = [final];
  if (!preview && out.alsoWidth) {
    const h2 = Math.round((out.alsoWidth * height) / width / 2) * 2;
    const small = path.join(outDir, `${name}-${out.alsoWidth}.mp4`);
    ff(
      ["-i", final, "-vf", `scale=${out.alsoWidth}:${h2}`, "-c:v", "libx264", "-preset", "veryslow", "-crf", String(crf + 2),
       "-pix_fmt", "yuv420p", "-movflags", "+faststart", ...(bed ? ["-c:a", "copy"] : ["-an"]), small, "-y"],
      "小尺寸版"
    );
    made.push(small);
    if (!JSONOUT) console.log(`  ${small}   ${(fs.statSync(small).size / 1048576).toFixed(1)} MB`);
  }

  if (preview) {
    say(`\n  这是小样，只用来看剪得对不对。确认后去掉 --preview 出正式版。\n`,
        { files: made, duration: total, preview: true, uploaded: null });
    return;
  }
  if (!has("--upload")) {
    say(`\n  没有上传。加 --upload 会传到 Storage 并登记进图片视频库。\n`,
        { files: made, duration: total, preview: false, uploaded: null });
    return;
  }

  /*
   * Upload *and* register. Storage holds the bytes, `cms_media_assets` is the
   * index 图片视频库 reads -- writing only the file leaves editors unable to
   * see what was uploaded.
   */
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "media";
  const stamp = Date.now();
  if (!JSONOUT) console.log("\n=== 上传 ===");
  const urls = {};
  for (const file of made) {
    const base = path.basename(file);
    const key = `home/${stamp}-${base}`;
    const bytes = fs.readFileSync(file);
    const { error } = await supabase.storage.from(bucket).upload(key, bytes, { contentType: "video/mp4", upsert: true });
    if (error) throw error;
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${key}`;
    const { error: rowErr } = await supabase.from("cms_media_assets").insert({
      asset_type: "video",
      name: base,
      storage_path: url,
      mime_type: "video/mp4",
      byte_size: bytes.length,
      metadata: { uploadedBy: "scripts/video-studio.mjs", project: path.basename(projectPath) }
    });
    if (rowErr) throw rowErr;
    urls[base] = url;
    if (!JSONOUT) console.log(`  ${url}`);
  }
  fs.writeFileSync(path.join(outDir, `${name}-uploaded.json`), JSON.stringify(urls, null, 2));
  say(`\n  已登记进图片视频库。首页要换片，去后台「页面内容 → 首屏 Hero」把地址粘上。\n`,
      { files: made, duration: total, preview: false, uploaded: urls });
}

/* ---------- dispatch ---------- */

const first = argv.find((a) => !a.startsWith("--"));
try {
  if (has("--resolve")) await cmdResolve(valueOf("--resolve", first));
  else if (has("--scan")) await cmdScan(valueOf("--scan", first), Number(valueOf("--every", 8)));
  else if (has("--cuts")) await cmdCuts(valueOf("--cuts", first));
  else if (has("--look")) {
    const src = valueOf("--look", first);
    const times = argv.slice(argv.indexOf("--look") + 2).filter((a) => /^[0-9.]+$/.test(a)).map(Number);
    if (times.length === 0) throw new Error("--look 后面要给来源，再给几个秒数");
    await cmdLook(src, times);
  } else if (first) await render(first);
  else {
    console.log(fs.readFileSync(new URL(import.meta.url)).toString().split("*/")[0].replace(/^\/\*\*?/, "").replace(/^ \* ?/gm, ""));
  }
} catch (err) {
  console.error(`\n  ${err.message}\n`);
  process.exit(1);
}
