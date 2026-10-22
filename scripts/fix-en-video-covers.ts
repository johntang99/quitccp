/**
 * 英文站：把打不开的影片封面换成能打开的那一张。
 *
 *     npm run fix:en:covers                 # 预演
 *     npm run fix:en:covers -- --apply
 *
 * ## 这些封面为什么是坏的
 *
 * import:en:videos 取封面取的是 WordPress 的 `wp:featuredmedia.source_url`，
 * 也就是「原图」。那套《铁证如山》的原图是 .avif，而旧站的 Cloudflare 对
 * .avif 返回 403 —— 带不带浏览器 UA、带不带 Referer 都一样。同一个目录下的
 * .png 是 200，所以不是整站封锁，是这些文件打不开。
 *
 * 于是英文站 /videos 上 33 支影片全是碎图，而任何检查都发现不了：数据库里
 * 的地址是合法字符串，页面也 200。是逐个去请求图片才看出来的。
 *
 * ## 为什么不直接拼一个尺寸后缀
 *
 * 第一版想当然地把 tzrs01.avif 换成 tzrs01-1024x632.jpeg。tzrs32 有这张，
 * 于是看起来成了；tzrs01、tzrs12 根本没有任何 .jpeg 版本，全是 404 —— 等于
 * 把一种坏换成另一种坏，而且这次连 403 都没有，是干脆的 404。
 *
 * WordPress 给每张图生成哪些尺寸、什么格式，是按上传时的设置来的，一张一个
 * 样。所以这里不猜：把媒体接口列出的候选地址全要过来，逐个真的去请求，取
 * 能打开的里面最大的一张。一个都打不开就留空 —— 没有封面的卡片比碎图好看。
 */

import pg from "pg";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SOURCE = "https://global.tuidang.org";
const PROXY = "https://r.jina.ai/";
const VIDEO_CATEGORY_ID = 4620;

function loadEnv(file: string) {
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (process.env[key] !== undefined) continue;
      process.env[key] = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    }
  } catch {
    /* 可选文件。 */
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const res = await fetch(`${PROXY}${SOURCE}/wp-json/wp/v2/${path}`, { signal: AbortSignal.timeout(120_000) });
      const text = await res.text();
      const start = text.search(/[[{]"?/);
      if (start < 0) throw new Error("响应里找不到 JSON");
      const close = text[start] === "[" ? "]" : "}";
      const end = text.lastIndexOf(close);
      return JSON.parse(text.slice(start, end + 1)) as T;
    } catch (error) {
      if (attempt === 5) throw error;
      await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
  }
  throw new Error("取不到");
}

/** 真的去请求一次。只看状态码 —— 403 和 404 都算打不开。 */
async function reachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: { range: "bytes=0-512", "user-agent": "Mozilla/5.0", accept: "image/avif,image/webp,*/*" },
      signal: AbortSignal.timeout(25_000)
    });
    return res.status < 400;
  } catch {
    return false;
  }
}

/** 地址里的 -1024x632 这种后缀，用来挑最大的那张。认不出算 0。 */
function pixels(url: string): number {
  const m = url.match(/-(\d{2,5})x(\d{2,5})\.[a-z0-9]+$/i);
  return m ? Number(m[1]) * Number(m[2]) : 0;
}

interface WpPost {
  slug: string;
  _embedded?: { "wp:featuredmedia"?: { source_url?: string; media_details?: { sizes?: Record<string, { source_url?: string }> } }[] };
}

async function main() {
  loadEnv(resolve(process.cwd(), ".env.local"));
  loadEnv(resolve(process.cwd(), ".env"));
  const apply = process.argv.includes("--apply");

  const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log(`\n===== 英文站影片封面${apply ? "" : "（预演）"} =====\n`);

  const { rows: vids } = await c.query(
    `select id, slug, title, cover_image from cms_videos where locale='en' and cover_image <> '' order by episode`);
  console.log(`  有封面的影片 ${vids.length} 支，先逐个请求看哪些打不开……`);

  const broken: typeof vids = [];
  for (let i = 0; i < vids.length; i += 8) {
    await Promise.all(vids.slice(i, i + 8).map(async (v: any) => {
      if (!(await reachable(String(v.cover_image)))) broken.push(v);
    }));
  }
  console.log(`  打不开的 ${broken.length} 支\n`);
  if (broken.length === 0) {
    console.log("✓ 封面都是好的，不用改。\n");
    await c.end();
    return;
  }

  const posts = await fetchJson<WpPost[]>(
    `posts?per_page=100&categories=${VIDEO_CATEGORY_ID}&_embed=wp:featuredmedia`);
  const candidates = new Map<string, string[]>();
  for (const p of posts) {
    const m = p._embedded?.["wp:featuredmedia"]?.[0];
    const list = new Set<string>();
    if (m?.source_url) list.add(m.source_url);
    for (const size of Object.values(m?.media_details?.sizes ?? {})) {
      if (size?.source_url) list.add(size.source_url);
    }
    candidates.set(p.slug, [...list]);
  }

  const picks: { id: string; slug: string; title: string; from: string; to: string }[] = [];
  for (const v of broken) {
    /*
     * 最大的优先试 —— 封面在首页推荐位上要占半幅，小图会糊。但不是「挑最大
     * 的那个地址」，是「在能打开的里面挑最大的」：这两件事在这里差得很远，
     * 最大的那张恰恰就是打不开的原图。
     */
    const list = (candidates.get(String(v.slug)) ?? []).sort((a, b) => pixels(b) - pixels(a));
    let found = "";
    for (const u of list) {
      if (u === String(v.cover_image)) continue;
      if (await reachable(u)) { found = u; break; }
    }
    picks.push({ id: String(v.id), slug: String(v.slug), title: String(v.title), from: String(v.cover_image), to: found });
  }

  const fixed = picks.filter((p) => p.to);
  const cleared = picks.filter((p) => !p.to);
  console.log(`  ── 换成能打开的 ${fixed.length} 支 ──`);
  for (const p of fixed) {
    console.log(`     ${p.title.slice(0, 50)}`);
    console.log(`        ${p.from.split("/").pop()}  →  ${p.to.split("/").pop()}`);
  }
  if (cleared.length > 0) {
    console.log(`\n  ── 一个候选都打不开、封面留空 ${cleared.length} 支 ──`);
    for (const p of cleared) console.log(`     ${p.title.slice(0, 56)}`);
  }

  if (!apply) {
    console.log("\n（预演，一个字都没写。加 --apply 才真跑。）\n");
    await c.end();
    return;
  }

  await c.query("begin");
  try {
    for (const p of picks) {
      await c.query(`update cms_videos set cover_image=$1, updated_at=now() where id=$2`, [p.to, p.id]);
    }
    await c.query("commit");
  } catch (error) {
    await c.query("rollback");
    throw error;
  }
  console.log(`\n  ✓ 换了 ${fixed.length} 支，清空 ${cleared.length} 支`);
  console.log("\n✓ 跑完了。\n");
  await c.end();
}

main().catch((error) => {
  console.error(`\n✗ ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
