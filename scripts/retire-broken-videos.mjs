/**
 * Clears out the films whose video is gone.
 *
 * Built from diagnose-broken-videos.mjs, which asks YouTube why each one fails.
 * Three outcomes, because the three causes call for different answers:
 *
 *   私有   49  The film still exists; the channel owner made it private. Nothing
 *              to decide yet, so it is only unpublished -- the row, its text and
 *              its address are untouched and it comes back with one update.
 *   没了   107  Deleted by YouTube or by the uploader. 78 of them already exist
 *              word for word as articles, so the video row is redundant and goes;
 *              the other 29 carry text nothing else holds, and become articles.
 *   空壳    3  No video and barely any text. Nothing to keep.
 *
 * Every deleted row is written to the backup in full, so --restore puts back
 * the video, its categories and any article this created.
 *
 * Pass a category slug to work on one series, or nothing for the whole library.
 *
 *   node --env-file=.env.local scripts/retire-broken-videos.mjs others
 *   node --env-file=.env.local scripts/retire-broken-videos.mjs --apply
 *   node --env-file=.env.local scripts/retire-broken-videos.mjs --restore backups/retire-<stamp>.json
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const APPLY = process.argv.includes("--apply");
const RESTORE = (() => {
  const i = process.argv.indexOf("--restore");
  return i === -1 ? null : process.argv[i + 1];
})();

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

if (RESTORE) {
  const b = JSON.parse(fs.readFileSync(RESTORE, "utf8"));
  for (const slug of b.unpublished ?? []) {
    const { error } = await s.from("cms_videos").update({ status: "published" }).eq("slug", slug);
    if (error) throw error;
  }
  for (const a of b.createdArticles ?? []) {
    await s.from("cms_articles").delete().eq("slug", a.slug);
  }
  for (const v of b.deletedVideos ?? []) {
    const { row, categoryIds } = v;
    const { error } = await s.from("cms_videos").insert(row);
    if (error) throw error;
    for (const cid of categoryIds) {
      await s.from("cms_video_category_map").insert({ video_id: row.id, category_id: cid, position: 0 });
    }
  }
  console.log(
    `  已还原：重新发布 ${(b.unpublished ?? []).length} 支，删除新建文章 ${(b.createdArticles ?? []).length} 篇，恢复影片 ${(b.deletedVideos ?? []).length} 支`
  );
  process.exit(0);
}

const CATEGORY = process.argv.find((a) => !a.startsWith("--") && !a.endsWith(".mjs") && !a.includes("/")) ?? "";
const CSV = CATEGORY
  ? `docs/implementation/video-broken-${CATEGORY}.csv`
  : "docs/implementation/video-broken.csv";
if (!fs.existsSync(CSV)) {
  console.log(`  先跑 diagnose-broken-videos.mjs ${CATEGORY}`);
  process.exit(1);
}

/** Minimal CSV reader -- the fields contain commas and quoted quotes. */
function readCsv(text) {
  const out = [];
  const lines = text.split("\n").filter(Boolean);
  const head = lines.shift().split(",");
  for (const line of lines) {
    const cells = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') { cur += '"'; i += 1; } else q = !q;
      } else if (ch === "," && !q) { cells.push(cur); cur = ""; }
      else cur += ch;
    }
    cells.push(cur);
    out.push(Object.fromEntries(head.map((h, i) => [h, cells[i] ?? ""])));
  }
  return out;
}

const reason = new Map(readCsv(fs.readFileSync(CSV, "utf8")).map((r) => [r.slug, r.原因]));

/* The films in scope, with everything needed to restore them. */
let videos = [];
if (CATEGORY) {
  const { data: cat } = await s.from("cms_video_categories").select("id").eq("slug", CATEGORY).maybeSingle();
  const { data: catMap } = await s.from("cms_video_category_map").select("video_id").eq("category_id", cat.id);
  const ids = (catMap ?? []).map((r) => String(r.video_id));
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await s.from("cms_videos").select("*").in("id", ids.slice(i, i + 150));
    if (error) throw error;
    videos = videos.concat(data ?? []);
  }
} else {
  for (let page = 0; ; page += 1) {
    const { data, error } = await s.from("cms_videos").select("*").range(page * 500, page * 500 + 499);
    if (error) throw error;
    videos = videos.concat(data ?? []);
    if (!data || data.length < 500) break;
  }
}
videos = videos.filter((v) => reason.has(v.slug));

const bodyLen = (v) => String(v.body_markdown ?? "").trim().length;
const privates = videos.filter((v) => reason.get(v.slug) === "已设为私有");
/*
 * 「非 YouTube」 is the 19 films still served from tuidang.org/wp-content. They
 * play today and stop playing when the domain becomes this site on Friday, so
 * they belong with the gone rather than with the working.
 */
const gone = videos.filter((v) => /不存在|社群规范|没有地址|非 YouTube/.test(reason.get(v.slug) ?? ""));
const toArticle = gone.filter((v) => bodyLen(v) >= 200);
const shells = gone.filter((v) => bodyLen(v) < 200);

/* Which of those already exist as an article, word for word. */
const norm = (t) =>
  String(t ?? "")
    .replace(/[（(【[]\s*(视频|視頻|图文|圖文|音频|音訊)\s*[)）】\]]/g, "")
    .replace(/[\s·、，,。.：:；;！!？?「」“”"‘’()（）【】[\]—\-~]/g, "")
    .toLowerCase();

/*
 * Every article, by normalised title and by slug.
 *
 * Paged inside each year: PostgREST returns at most 1000 rows per request, and
 * a plain per-year query silently returned only the first 1000 of the busy
 * years. That made real duplicates look new, and the insert then collided with
 * the slug that was already there.
 */
const articleByTitle = new Map();
const articleSlugs = new Set();
async function indexArticles(filter) {
  for (let page = 0; ; page += 1) {
    const q = filter(s.from("cms_articles").select("id, title, slug")).range(page * 1000, page * 1000 + 999);
    const { data, error } = await q;
    if (error) throw error;
    for (const a of data ?? []) {
      articleByTitle.set(norm(a.title), a);
      articleSlugs.add(a.slug);
    }
    if (!data || data.length < 1000) break;
  }
}
for (let y = 2002; y <= 2027; y += 1) {
  await indexArticles((q) => q.gte("published_at", `${y}-01-01`).lt("published_at", `${y + 1}-01-01`));
}
await indexArticles((q) => q.is("published_at", null));
console.log(`  文章库索引：${articleByTitle.size} 个标题 / ${articleSlugs.size} 个 slug`);

const dupes = [];
const fresh = [];
for (const v of toArticle) (articleByTitle.has(norm(v.title)) ? dupes : fresh).push(v);

/* Where a new article lands. 待归类 is the honest default for a machine
   conversion -- the admin's bulk category tool is how an editor sorts them. */
const { data: artCats } = await s.from("cms_article_categories").select("id, slug, name");
const artBySlug = new Map(artCats.map((c) => [c.slug, c]));
const ARTICLE_RULES = [
  { to: "withdrawal-news", test: /三退|退党|退团|退队|解体中共|退党潮/ },
  { to: "red-regime-collapse", test: /周永康|薄熙来|江泽民|曾庆红|令计划|徐才厚|贪腐|腐败|政变|内斗|中南海|高层|落马|判刑/ },
  { to: "topics-commentary", test: /评论|解读|分析|真相|历史|纪念|揭秘|点击|快评/ }
];
const DEFAULT_CAT = "unfiled";

function articleCategory(v) {
  const hay = `${v.title} ${v.description ?? ""}`;
  const hit = ARTICLE_RULES.find((r) => r.test.test(hay));
  return artBySlug.get(hit?.to ?? DEFAULT_CAT) ?? artBySlug.get(DEFAULT_CAT);
}

function articleSlug(v) {
  const base = String(v.slug ?? v.title).trim();
  if (!articleSlugs.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`;
    if (!articleSlugs.has(candidate)) return candidate;
  }
}

console.log(`\n=== ${CATEGORY || "全库"}里播不了的 ${videos.length} 支 ===`);
console.log(`  A 私有 → 下架（改草稿）         ${privates.length}`);
console.log(`  B 已没了 → 已有同名文章，删影片  ${dupes.length}`);
console.log(`  B 已没了 → 转成文章              ${fresh.length}`);
console.log(`  C 空壳 → 删除                    ${shells.length}`);

if (fresh.length) {
  const byCat = {};
  for (const v of fresh) (byCat[articleCategory(v).name] ??= []).push(v);
  console.log("\n=== 新建的 " + fresh.length + " 篇文章去向 ===");
  for (const [name, list] of Object.entries(byCat).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n■ ${name} ← ${list.length} 篇`);
    for (const v of list.slice(0, 5)) console.log(`     ${(v.published_at ?? "").slice(0, 10)}  ${v.title.slice(0, 40)}`);
    if (list.length > 5) console.log(`     …另有 ${list.length - 5} 篇`);
  }
}
if (shells.length) {
  console.log("\n=== 要删的空壳 ===");
  for (const v of shells) console.log(`     ${(v.published_at ?? "").slice(0, 10)}  ${v.title.slice(0, 40)}  （正文 ${bodyLen(v)} 字）`);
}

if (!APPLY) {
  console.log("\n  空跑 —— 没有写入。确认后加 --apply。");
  process.exit(0);
}

const backup = { at: new Date().toISOString(), unpublished: [], createdArticles: [], deletedVideos: [] };

/*
 * The file is written before the first write and rewritten after each stage.
 * The first attempt wrote it only at the end, hit a NOT NULL on the way through
 * and left 49 rows changed with nothing to undo them from.
 */
fs.mkdirSync("backups", { recursive: true });
const stamp = backup.at.replace(/[:.]/g, "-");
const file = path.join("backups", `retire-${stamp}.json`);
const save = () => fs.writeFileSync(file, JSON.stringify(backup, null, 2));

// Everything that is about to be deleted, captured in full up front.
for (const v of [...dupes, ...fresh, ...shells]) {
  const { data: maps } = await s.from("cms_video_category_map").select("category_id").eq("video_id", v.id);
  backup.deletedVideos.push({ row: v, categoryIds: (maps ?? []).map((m) => String(m.category_id)) });
}
backup.unpublished = privates.map((v) => v.slug);
save();
console.log(`\n  备份已先写入 ${file}（${backup.deletedVideos.length} 支待删影片的完整内容）`);

/* A -- unpublish only. */
for (const v of privates) {
  const { error } = await s.from("cms_videos").update({ status: "draft" }).eq("id", v.id);
  if (error) throw error;
}
console.log(`\n  已下架 ${backup.unpublished.length} 支私有影片`);

/* B fresh -- create the article first, so a failure never loses the text. */
for (const v of fresh) {
  const category = articleCategory(v);
  const slug = articleSlug(v);
  const body = String(v.body_markdown ?? "");
  const { data: created, error } = await s
    .from("cms_articles")
    .insert({
      slug,
      title: v.title,
      section: "news",
      locale: "zh",
      status: "published",
      summary: String(v.description ?? "").slice(0, 240),
      body_markdown: body,
      body_plain: body.replace(/[#*`>\-\[\]()!]/g, " ").replace(/\s+/g, " ").trim(),
      hero_image: v.cover_image || "",
      hero_image_alt: v.cover_image_alt || "",
      published_at: v.published_at,
      legacy_url: v.legacy_url || "",
      legacy_id: v.legacy_id ?? null
    })
    .select("id, slug")
    .single();
  if (error) throw error;
  if (category) {
    await s.from("cms_article_category_map").insert({ article_id: created.id, category_id: category.id, position: 0 });
  }
  backup.createdArticles.push({ slug: created.slug });
  save();
}
console.log(`  已新建 ${backup.createdArticles.length} 篇文章`);

/* B dupes + C shells -- delete the video rows, keeping a full copy. */
for (const v of [...dupes, ...fresh, ...shells]) {
  await s.from("cms_video_category_map").delete().eq("video_id", v.id);
  const { error } = await s.from("cms_videos").delete().eq("id", v.id);
  if (error) throw error;
}
console.log(`  已删除 ${backup.deletedVideos.length} 支影片`);
save();

save();
console.log(`\n  备份：${file}`);
console.log(`  撤销：node --env-file=.env.local scripts/retire-broken-videos.mjs --restore ${file}`);
