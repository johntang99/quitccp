/**
 * 给一个新语言的站播页面正文。先做首页。
 *
 *     npm run seed:pages -- --locale en            # 预演
 *     npm run seed:pages -- --locale en --apply
 *
 * ## 为什么不是手写一份 JSON
 *
 * pages/home.json 是 15KB、十四个区块、一百多个文案字段。手写一份英文的，结构
 * 对不对要靠眼睛看 —— 少一个键，那一块在页面上就是空的或者直接报错，而且只有
 * 打开首页才会发现。
 *
 * 所以这里的做法是：**拿中文站那份做模子**，深拷一份，按「路径 → 英文」逐个
 * 覆盖文案，再把该关的区块关掉。结构由模子保证，这个脚本只负责换字。
 *
 * 最后有一道硬检查：译完之后整份 JSON 里不该再有汉字。还有剩的就拒绝写入，并
 * 把路径列出来。没有这道检查，漏译的字段会安安静静留在英文站上 —— 这正是这个
 * 项目反复踩过的那种坑：检查只看形状，不看事实。
 *
 * ## 哪些区块先关掉，为什么
 *
 *   news / video / channels
 *       列的是具体的中文文章和视频。把标题译成英文，链接还是指向中文内容 ——
 *       英文读者点进去是一篇中文文章。英文站现在一条内容都没有，空着比假装有
 *       内容要好。等英文编辑发了稿，在后台把开关打开就行。
 *
 *   voices
 *       高智晟、关贵敏、黄晓敏这些人的退党声明**原话**。把真实人物说过的话
 *       转述成英文挂在他们名下，是替他们说话 —— 这不是一个播种脚本该做的事。
 *       要上这一块，得由编辑提供有出处的英文译文。
 *
 *   hero
 *       中文站现在挂的是某一周的新闻（「今年前三季逾千万人三退」），还链着一篇
 *       中文文章。英文站换成一段讲机构自己在做什么的开场白 —— 那是事实陈述，
 *       不会过期，也不依赖任何还不存在的内容。
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/* ── 英文文案 ─────────────────────────────────────────────────────── */

/**
 * 路径 → 英文。路径就是 JSON 里的位置，`a.b[0].c` 这种写法。
 *
 * 值为 null 表示「把这个字段清空」（用于那些只在中文站有意义的东西）。
 */
const EN: Record<string, string | null> = {
  title: "Home",
  subtitle: "Founded 2005 · Headquartered in New York · 100+ service points worldwide",

  /* 开场。不挂具体新闻，讲机构在做什么。 */
  "hero.eyebrow": "Founded 2005 · 100+ service points worldwide",
  "hero.title": "Everyone who wants out should be able to put it on record.",
  "hero.body":
    "The Global Service Center for Quitting the Chinese Communist Party records public statements withdrawing from the Party, the Youth League and the Young Pioneers, and issues certificates of withdrawal. We also document human-rights abuses and support volunteers at more than a hundred service points. In twenty years we have recorded over 460 million statements.",
  "hero.actions[0].label": "Make a statement",
  "hero.actions[1].label": "What we do",

  /* 关于我们 */
  "about.eyebrow": "About us · Support us",
  "about.heading": "Every dollar and every number\ncan be checked.",
  "about.lede":
    "The Global Service Center for Quitting the Chinese Communist Party was founded in 2005. It is a non-profit registered in the United States, with its head office in New York. Our financial statements, governance and counting method are all public.",
  "about.moreLabel": "Download our profile (PDF) →",
  "about.cells[0].heading": "Why we need your support",
  "about.cells[0].value": "Under attack",
  "about.cells[0].body":
    "The people who object to this work are hitting this site with tens of thousands of requests a second. Protection, bandwidth and servers all cost money. If you think the work should continue, please support it.",
  "about.cells[1].heading": "Registration and legal status",
  "about.cells[1].body":
    "A non-profit registered in the United States; donations are tax-deductible. Our annual Form 990 is on the public record.",
  "about.cells[2].heading": "Counting and safety",
  "about.cells[2].value": "Method published",
  "about.cells[2].body":
    "How statements are counted, how duplicates are removed and how often the figure updates are all set out in full. Threats directed at this organisation are kept in a separate public file.",

  /* 参与我们 */
  "involve.eyebrow": "Get involved",
  "involve.heading": "Four ways to take part",
  "involve.lede": "Any one of them helps reach more people.",
  "involve.items[0].title": "Make a statement",
  "involve.items[0].body":
    "Submit under your own name or anonymously. It takes a few minutes, and you can request a certificate afterwards.",
  "involve.items[0].ctaLabel": "Start now",
  "involve.items[0].glyph": "1",
  "involve.items[1].title": "Become a volunteer",
  "involve.items[1].body":
    "Help at a service point in your city, or work online on translation and archiving.",
  "involve.items[1].ctaLabel": "Sign up",
  "involve.items[1].glyph": "2",
  "involve.items[2].title": "Sign the petition",
  "involve.items[2].body": "Add your name to the End CCP petition and tell your government where you stand.",
  "involve.items[2].ctaLabel": "Sign the petition",
  "involve.items[2].glyph": "3",
  "involve.items[3].title": "Download materials",
  "involve.items[3].body":
    "Display boards, leaflets, placards and audio-visual material, free to use.",
  "involve.items[3].ctaLabel": "Go to downloads",
  "involve.items[3].glyph": "4",

  /* 全球网络 */
  "network.eyebrow": "Global network",
  "network.heading": "More than a hundred service points worldwide, kept running by volunteers",
  "network.body":
    "Service points sit near tourist sites, community centres and transport hubs. Volunteers help people register on the spot, answer questions about certificates and immigration, and pass on statements made on paper.",
  "network.buttonLabel": "Find your nearest service point",
  "network.citiesLabel": "Some of our service points",
  "network.cities[0]": "New York",
  "network.cities[1]": "Los Angeles",
  "network.cities[2]": "San Francisco",
  "network.cities[3]": "Toronto",
  "network.cities[4]": "Vancouver",
  "network.cities[5]": "Washington DC",
  "network.cities[6]": "London",
  "network.cities[7]": "Berlin",
  "network.cities[8]": "Paris",
  "network.cities[9]": "Taipei",
  "network.cities[10]": "Tokyo",
  "network.cities[11]": "Seoul",
  "network.cities[12]": "Hong Kong",
  "network.cities[13]": "Bangkok",
  "network.cities[14]": "Jeju",
  "network.cities[15]": "Sydney",
  "network.cities[16]": "Melbourne",
  "network.cities[17]": "Auckland",

  /* 实时登记册 */
  "registry.eyebrow": "Live register",
  "registry.liveLabel": "Live register · those who stepped away",
  "registry.countLabel": "people have publicly declared their withdrawal from the Party, the League and the Pioneers",
  "registry.noteLabel": "How this figure is counted →",
  "registry.count": "466 million",
  "registry.substats[0].label": "Online submission",
  "registry.substats[1].label": "Covered by the audit trail",
  "registry.substats[2].label": "Archive searchable",
  /* 这张配图是中文出版物的封面，换语言的站该自己挑图。 */
  "registry.asideImageAlt": null,

  /* 服务 */
  "services.eyebrow": "Statements & certificates",
  "services.heading": "Statements, documentation, media and the tools to reach people",
  "services.moreLabel": "See all services",
  "services.cards[0].tag": "Register",
  "services.cards[0].title": "Statements & certificates",
  "services.cards[0].body":
    "Statements may be made under your own name or anonymously. You can also request a certificate of withdrawal in Chinese and English, which a third party can verify online.",
  "services.cards[0].ctaLabel": "Make a statement →",
  "services.cards[0].links[0].label": "Withdraw from the Party, League or Pioneers",
  "services.cards[0].links[1].label": "Request a certificate",
  "services.cards[0].links[2].label": "Look up and verify a certificate",
  "services.cards[0].links[3].label": "Certificates and immigration applications",
  "services.cards[0].links[4].label": "Safe access and censorship-circumvention tools",
  "services.cards[1].tag": "Document",
  "services.cards[1].title": "Investigation, archive and testimony",
  "services.cards[1].body":
    "We collect and verify cases of human-rights abuse, preserve first-hand accounts from those involved, and submit them to parliaments, institutions and the press.",
  "services.cards[1].ctaLabel": "Go to the newsroom →",
  "services.cards[1].links[0].label": "Case files",
  "services.cards[1].links[1].label": "Investigation reports",
  "services.cards[1].links[2].label": "First-hand accounts",
  "services.cards[1].links[3].label": "Parliamentary and institutional attention",
  "services.cards[1].links[4].label": "CCP infiltration",
  "services.cards[1].links[5].label": "Countering the CCP",
  "services.cards[2].tag": "Petition",
  "services.cards[2].title": "End CCP",
  "services.cards[2].body":
    "A public petition open to people everywhere, telling governments and international bodies where they stand on the CCP's abuses. {{endccp}} people have signed.",
  "services.cards[2].ctaLabel": "Sign the petition →",
  "services.cards[2].links[0].label": "Nine Commentaries on the Communist Party",
  "services.cards[2].links[1].label": "Full text of the petition",
  "services.cards[2].links[2].label": "Collect signatures in person",
  "services.cards[2].links[3].label": "Petition materials to download",
  "services.cards[2].links[4].label": "Announcements and statements",

  /* 资源馆（中文站这一块现在是关着的，英文站也保持关着，但文案照译） */
  "resources.eyebrow": "Resources",
  "resources.heading": "Tools, guides and public documents",
  "resources.moreLabel": "Browse all resources",
  "resources.items[0].label": "Safe access tools",
  "resources.items[1].label": "How to submit a statement",
  "resources.items[2].label": "How to verify a certificate",
  "resources.items[3].label": "Public reports",
  "resources.items[4].label": "Working with the press",
  "resources.items[5].label": "Terms of use",

  /* 下面这几块整块关掉，文案还是要译 —— 编辑在后台打开时该看到英文标题。 */
  "news.eyebrow": "News & reports",
  "news.heading": "Latest coverage",
  "news.listTitle": "Just published",
  "news.moreLabel": "Go to the newsroom",
  "news.listMoreLabel": "Browse everything",
  "video.eyebrow": "Video",
  "video.heading": "Films and programmes",
  "video.moreLabel": "Go to the video library",
  "video.latestLabel": "Newly added",
  "voices.eyebrow": "In their own words",
  "voices.heading": "Why they chose to say it publicly",
  "voices.moreLabel": "More testimony →",
  "channels.heading": "Series"
};

/**
 * 整块关掉的区块：enabled 设为 false，并且把列表清空。
 *
 * 只关开关不清列表是不够的 —— 中文的标题、人名、引语还留在数据里，编辑哪天
 * 打开开关，中文就回来了，而且没人会想到去看。
 */
const DISABLED_SECTIONS: Record<string, string[]> = {
  news: ["items"],
  video: ["items", "series"],
  voices: ["items"],
  channels: ["cards"]
};

/** 这些子对象整个清掉：它们是「某一篇具体的中文内容」。 */
const DROP_PATHS = ["news.lead", "video.featured", "registry.asideImage", "hero.video", "hero.gallery", "hero.image"];

/* ── 机械部分 ─────────────────────────────────────────────────────── */

const HAN = /[一-鿿]/;

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

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
}

/** 把 `a.b[0].c` 拆成 ["a","b",0,"c"]。 */
function parsePath(path: string): (string | number)[] {
  const parts: (string | number)[] = [];
  for (const chunk of path.split(".")) {
    const m = chunk.match(/^([^[]+)((\[\d+\])*)$/);
    if (!m) { parts.push(chunk); continue; }
    parts.push(m[1]);
    for (const idx of m[2].matchAll(/\[(\d+)\]/g)) parts.push(Number(idx[1]));
  }
  return parts;
}

function setAt(root: unknown, path: string, value: unknown): boolean {
  const parts = parsePath(path);
  let node: any = root;
  for (const part of parts.slice(0, -1)) {
    if (node == null) return false;
    node = node[part];
  }
  const last = parts[parts.length - 1];
  if (node == null || !(last in node)) return false;
  node[last] = value;
  return true;
}

function deleteAt(root: unknown, path: string): boolean {
  const parts = parsePath(path);
  let node: any = root;
  for (const part of parts.slice(0, -1)) {
    if (node == null) return false;
    node = node[part];
  }
  const last = parts[parts.length - 1];
  if (node == null || !(last in node)) return false;
  delete node[last];
  return true;
}

/** 走一遍，把还带汉字的字段连同路径收集出来。 */
function remainingChinese(node: unknown, path: string, out: [string, string][]) {
  if (typeof node === "string") {
    if (HAN.test(node)) out.push([path, node]);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((v, i) => remainingChinese(v, `${path}[${i}]`, out));
    return;
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) remainingChinese(v, path ? `${path}.${k}` : k, out);
  }
}

async function main() {
  loadEnv(resolve(process.cwd(), ".env.local"));
  loadEnv(resolve(process.cwd(), ".env"));

  const locale = (arg("--locale") ?? "").trim().toLowerCase();
  const apply = process.argv.includes("--apply");
  if (!locale) throw new Error("要指定 --locale，例如 --locale en");
  if (locale === "zh") throw new Error("拒绝往 zh 写。中文站是生产，编辑每天在用。");
  if (locale !== "en") throw new Error(`目前只有 en 的文案，--locale ${locale} 还没有可播的内容`);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("需要 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const db = createClient(url, key, { auth: { persistSession: false } });

  console.log(`\n========== 给 ${locale} 站播页面正文${apply ? "" : "（预演）"} ==========\n`);

  /* 模子：中文站那一份。只读，不动它。 */
  const { data: source, error: readError } = await db
    .from("cms_content_entries")
    .select("data")
    .eq("locale", "zh")
    .eq("path", "pages/home.json")
    .maybeSingle();
  if (readError) throw new Error(`读不到中文站的 pages/home.json：${readError.message}`);
  if (!source) throw new Error("中文站没有 pages/home.json，没有模子可用");

  const page = JSON.parse(JSON.stringify(source.data));

  /* 1) 整块丢掉的 */
  for (const path of DROP_PATHS) {
    if (deleteAt(page, path)) console.log(`  － 丢掉 ${path}`);
  }

  /* 2) 关掉并清空的 */
  for (const [section, lists] of Object.entries(DISABLED_SECTIONS)) {
    if (!page[section]) continue;
    page[section].enabled = false;
    for (const list of lists) if (Array.isArray(page[section][list])) page[section][list] = [];
    console.log(`  ○ 关掉 ${section}（并清空 ${lists.join("、")}）`);
  }

  /* 3) 逐条换成英文 */
  let replaced = 0;
  const missed: string[] = [];
  for (const [path, value] of Object.entries(EN)) {
    if (setAt(page, path, value === null ? "" : value)) replaced += 1;
    else missed.push(path);
  }
  console.log(`\n  换了 ${replaced} 处文案`);
  if (missed.length) {
    console.log(`  ！ 有 ${missed.length} 条写了英文、但模子里找不到对应位置（中文站可能改过结构）：`);
    for (const p of missed) console.log(`      ${p}`);
  }

  /* 4) 硬检查：不该再有汉字 */
  const left: [string, string][] = [];
  remainingChinese(page, "", left);
  if (left.length) {
    console.log(`\n  ✗ 还有 ${left.length} 个字段是中文，不能就这样写上去：\n`);
    for (const [p, v] of left) console.log(`      ${p}\n         ${v.slice(0, 80)}`);
    throw new Error("有漏译的字段。补进 EN 表，或者把那一块关掉。");
  }
  console.log("  ✓ 整份 JSON 里没有汉字了");

  if (!apply) {
    console.log("\n（预演，一个字都没写。加 --apply 才真跑。）\n");
    return;
  }

  page.meta = { ...(page.meta ?? {}), path: "pages/home.json" };
  const { error } = await db
    .from("cms_content_entries")
    .upsert({ path: "pages/home.json", locale, data: page }, { onConflict: "locale,path" });
  if (error) throw new Error(`写失败：${error.message}`);
  console.log(`\n✓ 播好了 ${locale} 的 pages/home.json\n`);
}

main().catch((error) => {
  console.error(`\n✗ ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
