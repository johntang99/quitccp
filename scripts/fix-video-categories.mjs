/**
 * Moves videos into the category their title says they belong to.
 *
 * The import categorised by keyword, so an episode of 《希望的路》 whose title
 * also mentions 《九评》 landed in 九评系列 instead. The title is the authority
 * here: a video called 《希望的路》第三十集 is an episode of that series whatever
 * else it discusses.
 *
 * Nothing is written without `--apply`. The dry run prints every video it would
 * touch, by name, so the list can be read before anything moves.
 *
 * Usage:
 *   node scripts/fix-video-categories.mjs
 *   node scripts/fix-video-categories.mjs --apply
 *   node scripts/fix-video-categories.mjs --restore backups/vidcat-<stamp>.json
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const RESTORE = (() => {
  const i = args.indexOf("--restore");
  return i === -1 ? null : args[i + 1];
})();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Each rule: videos whose title contains `titleContains`, currently filed under
 * `fromSlug`, move to `toSlug`.
 *
 * Deliberately narrow -- it names the category being corrected rather than
 * "anything not in the right place". A title can legitimately mention a series
 * it does not belong to, and a blanket rule would start moving those too.
 */
const MOVES = [
  {
    titleContains: "希望的路",
    fromSlug: "jiuping",
    toSlug: "hope-road",
    why: "《希望的路》的剧集，因标题里提到《九评》被归进了九评系列",
    done: "2026-10-05，7 个"
  },
  {
    // The inverse shape: keep what matches, move everything else out. 九评系列
    // is the nine-part documentary itself, not every video that mentions it --
    // keyword import had put 26 unrelated reports and interviews in there.
    fromSlug: "jiuping",
    titleKeep: /九评之[一二三四五六七八九]/,
    toSlug: "frontline",
    why: "九评系列只保留《九评之一》至《九评之九》正片，其余报导与访谈归三退前线"
  }
];

const BACKUP_DIR = path.join(process.cwd(), "backups");

async function readAll(table, select) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

if (RESTORE) {
  const backup = JSON.parse(fs.readFileSync(RESTORE, "utf8"));
  let n = 0;
  for (const c of backup.changes) {
    // Put the old row back and take the new one away, in that order.
    await supabase.from("cms_video_category_map").upsert(c.before);
    await supabase
      .from("cms_video_category_map")
      .delete()
      .eq("video_id", c.after.video_id)
      .eq("category_id", c.after.category_id);
    n++;
  }
  console.log(`  restored ${n} videos from ${path.basename(RESTORE)}`);
  process.exit(0);
}

const cats = await readAll("cms_video_categories", "id, slug, name");
const bySlug = new Map(cats.map((c) => [c.slug, c]));
const videos = await readAll("cms_videos", "id, slug, title, status");
const maps = await readAll("cms_video_category_map", "video_id, category_id, position");

const catsOf = new Map();
for (const m of maps) {
  const set = catsOf.get(m.video_id) ?? new Map();
  set.set(m.category_id, m);
  catsOf.set(m.video_id, set);
}

const changes = [];
for (const rule of MOVES) {
  const from = bySlug.get(rule.fromSlug);
  const to = bySlug.get(rule.toSlug);
  if (!from || !to) {
    console.error(`  分类不存在: ${rule.fromSlug} 或 ${rule.toSlug}`);
    process.exit(1);
  }
  const hits = videos.filter((v) => {
    const owned = catsOf.get(v.id);
    if (!owned?.has(from.id)) return false;
    // `titleKeep` inverts the test: everything in the category EXCEPT what
    // matches is moved out.
    if (rule.titleKeep) return !rule.titleKeep.test(String(v.title));
    return String(v.title).includes(rule.titleContains);
  });
  if (rule.done) {
    console.log(`\n  规则（已于 ${rule.done} 执行）：「${rule.titleContains}」→「${to.name}」`);
    if (hits.length === 0) {
      console.log("  命中 0 个，无需重复执行。");
      continue;
    }
  }
  console.log(
    rule.titleKeep
      ? `\n  规则：「${from.name}」中标题不含 ${rule.titleKeep.source} 的 → 移到「${to.name}」`
      : `\n  规则：标题含「${rule.titleContains}」且在「${from.name}」→ 移到「${to.name}」`
  );
  console.log(`  原因：${rule.why}`);
  console.log(`  命中 ${hits.length} 个：\n`);
  for (const v of hits) {
    const owned = catsOf.get(v.id);
    const already = owned.has(to.id);
    console.log(`    • ${String(v.title).slice(0, 52)}`);
    if (already) {
      console.log("        （已在目标分类里，只移除旧分类）");
    }
    changes.push({
      title: v.title,
      before: owned.get(from.id),
      after: { video_id: v.id, category_id: to.id, position: owned.get(from.id).position ?? 0 },
      alreadyInTarget: already
    });
  }
}

if (changes.length === 0) {
  console.log("\n  没有需要调整的视频。");
  process.exit(0);
}

fs.mkdirSync(BACKUP_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const file = path.join(BACKUP_DIR, `vidcat-${stamp}.json`);
fs.writeFileSync(file, JSON.stringify({ at: stamp, changes }, null, 2));
console.log(`\n  共 ${changes.length} 个视频，备份已写入 ${path.relative(process.cwd(), file)}`);

if (!APPLY) {
  console.log("\n  空跑 —— 没有写入任何东西。确认无误后加 --apply 执行。");
  process.exit(0);
}

let done = 0;
for (const c of changes) {
  // Add the new mapping first: if the run dies between the two statements the
  // video sits in both categories, which is visible and harmless. Removing
  // first would leave it in none, which looks like the video vanished.
  if (!c.alreadyInTarget) {
    const { error } = await supabase.from("cms_video_category_map").insert(c.after);
    if (error) throw error;
  }
  const { error } = await supabase
    .from("cms_video_category_map")
    .delete()
    .eq("video_id", c.before.video_id)
    .eq("category_id", c.before.category_id);
  if (error) throw error;
  done++;
}
console.log(`  已调整 ${done} 个视频。`);
console.log(`  如需撤销：node scripts/fix-video-categories.mjs --restore ${path.relative(process.cwd(), file)}`);
