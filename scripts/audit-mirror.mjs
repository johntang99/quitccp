/**
 * 全站盘点：哪些媒体文件站上会用到，却不在 R2 镜像上。
 *
 *   node --env-file=.env.local scripts/audit-mirror.mjs
 *   node --env-file=.env.local scripts/audit-mirror.mjs --fix     # 顺手补齐
 *
 * ## 为什么按「地址」盘而不是按「文件」盘
 *
 * 媒体地址散在十几张表里：文章的 hero_image 和正文 markdown、视频的封面、
 * 页面 JSON 里任意一层、分类描述、常见问答的答案。渲染时统一被改写到镜像域，
 * 所以只要某个地址出现在站上、而镜像上没有那个对象，读者看到的就是坏图或黑屏。
 *
 * 反过来，Storage 里躺着但没人引用的文件不在镜像上，没有任何影响。所以这里
 * 盘的是「引用」，不是「文件」。图片视频库也算一份引用——编辑随时会从里面挑。
 *
 * 2026-10-18 第一次跑：根子是后台「出片」走的 GitHub Actions 没有 R2 凭据，
 * 片子进了 Storage 却没进镜像，设成首屏就是一片黑。
 */

const U = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "media";
const MIRROR = (process.env.NEXT_PUBLIC_MEDIA_MIRROR_HOST || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
if (!U || !K || !MIRROR) {
  console.error("缺 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_MEDIA_MIRROR_HOST");
  process.exit(1);
}
const H = { apikey: K, authorization: `Bearer ${K}` };
const PREFIX = `${U}/storage/v1/object/public/${BUCKET}/`;
const FIX = process.argv.includes("--fix");

/** 表 → 要翻的列。小表整行翻，文章表只取可能带地址的那几列。 */
const SOURCES = [
  ["cms_media_assets", "storage_path,name"],
  ["cms_articles", "slug,hero_image,body_markdown"],
  ["cms_videos", "slug,cover_image,body_markdown,description"],
  ["cms_materials", "slug,cover_image,body_markdown,files"],
  ["cms_pages", "slug,blocks,seo"],
  ["cms_content_entries", "path,data"],
  ["cms_faqs", "slug,answer_markdown"],
  ["cms_site_settings", "setting_key,value_json"],
  ["cms_article_categories", "slug,description"],
  ["cms_video_categories", "slug,description"],
  ["cms_material_categories", "slug,summary"],
  ["cms_faq_categories", "slug,summary"]
];

const PAGE = 500;

/** 整表翻页取回，只要指定的列。 */
async function* rows(table, select) {
  for (let from = 0; ; from += PAGE) {
    const res = await fetch(`${U}/rest/v1/${table}?select=${select}&order=id.asc&limit=${PAGE}&offset=${from}`, {
      headers: H
    });
    if (!res.ok) {
      console.error(`  ${table} 读不到：HTTP ${res.status}`);
      return;
    }
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) return;
    yield* batch;
    if (batch.length < PAGE) return;
  }
}

/** key → 第一次是在哪儿见到的，用来在报告里说清楚该去哪改。 */
const seen = new Map();

function harvest(table, row) {
  const text = JSON.stringify(row);
  /*
   * 地址到哪儿为止。
   *
   * 括号、方括号、引号、尖括号、空白、反斜杠都不算地址的一部分。方括号和
   * 左括号是 2026-10-18 补上的：正文里有 `[地址](地址)` 这种 markdown 写法
   * （链接文字本身就是那个地址），少了它们，正则会从 `](` 一路穿到第二个
   * 地址里去，拼出一个根本不存在的 key，于是报出几十个假的「缺失」。
   */
  const re = new RegExp(`${PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^"'()\\[\\]<>\\s\\\\]+`, "g");
  for (const hit of text.match(re) ?? []) {
    const key = decodeURIComponent(hit.slice(PREFIX.length).split("?")[0]);
    if (!key) continue;
    if (!seen.has(key)) seen.set(key, `${table}.${row.slug ?? row.path ?? row.setting_key ?? row.name ?? "?"}`);
  }
}

/** 并发跑，别一个一个来 —— 几千个 HEAD 串行要等很久。 */
async function pool(items, limit, worker) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (i < items.length) {
        const n = i++;
        out[n] = await worker(items[n]);
      }
    })
  );
  return out;
}

const enc = (key) => key.split("/").map(encodeURIComponent).join("/");

async function main() {
  console.log("扫描来源：");
  for (const [table, select] of SOURCES) {
    const before = seen.size;
    let n = 0;
    for await (const row of rows(table, select)) {
      harvest(table, row);
      n += 1;
    }
    console.log(`  ${table.padEnd(26)} ${String(n).padStart(6)} 行 → 新增 ${seen.size - before} 个地址`);
  }

  const keys = [...seen.keys()];
  console.log(`\n去重后共 ${keys.length} 个媒体地址，开始对镜像…\n`);

  const results = await pool(keys, 16, async (key) => {
    const res = await fetch(`https://${MIRROR}/${enc(key)}`, { method: "HEAD" });
    return res.ok ? null : { key, status: res.status, where: seen.get(key) };
  });

  const missing = results.filter(Boolean);
  console.log(`镜像上有 ${keys.length - missing.length}，缺 ${missing.length}\n`);
  if (missing.length === 0) {
    console.log("全站没有缺口。");
    return;
  }

  /* 缺的东西里，有一部分源站本来也没有 —— 那是早就删掉的文件留下的死链，
     补镜像补不出来，得去内容里改。两类分开报，否则看报告的人会以为
     「补一下就好了」。 */
  const checked = await pool(missing, 16, async (m) => {
    const res = await fetch(`${PREFIX}${enc(m.key)}`, { method: "HEAD" });
    return { ...m, atOrigin: res.ok };
  });

  const fixable = checked.filter((m) => m.atOrigin);
  const dead = checked.filter((m) => !m.atOrigin);

  if (fixable.length) {
    console.log(`=== 源站有、镜像没有：${fixable.length} 个（补得回来）===`);
    for (const m of fixable) console.log(`  ${m.key}\n      引用自 ${m.where}`);
  }
  if (dead.length) {
    console.log(`\n=== 源站也没有：${dead.length} 个（死链，补镜像没用，得改内容）===`);
    for (const m of dead.slice(0, 40)) console.log(`  ${m.key}\n      引用自 ${m.where}`);
    if (dead.length > 40) console.log(`  …还有 ${dead.length - 40} 个`);
  }

  if (FIX && fixable.length) {
    console.log(`\n=== 补镜像 ===`);
    const { spawnSync } = await import("node:child_process");
    const r = spawnSync(process.execPath, [new URL("mirror-one.mjs", import.meta.url).pathname, ...fixable.map((m) => m.key)], {
      stdio: "inherit"
    });
    process.exit(r.status ?? 0);
  }
  if (fixable.length) console.log(`\n补齐：node --env-file=.env.local scripts/audit-mirror.mjs --fix`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
