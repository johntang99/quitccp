/**
 * Adds 中华传统文化 to the film library and files the performances into it.
 *
 * The traditional-culture pieces -- 二胡演奏, 中国古典舞, 歌曲, 诗朗诵,
 * 【传统故事精选】 -- had nowhere to go: every existing series is about the
 * Party or about 三退, and a guqin performance in 破除党文化 is simply wrong.
 * The name matches what the site already calls this elsewhere
 * (/resources/culture and the news category 传统文化文章).
 *
 * Also fixes one film the earlier pass could not see: 追查国际's
 * 《相信这无法相信的事》 is hosted on 干净世界, and that pass only moved films
 * whose YouTube id had been checked, so every 干净世界 film was skipped.
 *
 *   node --env-file=.env.local scripts/add-culture-video-category.mjs
 *   node --env-file=.env.local scripts/add-culture-video-category.mjs --apply
 *   node --env-file=.env.local scripts/add-culture-video-category.mjs --restore backups/culture-cat-<stamp>.json
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

const CATEGORY = { slug: "culture", name: "中华传统文化", sort_order: 75 };

if (RESTORE) {
  const b = JSON.parse(fs.readFileSync(RESTORE, "utf8"));
  for (const m of b.moves) {
    const { error } = await s
      .from("cms_video_category_map")
      .update({ category_id: m.fromCategoryId })
      .eq("video_id", m.videoId)
      .eq("category_id", m.toCategoryId);
    if (error) throw error;
  }
  if (b.createdCategoryId) await s.from("cms_video_categories").delete().eq("id", b.createdCategoryId);
  console.log(`  已还原 ${b.moves.length} 支影片${b.createdCategoryId ? "，并删除新建的分类" : ""}`);
  process.exit(0);
}

/*
 * Matched on what the film is, not on where it currently sits. Performances and
 * the traditional-story readings are unmistakable; 积善之家 and 发毒誓 quote the
 * 易经 and 敬天信神 in their own first lines.
 */
const CULTURE = /二胡演奏|古典舞|^歌曲[：:]|诗朗诵|詩朗誦|【传统故事精选】|传统故事|积善之家|发毒誓|敬天信神|中华五千年文化|传统文化讲/;
/** Missed earlier only because 干净世界 films were never checked. */
const IRONCLAD = /活摘|摘取器官|器官移植|追查国际|相信这无法相信的事/;

const { data: cats } = await s.from("cms_video_categories").select("id, slug, name");
const bySlug = new Map(cats.map((c) => [c.slug, c]));
const others = bySlug.get("others");
const ironclad = bySlug.get("ironclad");
if (!others || !ironclad) throw new Error("缺少 others 或 ironclad 分类");

const existing = bySlug.get(CATEGORY.slug);
if (existing) console.log(`  分类「${existing.name}」已存在`);

const { data: map } = await s.from("cms_video_category_map").select("video_id").eq("category_id", others.id);
const ids = (map ?? []).map((r) => String(r.video_id));
let videos = [];
for (let i = 0; i < ids.length; i += 150) {
  const { data } = await s
    .from("cms_videos")
    .select("id, slug, title, description, published_at")
    .in("id", ids.slice(i, i + 150))
    .eq("status", "published");
  videos = videos.concat(data ?? []);
}

const toCulture = [];
const toIronclad = [];
const stay = [];
for (const v of videos) {
  const hay = `${v.title} ${v.description ?? ""}`;
  if (CULTURE.test(hay)) toCulture.push(v);
  else if (IRONCLAD.test(hay)) toIronclad.push(v);
  else stay.push(v);
}

console.log(`\n=== 其它系列 ${videos.length} 支 ===`);
console.log(`\n■ 中华传统文化 ← ${toCulture.length} 支`);
for (const v of toCulture) console.log(`     ${(v.published_at ?? "").slice(0, 10)}  ${v.title.slice(0, 44)}`);
console.log(`\n■ 铁证如山 ← ${toIronclad.length} 支`);
for (const v of toIronclad) console.log(`     ${(v.published_at ?? "").slice(0, 10)}  ${v.title.slice(0, 44)}`);
console.log(`\n■ 留在其它系列 ${stay.length} 支`);

if (!APPLY) {
  console.log("\n  空跑 —— 没有写入。确认后加 --apply。");
  process.exit(0);
}

const backup = { at: new Date().toISOString(), createdCategoryId: null, moves: [] };
fs.mkdirSync("backups", { recursive: true });
const file = path.join("backups", `culture-cat-${backup.at.replace(/[:.]/g, "-")}.json`);
const save = () => fs.writeFileSync(file, JSON.stringify(backup, null, 2));

let culture = existing;
if (!culture) {
  const { data, error } = await s.from("cms_video_categories").insert(CATEGORY).select("id, slug, name").single();
  if (error) throw error;
  culture = data;
  backup.createdCategoryId = data.id;
  console.log(`\n  已建立分类「${data.name}」(${data.slug})`);
}
save();

for (const [list, target] of [
  [toCulture, culture],
  [toIronclad, ironclad]
]) {
  for (const v of list) {
    const { error } = await s
      .from("cms_video_category_map")
      .update({ category_id: target.id })
      .eq("video_id", v.id)
      .eq("category_id", others.id);
    if (error) throw error;
    backup.moves.push({ videoId: v.id, title: v.title, fromCategoryId: others.id, toCategoryId: target.id });
    save();
  }
}
console.log(`  已移动 ${backup.moves.length} 支`);
console.log(`\n  备份：${file}`);
console.log(`  撤销：node --env-file=.env.local scripts/add-culture-video-category.mjs --restore ${file}`);
