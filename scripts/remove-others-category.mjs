/**
 * Retires 其它系列.
 *
 * The category had become the place films landed when nobody chose one -- 417
 * of 905 at its peak. Everything in it now has a real home, so the category
 * itself can go.
 *
 * The 49 films still mapped to it are the private ones, unpublished earlier and
 * reserved for later. They are given proper categories rather than deleted, and
 * stay unpublished: deleting them would undo that decision, and they come back
 * the moment the channel makes them public again. Pass --purge to delete them
 * instead.
 *
 *   node --env-file=.env.local scripts/remove-others-category.mjs
 *   node --env-file=.env.local scripts/remove-others-category.mjs --apply
 *   node --env-file=.env.local scripts/remove-others-category.mjs --apply --purge
 *   node --env-file=.env.local scripts/remove-others-category.mjs --restore backups/rm-others-<stamp>.json
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const APPLY = process.argv.includes("--apply");
const PURGE = process.argv.includes("--purge");
const RESTORE = (() => {
  const i = process.argv.indexOf("--restore");
  return i === -1 ? null : process.argv[i + 1];
})();

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

if (RESTORE) {
  const b = JSON.parse(fs.readFileSync(RESTORE, "utf8"));
  let others = b.category;
  if (others) {
    const { error } = await s.from("cms_video_categories").insert(others);
    if (error && error.code !== "23505") throw error;
  }
  for (const v of b.deletedVideos ?? []) {
    await s.from("cms_videos").insert(v.row);
    for (const cid of v.categoryIds) {
      await s.from("cms_video_category_map").insert({ video_id: v.row.id, category_id: cid, position: 0 });
    }
  }
  for (const m of b.moves ?? []) {
    await s
      .from("cms_video_category_map")
      .update({ category_id: m.fromCategoryId })
      .eq("video_id", m.videoId)
      .eq("category_id", m.toCategoryId);
  }
  console.log(`  已还原：分类、${(b.moves ?? []).length} 条归类、${(b.deletedVideos ?? []).length} 支影片`);
  process.exit(0);
}

/**
 * Where the remaining films go. Nearly all of them are about communism's
 * history -- Ukraine's de-communisation, the Cultural Revolution, the Korean
 * War, the Cold War -- which is what 破除党文化 already holds.
 */
const RULES = [
  { to: "ironclad", test: /活摘|摘取器官|器官移植|追查国际/ },
  { to: "frontline", test: /游行|集会|车队|服务点|法拉盛|唐人街|声援|褒奖|议员|国会|市长|州长|联署|三退|退党|退团|退队|弃共|今天你退了吗/ },
  { to: "awakening", test: /觉醒|首映|纪录片/ },
  { to: "step-back", test: /专访|访谈|口述|自述|亲历|感化|见证/ },
  // Everything left is history, and history is where 破除党文化 lives.
  { to: "party-culture", test: /.*/ }
];

const { data: cats } = await s.from("cms_video_categories").select("*");
const bySlug = new Map(cats.map((c) => [c.slug, c]));
const others = bySlug.get("others");
if (!others) {
  console.log("  其它系列已经不存在了");
  process.exit(0);
}

const { data: map } = await s.from("cms_video_category_map").select("video_id").eq("category_id", others.id);
const ids = (map ?? []).map((r) => String(r.video_id));
let videos = [];
for (let i = 0; i < ids.length; i += 150) {
  const { data, error } = await s.from("cms_videos").select("*").in("id", ids.slice(i, i + 150));
  if (error) throw error;
  videos = videos.concat(data ?? []);
}

const plan = videos.map((v) => {
  /* Title only. These summaries are full of words that mean something else
     here -- 「乌克兰国会议员」 is not a congressman backing 三退, and matching it
     filed a piece about de-communising Ukraine under 三退前线. */
  const hit = RULES.find((r) => r.test.test(v.title));
  return { v, target: bySlug.get(hit.to) };
});

const byTarget = {};
for (const p of plan) (byTarget[p.target.name] ??= []).push(p.v);

console.log(`\n=== 其它系列还挂着 ${videos.length} 支（全部是下架草稿）===`);
if (PURGE) {
  console.log("  --purge：这 49 支将被删除");
} else {
  for (const [name, list] of Object.entries(byTarget).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n■ ${name} ← ${list.length} 支（仍保持下架）`);
    for (const v of list.slice(0, 5)) console.log(`     ${v.title.slice(0, 44)}`);
    if (list.length > 5) console.log(`     …另有 ${list.length - 5} 支`);
  }
}
console.log(`\n  然后删除分类「${others.name}」(${others.slug})`);

if (!APPLY) {
  console.log("\n  空跑 —— 没有写入。确认后加 --apply（要连影片一起删就再加 --purge）。");
  process.exit(0);
}

const backup = { at: new Date().toISOString(), category: others, moves: [], deletedVideos: [] };
fs.mkdirSync("backups", { recursive: true });
const file = path.join("backups", `rm-others-${backup.at.replace(/[:.]/g, "-")}.json`);
const save = () => fs.writeFileSync(file, JSON.stringify(backup, null, 2));

if (PURGE) {
  for (const { v } of plan) {
    const { data: maps } = await s.from("cms_video_category_map").select("category_id").eq("video_id", v.id);
    backup.deletedVideos.push({ row: v, categoryIds: (maps ?? []).map((m) => String(m.category_id)) });
  }
  save();
  for (const { v } of plan) {
    await s.from("cms_video_category_map").delete().eq("video_id", v.id);
    const { error } = await s.from("cms_videos").delete().eq("id", v.id);
    if (error) throw error;
  }
  console.log(`\n  已删除 ${backup.deletedVideos.length} 支影片`);
} else {
  for (const { v, target } of plan) {
    const { error } = await s
      .from("cms_video_category_map")
      .update({ category_id: target.id })
      .eq("video_id", v.id)
      .eq("category_id", others.id);
    if (error) throw error;
    backup.moves.push({ videoId: v.id, title: v.title, fromCategoryId: others.id, toCategoryId: target.id });
  }
  save();
  console.log(`\n  已归类 ${backup.moves.length} 支（仍保持下架）`);
}

const { error: delError } = await s.from("cms_video_categories").delete().eq("id", others.id);
if (delError) throw delError;
console.log(`  已删除分类「${others.name}」`);
save();
console.log(`\n  备份：${file}`);
console.log(`  撤销：node --env-file=.env.local scripts/remove-others-category.mjs --restore ${file}`);
