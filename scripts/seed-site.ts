/**
 * 给一个新语言的站播下骨架：分类、板块名、几个共用占位。
 *
 *     npm run seed:site -- --locale en           # 预演，只说要做什么
 *     npm run seed:site -- --locale en --apply
 *
 * ## 为什么需要它
 *
 * 英文站的后台机械上是通的 —— 登录、权限、所有只读页、媒体库都正常，连新建
 * 分类都能成。但它**一条内容都没有**，于是：
 *
 *   - 新建文章那一页，主分类的下拉是空的，保存会被「分类不存在」拒掉
 *   - 整站回落到 @quitccp/content-schema 里那份中文原型内容
 *
 * 044 之前这是堵死的（旧的 unique(slug) 不让英文站用中文站已占的 slug），
 * 现在通了，缺的只是数据。
 *
 * ## 照搬中文站的结构，名字用英文
 *
 * 这是 2026-10-22 定的：英文站先和中文站同一套 slug、同一个排序，以后英文
 * 编辑团队再自己调。slug 保持一致还有个额外好处 —— 同一个栏目在两个站是同一个
 * slug，以后做语言切换时不用再维护一张对照表。
 *
 * 名字必须换成英文：照搬 slug 不等于照搬显示名，否则英文站会挂着一排中文栏目名。
 *
 * ## 这里不播正文
 *
 * cms_content_entries 里 pages/ 那 55 条是真正的正文（机构简介、退党大事记、
 * 数字与统计方法…），合计 40,247 个汉字。那是翻译工作，不是建站脚本该夹带的
 * 东西 —— 谁来写英文正文是内容组的决定。这个脚本只负责让站先立起来，正文由
 * 英文编辑在后台填。
 *
 * ## 两条规矩
 *
 * 1. **默认预演。** 和这个仓库里其他动库的脚本一样，--apply 才真跑。
 * 2. **永远不碰 zh。** --locale zh 直接拒绝执行。中文站是生产，编辑每天在用，
 *    一个建站脚本没有任何理由往它身上写东西。
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/* ── 要播的东西 ───────────────────────────────────────────────────── */

interface Category {
  slug: string;
  name: string;
  sortOrder: number;
  description?: string;
  summary?: string;
  isNewsListing?: boolean;
}

/*
 * 文章分类。slug 和 sort_order 与中文站一致。
 *
 * 一处例外：中文站的 `end ccp` 中间有个空格。slug 是要进地址的，带空格会被
 * 编码成 %20 —— 那是中文站的一个旧毛病，不该顺手搬到新站上。英文站用 end-ccp。
 */
const ARTICLE_CATEGORIES: Category[] = [
  { slug: "announcement-claims", name: "Announcements & Statements", sortOrder: 1, isNewsListing: true },
  { slug: "red-regime-collapse", name: "Signs of Collapse", sortOrder: 2, isNewsListing: true },
  {
    slug: "withdrawal-news",
    name: "Tuidang News",
    sortOrder: 3,
    isNewsListing: true,
    description:
      "Daily reporting on the movement to quit the CCP: rallies and solidarity events, the running count, public statements and press coverage."
  },
  { slug: "worldwide-supports", name: "International Solidarity", sortOrder: 4, isNewsListing: true },
  { slug: "worldwide-investigation", name: "WOIPFG Investigation Reports", sortOrder: 5, isNewsListing: true },
  { slug: "topics-commentary", name: "Features & Commentary", sortOrder: 6, isNewsListing: true },
  { slug: "withdrawal-stories", name: "Withdrawal Stories", sortOrder: 7, isNewsListing: true },
  { slug: "famous-quitccp", name: "Notable Withdrawals", sortOrder: 8, isNewsListing: true },
  { slug: "ccp-influence", name: "CCP Infiltration", sortOrder: 9, isNewsListing: true },
  { slug: "countering-ccp", name: "Countering the CCP", sortOrder: 10, isNewsListing: true },
  { slug: "end-ccp", name: "End CCP", sortOrder: 100 },
  { slug: "culture", name: "Traditional Culture", sortOrder: 106 },
  { slug: "eliminate-ccpculture", name: "Breaking Party Culture", sortOrder: 107 },
  { slug: "stop-organhavesting", name: "Stop Forced Organ Harvesting", sortOrder: 109 },
  { slug: "unfiled", name: "Unfiled", sortOrder: 170 },
  { slug: "resource-downloads", name: "Resource Downloads", sortOrder: 180 },
  { slug: "culture-music", name: "Songs", sortOrder: 190 },
  { slug: "culture-poetry", name: "Poetry", sortOrder: 200 }
];

const FREE_TO_SHARE = "All programmes may be freely downloaded, reposted and re-edited.";

const VIDEO_CATEGORIES: Category[] = [
  { slug: "special-report", name: "Special Reports", sortOrder: 0, description: FREE_TO_SHARE },
  {
    slug: "frontline",
    name: "Tuidang Frontline",
    sortOrder: 1,
    description:
      "A current-affairs programme from the Global Service Center for Quitting the CCP, covering the Party's institutions, world events and the withdrawal movement."
  },
  {
    slug: "party-culture",
    name: "Breaking Party Culture",
    sortOrder: 2,
    description:
      "Using history, traditional culture and present-day life to take apart the habits of thought the Party instilled, and to see it for what it is."
  },
  { slug: "santui-wave", name: "The Tuidang Wave", sortOrder: 3, description: FREE_TO_SHARE },
  { slug: "400m_quit_ccp", name: "Awakening of 400 Million", sortOrder: 4, description: FREE_TO_SHARE },
  {
    slug: "voices-of-tuidang",
    name: "Voices of Tuidang",
    sortOrder: 5,
    description:
      "True stories of the seventy years since the CCP took power — the indoctrination, the persecution, and what quitting means to the people who did it."
  },
  { slug: "tuidang-wave", name: "Tide of Withdrawals", sortOrder: 6, description: FREE_TO_SHARE },
  {
    slug: "jiuping",
    name: "Nine Commentaries",
    sortOrder: 7,
    description:
      "Nine commentaries, nine films. The series also includes video and audio editions of How the Specter of Communism Is Ruling Our World and The Ultimate Goal of Communism. " +
      FREE_TO_SHARE
  },
  { slug: "ironclad", name: "Ironclad Evidence", sortOrder: 8, description: FREE_TO_SHARE },
  { slug: "stop-organhavesting", name: "Stop Forced Organ Harvesting", sortOrder: 9, description: FREE_TO_SHARE },
  { slug: "tiananmen-self-immolation", name: "The Self-Immolation Investigation", sortOrder: 10 },
  { slug: "echoes_hope", name: "Echoes of Hope", sortOrder: 11, description: FREE_TO_SHARE },
  { slug: "hope-road", name: "The Road of Hope", sortOrder: 12, description: FREE_TO_SHARE },
  {
    slug: "awakening",
    name: "Journey of Awakening",
    sortOrder: 13,
    description:
      "From doubt to clarity: ordinary people describe how they came to see the CCP for what it is, and decided to leave. " + FREE_TO_SHARE
  }
];

const MATERIAL_CATEGORIES: Category[] = [
  {
    slug: "boards",
    name: "Display Boards & Banners",
    sortOrder: 10,
    summary: "Large-format material for service points and rallies, with editable source files and print-resolution finals."
  },
  {
    slug: "leaflets",
    name: "Leaflets & Booklets",
    sortOrder: 20,
    summary: "A4, A5 and tri-fold, suited to handing out at service points and to posting."
  },
  {
    slug: "placards",
    name: "Placards & Stickers",
    sortOrder: 30,
    summary: "Kits for rallies, marches and signature drives, including blank templates."
  },
  {
    slug: "broadcast",
    name: "Broadcasts & Audio",
    sortOrder: 40,
    summary: "Audio programmes and scripts, for radio, online sharing and playing on site."
  },
  {
    slug: "kind-words",
    name: "Words of Kindness",
    sortOrder: 50,
    summary: "Short messages and couplets, suited to printing and handing out."
  }
];

/*
 * 问答分类的 slug 是中文拼音缩写（aqys = 安全与隐私）。照搬是定下的做法，但这
 * 几个 slug 会进地址（/services/faq#aqys），在英文站上没有意义。现在没有任何
 * 英文内容引用它们，所以以后要改是一行的事 —— 留一句话在这儿，免得将来没人
 * 记得这是个遗留，不是刻意的选择。
 */
const FAQ_CATEGORIES: Category[] = [
  { slug: "aqys", name: "Safety & Privacy", sortOrder: 0 },
  { slug: "cjwt", name: "Immigration FAQ", sortOrder: 1 },
  { slug: "st", name: "Quitting the CCP", sortOrder: 2 },
  { slug: "tdzs", name: "Withdrawal Certificate", sortOrder: 3 },
  { slug: "xgbd", name: "Related Coverage", sortOrder: 4 },
  { slug: "ymzc", name: "Immigration Policy", sortOrder: 5 }
];

/* 板块名与子菜单 —— 面包屑和各板块顶部那一排用的就是它。 */
const SECTION_TABS = {
  _note:
    "Edit this to change the sub-menu at the top of each section. In `tabs`, the left-hand key is a fixed slot name (do not change it); the right-hand value is what readers see. `order` sets the order — leave it out to keep the original. `label` is the section's own name, the one in the breadcrumb.",
  sections: {
    about: {
      tabs: {
        index: "About us",
        numbers: "Numbers & method",
        network: "Global network",
        team: "Board & team",
        history: "Milestones",
        contact: "Contact us"
      },
      label: "About us",
      order: ["index", "numbers", "network", "team", "history", "contact"]
    },
    involve: {
      tabs: {
        index: "Donate",
        endccp: "ENDCCP petition",
        stories: "Volunteer stories",
        volunteer: "Become a volunteer",
        "other-ways": "Other ways to help"
      },
      label: "Get involved"
    },
    services: {
      tabs: {
        declare: "Make a statement",
        cert: "Withdrawal certificate",
        verify: "Look up a record",
        contact: "Change your details",
        faq: "Questions & answers",
        privacy: "Safety & privacy",
        immigration: "Immigration policy",
        coverage: "Withdrawal & immigration coverage"
      },
      label: "Statements & certificates"
    },
    resources: {
      tabs: {
        index: "Books & writings",
        downloads: "Downloads",
        magazine: "The Return magazine",
        culture: "Chinese traditional culture",
        press: "Press & media",
        tools: "Uncensored access"
      },
      label: "Resources"
    }
  }
} as const;

/*
 * 共用占位：中文站这六条只有 meta，没有内容。建出来是为了两个站的结构对齐 ——
 * 后台「页面内容」那一页列的是这张表，少了它们，英文编辑会以为是坏了。
 */
const SHARED_PLACEHOLDERS = ["header.json", "footer.json", "site.json", "seo.json", "theme.json", "navigation.json"];

/* ── 跑起来 ───────────────────────────────────────────────────────── */

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
    /* 可选文件，没有就算了。 */
  }
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
}

async function main() {
  loadEnv(resolve(process.cwd(), ".env.local"));
  loadEnv(resolve(process.cwd(), ".env"));

  const locale = (arg("--locale") ?? "").trim().toLowerCase();
  const apply = process.argv.includes("--apply");

  if (!locale) throw new Error("要指定 --locale，例如 --locale en");
  if (locale === "zh") {
    throw new Error(
      "拒绝往 zh 写。中文站是生产，编辑每天在用 —— 一个建站脚本没有任何理由碰它。"
    );
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("需要 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const db = createClient(url, key, { auth: { persistSession: false } });

  console.log(`\n========== 给 ${locale} 站播骨架${apply ? "" : "（预演）"} ==========\n`);

  const plan: { what: string; table: string; rows: Record<string, unknown>[]; onConflict: string }[] = [
    {
      what: "文章分类",
      table: "cms_article_categories",
      onConflict: "slug,locale",
      rows: ARTICLE_CATEGORIES.map((c) => ({
        slug: c.slug,
        name: c.name,
        sort_order: c.sortOrder,
        description: c.description ?? null,
        is_news_listing: c.isNewsListing ?? false,
        locale
      }))
    },
    {
      what: "视频分类",
      table: "cms_video_categories",
      onConflict: "slug,locale",
      rows: VIDEO_CATEGORIES.map((c) => ({
        slug: c.slug,
        name: c.name,
        sort_order: c.sortOrder,
        description: c.description ?? null,
        locale
      }))
    },
    {
      what: "资料分类",
      table: "cms_material_categories",
      onConflict: "slug,locale",
      rows: MATERIAL_CATEGORIES.map((c) => ({
        slug: c.slug,
        name: c.name,
        sort_order: c.sortOrder,
        summary: c.summary ?? "",
        locale
      }))
    },
    {
      what: "问答分类",
      table: "cms_faq_categories",
      onConflict: "slug,locale",
      rows: FAQ_CATEGORIES.map((c) => ({
        slug: c.slug,
        name: c.name,
        sort_order: c.sortOrder,
        summary: c.summary ?? "",
        locale
      }))
    },
    {
      what: "板块名与子菜单",
      table: "cms_content_entries",
      onConflict: "locale,path",
      rows: [{ path: "nav/section-tabs.json", locale, data: SECTION_TABS }]
    },
    {
      what: "共用占位",
      table: "cms_content_entries",
      onConflict: "locale,path",
      rows: SHARED_PLACEHOLDERS.map((path) => ({
        path,
        locale,
        data: { meta: { path, scope: "shared" } }
      }))
    }
  ];

  for (const step of plan) {
    /* 先看现在有什么：预演要说得出「哪些是新建、哪些会被覆盖」。 */
    const keyCol = step.onConflict.startsWith("slug") ? "slug" : "path";
    const { data: existing, error: readError } = await db
      .from(step.table)
      .select(keyCol)
      .eq("locale", locale);
    if (readError) throw new Error(`${step.table} 读不到：${readError.message}`);

    const have = new Set((existing ?? []).map((r) => String((r as Record<string, unknown>)[keyCol])));
    const fresh = step.rows.filter((r) => !have.has(String(r[keyCol])));
    const over = step.rows.length - fresh.length;

    console.log(`  ${step.what}（${step.table}）：新建 ${fresh.length}，覆盖 ${over}`);
    for (const r of fresh.slice(0, 4)) console.log(`      + ${r[keyCol]}${r.name ? `  ${r.name}` : ""}`);
    if (fresh.length > 4) console.log(`      … 另外 ${fresh.length - 4} 条`);

    if (!apply) continue;
    const { error } = await db.from(step.table).upsert(step.rows, { onConflict: step.onConflict });
    if (error) throw new Error(`${step.table} 写失败：${error.message}`);
  }

  console.log(
    apply
      ? "\n✓ 播完了。正文（cms_content_entries 的 pages/ 那 55 条，四万多字）不在这里，由编辑在后台填。\n"
      : "\n（预演，一个字都没写。加 --apply 才真跑。）\n"
  );
}

main().catch((error) => {
  console.error(`\n✗ ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
