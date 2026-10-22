/**
 * 英文站：把按中文旧 ID 写的链接换成英文自己的地址。
 *
 *     npm run fix:en:links                 # 预演
 *     npm run fix:en:links -- --apply
 *
 * ## 这些链接坏在哪
 *
 * 英文站的「页面内容」是从中文站那份克隆再逐条翻译过来的。文案翻了，href
 * 没动 —— 而其中十三条写的是 /services/faq/d/694467、/news/a/690040 这种
 * 按 WordPress 旧 ID 的写法。那套 ID 路由是按 legacy_id 去查、再 301 到
 * slug，查出来的是中文那条，于是英文站上点下去是：301 正常跳转，落到一个
 * 中文 slug，而那篇在英文站不存在 —— 404。
 *
 * 这种坏法特别难发现：页面 200、链接解析正常、文案也是英文的，只有真的点
 * 下去才知道。links:check 原来也看不见，因为它见到 3xx 就算通过、不跟到底
 * （已经一并修掉）。
 *
 * ## 为什么用一张写死的表
 *
 * 可以按「中文问答的 legacy_id → 中文 slug → 找同题的英文问答」自动推，但
 * 那要靠标题匹配，而两边的标题是翻译关系不是对应关系（「如何办理退党证明？」
 * 对 "How do I apply for a certificate?"）。猜错一条，读者点「怎么验证证明」
 * 看到的是「证明是什么」—— 比 404 更难察觉。
 *
 * 所以逐条人工对出来写成表，脚本只负责核对和替换：每个目标都要真的在
 * cms_faqs / cms_articles 里、且是 published，否则整个脚本停下不写。
 */

import pg from "pg";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

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

/** 旧 ID 地址 → 英文站自己的地址。右边那一列逐条对过中英两边的问题。 */
const MAP: Record<string, string> = {
  /* 三退 */
  "/services/faq/d/694368": "/services/faq/what-is-quitting-the-ccp",
  "/services/faq/d/694427": "/services/faq/why-quit-the-ccp",
  "/services/faq/d/698548": "/services/faq/how-to-quit-the-ccp",
  "/services/faq/d/694378": "/services/faq/do-unpaid-dues-count-as-leaving",
  /* 退党证明 */
  "/services/faq/d/694366": "/services/faq/what-is-a-certificate-of-withdrawal",
  "/services/faq/d/694454": "/services/faq/how-to-apply-for-a-certificate",
  "/services/faq/d/694449": "/services/faq/how-to-verify-a-certificate",
  "/services/faq/d/694391": "/services/faq/why-apply-early-if-leaving-china",
  /* 移民相关 */
  "/services/faq/d/694460": "/services/faq/uscis-on-communist-party-membership",
  "/services/faq/d/694462": "/services/faq/uscis-discretionary-waivers",
  "/services/faq/d/694467": "/services/faq/members-must-provide-the-certificate-themselves",
  "/services/faq/d/694476": "/services/faq/non-immigrant-visas-also-ask",
  "/services/faq/d/694464": "/services/faq/naturalised-citizens-may-also-be-removed"
};

async function main() {
  loadEnv(resolve(process.cwd(), ".env.local"));
  loadEnv(resolve(process.cwd(), ".env"));
  const apply = process.argv.includes("--apply");

  const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log(`\n===== 英文站：按旧 ID 写的链接${apply ? "" : "（预演）"} =====\n`);

  /* ---- 目标必须真的在 ---- */
  const { rows: faqs } = await c.query(
    `select slug, question, status from cms_faqs where locale='en'`);
  const faqBySlug = new Map(faqs.map((f: any) => [`/services/faq/${f.slug}`, f]));
  const missing: string[] = [];
  for (const [from, to] of Object.entries(MAP)) {
    const hit = faqBySlug.get(to);
    if (!hit) missing.push(`${to}（${from} 要指过去）—— 英文问答里没有`);
    else if (hit.status !== "published") missing.push(`${to} 是 ${hit.status}，不是 published`);
  }
  if (missing.length > 0) {
    console.log("✗ 目标对不上，一个字都不写：");
    for (const m of missing) console.log(`   ${m}`);
    throw new Error("映射表和库对不上");
  }
  console.log(`  映射 ${Object.keys(MAP).length} 条，目标全部存在且已发布`);

  /* ---- 改 ---- */
  const { rows: entries } = await c.query(
    `select path, data from cms_content_entries where locale='en' order by path`);

  let touched = 0;
  const changes: { path: string; from: string; to: string; n: number }[] = [];
  const next: { path: string; data: string }[] = [];

  for (const e of entries) {
    let text = JSON.stringify(e.data);
    const before = text;
    for (const [from, to] of Object.entries(MAP)) {
      /* JSON.stringify 里 / 不转义，所以直接按字串换；加引号边界避免
         /d/6943 误伤 /d/694368 这种前缀关系。 */
      const n = text.split(`"${from}"`).length - 1;
      if (n > 0) {
        text = text.split(`"${from}"`).join(`"${to}"`);
        changes.push({ path: e.path, from, to, n });
      }
    }
    if (text !== before) { touched += 1; next.push({ path: e.path, data: text }); }
  }

  console.log(`\n  ── 要改的 ${changes.length} 处，分布在 ${touched} 个页面条目 ──`);
  let last = "";
  for (const ch of changes) {
    if (ch.path !== last) { console.log(`\n     ${ch.path}`); last = ch.path; }
    console.log(`        ${ch.from}  →  ${ch.to}${ch.n > 1 ? `  ×${ch.n}` : ""}`);
  }

  /* 还剩哪些按旧 ID 写的没在表里 —— 漏一条就是漏一个 404。 */
  const leftover = new Set<string>();
  for (const e of next.length ? next : entries.map((x: any) => ({ path: x.path, data: JSON.stringify(x.data) }))) {
    for (const m of String(e.data).matchAll(/"(\/(?:services\/faq\/d|news\/a)\/\d+)"/g)) leftover.add(m[1]);
  }
  for (const e of entries) {
    if (next.some((n) => n.path === e.path)) continue;
    for (const m of JSON.stringify(e.data).matchAll(/"(\/(?:services\/faq\/d|news\/a)\/\d+)"/g)) leftover.add(m[1]);
  }
  if (leftover.size > 0) {
    console.log(`\n  ── 改完之后还剩 ${leftover.size} 个按旧 ID 写的链接，表里没有 ──`);
    for (const l of leftover) console.log(`     ${l}`);
  } else {
    console.log(`\n  ✓ 改完之后英文内容里不再有按旧 ID 写的链接`);
  }

  if (!apply) {
    console.log("\n（预演，一个字都没写。加 --apply 才真跑。）\n");
    await c.end();
    return;
  }

  const dump = resolve(process.cwd(), "backups", `en-id-links-${new Date().toISOString().slice(0, 10)}.json`);
  writeFileSync(dump, JSON.stringify(entries.filter((e: any) => next.some((n) => n.path === e.path)), null, 1), "utf8");
  console.log(`\n  ✓ 改动前的原样已备份到 ${dump}`);

  await c.query("begin");
  try {
    for (const n of next) {
      await c.query(
        `update cms_content_entries set data=$1, updated_at=now(), updated_by='fix-en-id-links'
         where locale='en' and path=$2`, [n.data, n.path]);
    }
    await c.query("commit");
  } catch (error) {
    await c.query("rollback");
    throw error;
  }
  console.log(`  ✓ 改了 ${touched} 个页面条目、${changes.length} 处链接`);
  console.log("\n✓ 跑完了。\n");
  await c.end();
}

main().catch((error) => {
  console.error(`\n✗ ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
