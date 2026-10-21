/**
 * 界面文案抽出来了多少，英文表又缺多少。
 *
 * 两件事一起报，因为它们是同一项工作的两头：
 *
 *   1. 代码里还剩多少写死的中文 —— 这些在英文站上会原样显示成中文
 *   2. 中文表里有、英文表里没有的 key —— 这些会回退成中文，同样是中文
 *
 * 分开看任何一个都会得出「快做完了」的错觉。
 *
 * ## 为什么只数非注释行
 *
 * 这个仓库的注释是中文写的，而且写得很密。把注释算进去，数字会被淹没，看不出
 * 真正的进度。判断方式很粗（行首是不是 * 或 //），但对这个用途够了 —— 它要回答
 * 的是「还剩多少」，不是「精确到个位」。
 *
 *     npm run i18n:check
 *     npm run i18n:check -- --files   # 按文件列出来
 *     npm run i18n:check -- --files --top=200   # 不截断
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const SHOW_FILES = process.argv.includes("--files");
/* 默认只列前 25 个，翻译期间需要看全量：npm run i18n:check -- --files --top=200 */
const TOP = Number(process.argv.find((a) => a.startsWith("--top="))?.slice(6)) || 25;
const HAN = /[一-鿿]/g;

/** 这些地方的中文不算「界面文案」。 */
const SKIP = [
  "lib/i18n/",            // 文案表本身
  "lib/zh-variants",      // 繁简字符表：中文专属数据，不是文案
  "lib/search-synonyms",  // 同义词表：同上，已按语言门控
  "lib/zhuichaguoji",     // 外部数据源的字段名
  "components/public/HeroLab",  // 首屏比例试验台：hero-lab 路由在生产环境直接 404
  "app/hero-lab/",
  ".test.ts"
];

interface Row {
  file: string;
  chars: number;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".ts") || full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/**
 * 非注释、非「CMS 兜底」行里的汉字数。
 *
 * 模板（components/templates/*）里的长句大多是这个形状：
 *
 *   asString(payload.subtitle, "我们提供三项服务：……")
 *
 * 第二个参数是 CMS 里那一行缺失时的兜底。而编辑内容本来就按语言存在
 * cms_content_entries 里 —— 英文站有英文的那一行。把这些算成「待翻译的界面
 * 文案」会把数字抬高四五倍，让人以为工作量是实际的好几倍，然后去翻译一批
 * 永远不该出现在英文站上的句子。
 *
 * 判断很粗：这一行里出现了 asString / asStringArray / asObjectArray 就跳过。
 * 会漏掉少数真正的界面文案，但方向是对的 —— 这个数字要回答「还剩多少活」，
 * 宁可偏少也不要偏多到没人信。
 */
const CMS_FALLBACK = /\bas(String|StringArray|ObjectArray|Record)\s*\(/;

function uiChars(file: string): number {
  let n = 0;
  let inFallback = false;
  let inBlockComment = false;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();

    /*
     * 跨多行的注释要整段跳过，不能只看行首。
     *
     * 原来只认行首是 * 或 // 的行，于是 `{/* 说明…` 这种 JSX 注释的第二行
     * 开始全被算成待翻文案 —— 这个仓库的注释写得密，几百字就这么虚挂在待办上，
     * 而数字降不到零就没人信它。
     */
    if (inBlockComment) {
      if (line.includes("*/")) inBlockComment = false;
      continue;
    }
    const opensBlock = /\/\*|\{\s*\/\*/.test(line);
    if (opensBlock && !line.includes("*/")) {
      inBlockComment = true;
      continue;
    }
    if (opensBlock) continue;

    if (trimmed.startsWith("*") || trimmed.startsWith("//")) continue;
    /* console.* 永远不是界面 —— 它只进日志。算进来会让「还剩多少要翻」
       虚高，而这个数字是用来判断英文站还差多少才能上线的。 */
    if (/\bconsole\.(log|warn|error|info|debug)\(/.test(line)) continue;
    /* asString( 可能跨多行，第二个参数常单独一行。看到它就进入兜底区，
       直到这一段的括号配平为止。 */
    if (CMS_FALLBACK.test(line)) inFallback = true;
    if (inFallback) {
      const opens = (line.match(/\(/g) ?? []).length;
      const closes = (line.match(/\)/g) ?? []).length;
      if (closes >= opens) inFallback = false;
      continue;
    }
    n += (line.match(HAN) ?? []).length;
  }
  return n;
}

function scan(root: string): Row[] {
  return walk(root)
    .filter((f) => !SKIP.some((s) => f.includes(s)))
    .map((file) => ({ file: file.replace("apps/web/src/", ""), chars: uiChars(file) }))
    .filter((r) => r.chars > 0)
    .sort((a, b) => b.chars - a.chars);
}

const all = scan("apps/web/src");
/* app/api/admin/* 也是后台 —— 它返回的错误提示只有后台界面会显示。
   漏掉它会让公开站的数字虚高，而这个数字是用来判断「英文站还差多少才能上线」的。 */
const isAdmin = (f: string) =>
  f.startsWith("app/admin/") ||
  f.startsWith("components/admin/") ||
  f.startsWith("lib/admin/") ||
  f.startsWith("app/api/admin/");

/* 运维脚本和定时任务的文案只出现在日志和报警邮件里，不是任何站的界面。 */
const isOps = (f: string) => f.startsWith("app/api/cron/") || f.startsWith("lib/notify");

/*
 * 没有任何地方引用的组件。
 *
 * 三退声明和退党证明的表单在 santui.tuidang.org 和 service.tuidang.org 上，
 * 本站的 /services/declare 和 /services/verify 走的是 FormTemplate（内容来自
 * CMS）。这两个组件是改版时留下的，VideoLibraryIndex 同理。
 *
 * 它们不翻 —— 翻一个永远不会渲染的组件，是把工期花在零收益上。单列出来而不是
 * 直接忽略，是因为「这里有死代码」本身是该被看见的事；清理它是另一件事。
 */
const DEAD = [
  "components/public/DeclareForm.tsx",
  "components/public/VerifyForm.tsx",
  "components/public/VideoLibraryIndex.tsx"
];
const isDead = (f: string) => DEAD.includes(f);

/*
 * 只在中文站渲染的后台面板。
 *
 * 不是「还没翻」，是**不该翻**。防火墙放行规则每个 Vercel 项目各一份，那里
 * 记的是中文站那个项目的三条 —— 其中「免翻 reverse proxy」是给墙内读者用的
 * 反代，别的站根本没有这条。登记册抓取的 cron 也只在中文站跑，面板属于去抓
 * 的那个站。把它们显示在英文站的后台，给的信息是错的，不只是没翻译。
 *
 * 判断依据写在各组件的文件头上。放进待翻译的数字里会让「英文站还差多少」
 * 一直差着一笔永远不会动的账。
 */
const ZH_ONLY = [
  "components/admin/FirewallNotesPanel.tsx",
  "components/admin/SantuiSyncPanel.tsx"
];
const isZhOnly = (f: string) => ZH_ONLY.includes(f);
/*
 * 模板单独一栏。
 *
 * components/templates/* 的内容全部来自 cms_content_entries，代码里的中文是
 * 那一行缺失时的兜底 —— 形状五花八门（asString 的第二个参数、三元 else 分支里
 * 整段默认数组），再精细的启发式也分不干净。
 *
 * 而英文站的编辑内容本来就按语言存在 CMS 里：开站时播种一套英文的 content
 * entries，这些兜底一句都不会出现在页面上。所以它们不是「待翻译的界面文案」，
 * 单列一栏比硬塞进任何一边都诚实。
 */
const CMS_BACKED = [
  "lib/section-nav.ts",   // 栏目标签：真正的来源是 nav/section-tabs.json，这里只是那一行缺失时的兜底
  "lib/site-data.ts"      // 导航与首页标题：同上，来源是 pages/home.json 与 navigation.json
];
const isTemplate = (f: string) => f.startsWith("components/templates/") || CMS_BACKED.includes(f);
const templateRows = all.filter((r) => isTemplate(r.file));
const opsRows = all.filter((r) => isOps(r.file));
const deadRows = all.filter((r) => isDead(r.file));
const zhOnlyRows = all.filter((r) => isZhOnly(r.file));
const publicRows = all.filter((r) => !isAdmin(r.file) && !isTemplate(r.file) && !isOps(r.file) && !isDead(r.file));
const adminRows = all.filter((r) => isAdmin(r.file) && !isZhOnly(r.file));
const sum = (rows: Row[]) => rows.reduce((n, r) => n + r.chars, 0);

console.log("\n========== 界面文案 ==========\n");
console.log(`  公开站界面   还有 ${sum(publicRows)} 个汉字写死在 ${publicRows.length} 个文件里  ← 要翻`);
console.log(`  后台界面     还有 ${sum(adminRows)} 个汉字写死在 ${adminRows.length} 个文件里  ← 要翻（中英两版）`);
console.log(`  CMS 兜底     ${sum(templateRows)} 个汉字在 ${templateRows.length} 个文件里  ← 不用翻，内容走 CMS`);
console.log(`  运维与报警   ${sum(opsRows)} 个汉字在 ${opsRows.length} 个文件里  ← 不用翻，只进日志和邮件`);
console.log(`  中文站专属   ${sum(zhOnlyRows)} 个汉字在 ${zhOnlyRows.length} 个文件里  ← 不用翻，只在中文站渲染`);
console.log(`  死代码       ${sum(deadRows)} 个汉字在 ${deadRows.length} 个文件里  ← 不用翻，没有任何地方引用`);

if (SHOW_FILES) {
  for (const [label, rows] of [["公开站界面", publicRows], ["后台界面", adminRows], ["CMS 兜底", templateRows]] as [string, Row[]][]) {
    console.log(`\n--- ${label} ---`);
    for (const r of rows.slice(0, TOP)) console.log(`  ${String(r.chars).padStart(5)}  ${r.file}`);
    if (rows.length > TOP) console.log(`  …另外 ${rows.length - TOP} 个文件`);
  }
}

/* 两张表的差集。 */
async function keyGap() {
  const zhSrc = readFileSync("apps/web/src/lib/i18n/zh.ts", "utf8");
  const enSrc = readFileSync("apps/web/src/lib/i18n/en.ts", "utf8");
  const keysOf = (src: string) => new Set([...src.matchAll(/^\s*"([^"]+)":/gm)].map((m) => m[1]));
  const zhKeys = keysOf(zhSrc);
  const enKeys = keysOf(enSrc);
  const missing = [...zhKeys].filter((k) => !enKeys.has(k));
  const extra = [...enKeys].filter((k) => !zhKeys.has(k));

  console.log(`\n  文案表     中文 ${zhKeys.size} 条，英文 ${enKeys.size} 条`);
  if (missing.length) {
    console.log(`  ✗ 英文表缺 ${missing.length} 条（这些会回退成中文显示）：`);
    for (const k of missing.slice(0, 15)) console.log(`      ${k}`);
    if (missing.length > 15) console.log(`      …另外 ${missing.length - 15} 条`);
  } else if (zhKeys.size > 0) {
    console.log("  ✓ 英文表没有缺项");
  }
  if (extra.length) {
    console.log(`  ⚠ 英文表多出 ${extra.length} 条中文表没有的 —— 多半是 key 拼错了：`);
    for (const k of extra.slice(0, 10)) console.log(`      ${k}`);
  }
  console.log("");
  return missing.length;
}

keyGap().then((missing) => {
  if (missing > 0) process.exit(1);
});
