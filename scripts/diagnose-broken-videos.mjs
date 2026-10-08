/**
 * Says *why* each unplayable film is unplayable.
 *
 * The oEmbed check can only tell playable from not: a 404 covers deleted,
 * private and terminated-channel alike, and those call for different answers --
 * a film pulled for copyright is gone, but a whole channel being terminated
 * takes hundreds of good films with it and they may exist elsewhere.
 *
 * The watch page carries the real reason in `playabilityStatus`, so this reads
 * that. Read-only; writes a CSV.
 *
 *   node --env-file=.env.local scripts/diagnose-broken-videos.mjs others
 *   node --env-file=.env.local scripts/diagnose-broken-videos.mjs            # 全库
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const CATEGORY = process.argv[2] || "";
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

function youtubeId(url) {
  const v = String(url ?? "").trim();
  const m =
    v.match(/youtube\.com\/watch\?v=([A-Za-z0-9_-]{6,20})/) ??
    v.match(/youtu\.be\/([A-Za-z0-9_-]{6,20})/) ??
    v.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{6,20})/);
  return m ? m[1] : "";
}

async function videoRows() {
  if (CATEGORY) {
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
  const out = [];
  for (let page = 0; ; page += 1) {
    const { data } = await s
      .from("cms_videos")
      .select("id, slug, title, source_url, published_at")
      .eq("status", "published")
      .range(page * 500, page * 500 + 499);
    out.push(...(data ?? []));
    if (!data || data.length < 500) break;
  }
  return out;
}

/** What the watch page says, mapped to something an editor can act on. */
function readReason(html) {
  const status = html.match(/"playabilityStatus":\{"status":"(\w+)"/)?.[1] ?? "";
  const reason =
    html.match(/"playabilityStatus":\{[^}]*?"reason":"([^"]{0,120})"/)?.[1] ??
    html.match(/"reason":\{"simpleText":"([^"]{0,120})"/)?.[1] ??
    html.match(/"reason":\{"runs":\[\{"text":"([^"]{0,120})"/)?.[1] ??
    "";
  const sub =
    html.match(/"subreason":\{"simpleText":"([^"]{0,160})"/)?.[1] ??
    html.match(/"subreason":\{"runs":\[\{"text":"([^"]{0,160})"/)?.[1] ??
    "";
  const blob = `${reason} ${sub}`;

  if (/terminated|account associated|帐户已终止|帳戶已終止/i.test(blob)) return ["频道被封", blob];
  if (/private|私人|私享/i.test(blob)) return ["已设为私有", blob];
  if (/removed by the uploader|uploader has (removed|deleted)|已由上傳者移除|上传者已删除/i.test(blob))
    return ["上传者已删除", blob];
  if (/copyright|版權|版权/i.test(blob)) return ["版权下架", blob];
  if (/not available in your country|地區|地区|country/i.test(blob)) return ["地区封锁", blob];
  if (/violat|guidelines|社群規範|社区准则/i.test(blob)) return ["违反社群规范被移除", blob];
  if (status === "LOGIN_REQUIRED") return [/age|年齡|年龄/i.test(blob) ? "年龄限制" : "须登录才能看", blob];
  if (status === "UNPLAYABLE") return ["无法播放（原因未写明）", blob];
  if (status === "ERROR") return ["影片不存在", blob];
  if (status === "OK") return ["其实可以播放", blob];
  return [status ? `其它（${status}）` : "读不出状态", blob];
}

const rows = await videoRows();
console.log(`  共 ${rows.length} 支，先用 oEmbed 挑出播不了的…\n`);

/* Pass 1 -- cheap, finds the broken ones. */
const suspects = [];
let scanned = 0;
async function pool(items, limit, worker) {
  const q = [...items];
  await Promise.all(Array.from({ length: limit }, async () => { while (q.length) await worker(q.shift()); }));
}
await pool(rows, 6, async (row) => {
  const url = String(row.source_url ?? "").trim();
  const id = youtubeId(url);
  if (!url) suspects.push({ ...row, id: "", pre: "没有地址" });
  else if (!id) {
    if (!/ganjing/i.test(url)) suspects.push({ ...row, id: "", pre: "非 YouTube" });
  } else {
    try {
      const res = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`,
        { signal: AbortSignal.timeout(20000) }
      );
      if (!res.ok) suspects.push({ ...row, id, pre: `oEmbed ${res.status}` });
    } catch {
      suspects.push({ ...row, id, pre: "检查超时" });
    }
  }
  scanned += 1;
  if (scanned % 50 === 0) process.stdout.write(`\r  已扫 ${scanned}/${rows.length}   `);
});
process.stdout.write(`\r  已扫 ${scanned}/${rows.length}   \n`);
console.log(`  播不了的 ${suspects.length} 支，逐个问 YouTube 原因…\n`);

/* Pass 2 -- the watch page, for the ones that failed. */
const out = [];
let n = 0;
await pool(suspects, 4, async (row) => {
  if (!row.id) {
    out.push({ ...row, reason: row.pre, raw: String(row.source_url ?? "").slice(0, 60) });
  } else {
    try {
      const res = await fetch(`https://www.youtube.com/watch?v=${row.id}`, {
        headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" },
        signal: AbortSignal.timeout(25000)
      });
      const [reason, raw] = readReason(await res.text());
      out.push({ ...row, reason, raw: raw.trim().slice(0, 90) });
    } catch (error) {
      out.push({ ...row, reason: "问不到（超时）", raw: error instanceof Error ? error.message.slice(0, 50) : "" });
    }
  }
  n += 1;
  if (n % 10 === 0) process.stdout.write(`\r  已问 ${n}/${suspects.length}   `);
});
process.stdout.write(`\r  已问 ${n}/${suspects.length}   \n\n`);

const tally = {};
for (const r of out) tally[r.reason] = (tally[r.reason] ?? 0) + 1;
console.log("=== 播不了的原因 ===");
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(v).padStart(4)}  ${k}`);
}

const file = CATEGORY ? `docs/implementation/video-broken-${CATEGORY}.csv` : "docs/implementation/video-broken.csv";
const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
fs.writeFileSync(
  file,
  ["原因,标题,发布日期,地址,slug,YouTube原话", ...out
    .sort((a, b) => a.reason.localeCompare(b.reason))
    .map((r) => [r.reason, r.title, (r.published_at ?? "").slice(0, 10), r.source_url, r.slug, r.raw].map(esc).join(","))
  ].join("\n")
);
console.log(`\n  名单已写入 ${file}`);
