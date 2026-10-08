/**
 * Checks whether each video's address still plays.
 *
 * A YouTube id that has been deleted, made private or blocked still renders an
 * iframe -- the reader sees a black box saying the video is unavailable, and
 * nothing in our own data says anything is wrong. The oEmbed endpoint answers
 * 404 for exactly those, needs no API key, and is the cheapest honest check.
 *
 * Read-only: writes a CSV and changes nothing.
 *
 *   node --env-file=.env.local scripts/check-video-playability.mjs            # 全部
 *   node --env-file=.env.local scripts/check-video-playability.mjs others     # 只查一个分类
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const CATEGORY = process.argv[2] || "";
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function youtubeId(url) {
  const v = String(url ?? "").trim();
  const m =
    v.match(/youtube\.com\/watch\?v=([A-Za-z0-9_-]{6,20})/) ??
    v.match(/youtu\.be\/([A-Za-z0-9_-]{6,20})/) ??
    v.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{6,20})/);
  return m ? m[1] : "";
}

async function rows() {
  if (!CATEGORY) {
    const out = [];
    for (let page = 0; ; page += 1) {
      const { data, error } = await s
        .from("cms_videos")
        .select("id, slug, title, source_url, published_at")
        .eq("status", "published")
        .range(page * 500, page * 500 + 499);
      if (error) throw error;
      out.push(...(data ?? []));
      if (!data || data.length < 500) break;
    }
    return out;
  }
  const { data: cat } = await s.from("cms_video_categories").select("id, name").eq("slug", CATEGORY).maybeSingle();
  if (!cat) throw new Error(`没有这个分类: ${CATEGORY}`);
  const { data: map } = await s.from("cms_video_category_map").select("video_id").eq("category_id", cat.id);
  const ids = (map ?? []).map((r) => String(r.video_id));
  const out = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await s
      .from("cms_videos")
      .select("id, slug, title, source_url, published_at")
      .in("id", ids.slice(i, i + 200))
      .eq("status", "published");
    out.push(...(data ?? []));
  }
  console.log(`  分类：${cat.name}`);
  return out;
}

const all = await rows();
console.log(`  待检查 ${all.length} 支\n`);

const results = [];
let done = 0;

/** Keeps YouTube from seeing a burst; 6 at a time is unremarkable traffic. */
async function pool(items, limit, worker) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (queue.length) await worker(queue.shift());
    })
  );
}

await pool(all, 6, async (row) => {
  const url = String(row.source_url ?? "").trim();
  let state = "";
  let detail = "";

  if (!url) {
    state = "没有地址";
  } else {
    const id = youtubeId(url);
    if (!id) {
      state = /ganjing/i.test(url) ? "干净世界（未检查）" : "非 YouTube（未检查）";
      detail = url.slice(0, 80);
    } else {
      try {
        const res = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`,
          { signal: AbortSignal.timeout(20000) }
        );
        if (res.ok) {
          state = "可播放";
          detail = String((await res.json()).title ?? "").slice(0, 60);
        } else if (res.status === 404) {
          state = "已删除或设为私有";
        } else if (res.status === 401) {
          state = "禁止嵌入";
        } else if (res.status === 403) {
          // YouTube answers 403 for a video whose watch page reports
          // LOGIN_REQUIRED -- age-restricted, or sign-in only. Either way an
          // anonymous reader gets an error inside the iframe, so it counts as
          // broken even though the video still exists.
          state = "需要登录才能看";
        } else {
          state = `未知 HTTP ${res.status}`;
        }
      } catch (error) {
        state = "检查失败";
        detail = error instanceof Error ? error.message.slice(0, 50) : "";
      }
      detail = detail || id;
    }
  }

  results.push({ ...row, state, detail });
  done += 1;
  if (done % 25 === 0) process.stdout.write(`\r  已检查 ${done}/${all.length}   `);
});

process.stdout.write(`\r  已检查 ${done}/${all.length}   \n\n`);

const tally = {};
for (const r of results) tally[r.state] = (tally[r.state] ?? 0) + 1;
console.log("=== 结果 ===");
for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${k}`);
}

const broken = results.filter((r) => /已删除|禁止嵌入|需要登录|没有地址/.test(r.state));
if (broken.length) {
  console.log(`\n=== 播不了的 ${broken.length} 支（前 20）===`);
  for (const r of broken.slice(0, 20)) {
    console.log(`  ${(r.published_at ?? "").slice(0, 10)}  ${r.state.padEnd(10)}  ${r.title.slice(0, 40)}`);
  }
}

const file = CATEGORY ? `docs/implementation/video-playability-${CATEGORY}.csv` : "docs/implementation/video-playability.csv";
const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
fs.writeFileSync(
  file,
  ["状态,标题,发布日期,地址,slug,备注", ...results
    .sort((a, b) => a.state.localeCompare(b.state))
    .map((r) => [r.state, r.title, (r.published_at ?? "").slice(0, 10), r.source_url, r.slug, r.detail].map(esc).join(","))
  ].join("\n")
);
console.log(`\n  名单已写入 ${file}`);
