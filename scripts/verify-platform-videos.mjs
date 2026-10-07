/**
 * Checks which platform-hosted videos still play, and writes the allowlist that
 * `import-videos.ts --include-platform` reads.
 *
 * The old posts embed YouTube players going back to 2009, and a good share of
 * those videos have since been removed or had embedding turned off. Importing
 * the list unchecked would fill the video library with dead players, so every
 * address is asked before it is listed.
 *
 * YouTube is checked with oEmbed, which needs no API key. Note the bodies carry
 * `/embed/<id>` addresses and oEmbed only answers for watch URLs -- checking the
 * embed form directly returns 404 for every video, dead or alive.
 *
 *   node --env-file=.env.local scripts/verify-platform-videos.mjs
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOC = path.join(process.cwd(), "artifacts/phase5/video-allocation.json");
const OUT = path.join(process.cwd(), "artifacts/phase5/platform-orphans-live.json");

const alloc = JSON.parse(fs.readFileSync(ALLOC, "utf8")).items;
const orphans = alloc.filter((entry) => entry.group === "orphan");
const ids = orphans.map((entry) => entry.legacyId);

const rows = [];
for (let i = 0; i < ids.length; i += 200) {
  const { data, error } = await supabase
    .from("cms_articles")
    .select("legacy_id, title, published_at, body_markdown")
    .in("legacy_id", ids.slice(i, i + 200));
  if (error) throw error;
  rows.push(...(data ?? []));
}

const YT = /https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/\S*[^\s.,)\]]/i;
const GJW = /https?:\/\/(?:www\.)?ganjingworld\.com\/\S*[^\s.,)\]]/i;

const candidates = [];
for (const row of rows) {
  const body = String(row.body_markdown ?? "");
  const gjw = body.match(GJW)?.[0];
  const yt = body.match(YT)?.[0];
  if (gjw) candidates.push({ ...row, platform: "gjw", url: gjw });
  else if (yt) candidates.push({ ...row, platform: "yt", url: yt });
}
console.log(`\n  待核对 ${candidates.length} 条（YouTube ${candidates.filter((c) => c.platform === "yt").length}，干净世界 ${candidates.filter((c) => c.platform === "gjw").length}）\n`);

const live = [];
const dead = [];
let done = 0;
for (const c of candidates) {
  done += 1;
  let ok = false;
  let note = "";
  if (c.platform === "yt") {
    const id = c.url.match(/(?:embed\/|v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/)?.[1];
    if (id) {
      const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`).catch(() => null);
      ok = r?.status === 200;
      note = ok ? (await r.json()).title ?? "" : `HTTP ${r?.status ?? "ERR"}`;
    } else note = "地址里找不到影片 id";
  } else {
    // Gan Jing World has no oEmbed; a HEAD on the watch page is enough to tell
    // a live id from a removed one.
    const r = await fetch(c.url, { method: "HEAD" }).catch(() => null);
    ok = Boolean(r && r.status < 400);
    note = `HTTP ${r?.status ?? "ERR"}`;
  }
  (ok ? live : dead).push({ legacyId: c.legacy_id, title: c.title, publishedAt: c.published_at, url: c.url, platform: c.platform, note });
  if (done % 20 === 0) process.stdout.write(`\r  已核对 ${done}/${candidates.length}   `);
}
process.stdout.write("\r".padEnd(60) + "\r");

fs.writeFileSync(OUT, JSON.stringify({ checkedAt: new Date().toISOString(), live, dead }, null, 2));
console.log(`  可播 ${live.length} 条，失效 ${dead.length} 条`);
const byYear = {};
for (const d of dead) { const y = String(d.publishedAt).slice(0, 4); byYear[y] = (byYear[y] ?? 0) + 1; }
console.log(`  失效的按年份：${Object.entries(byYear).sort().map(([y, n]) => `${y}:${n}`).join("  ")}`);
console.log(`\n  名单已写入 ${path.relative(process.cwd(), OUT)}`);
console.log("  下一步：npx tsx scripts/import-videos.ts --include-platform --apply");
