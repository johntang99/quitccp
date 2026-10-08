/**
 * Moves films out of 其它系列 into the series they actually belong to.
 *
 * 其它系列 had grown to 417 of the library's 905 films -- it had stopped being
 * a category and become the place things landed when nobody chose one. The
 * rules below were written against the titles that are really in there, and
 * against what each target category already holds, not against what its name
 * suggests:
 *
 *   三退前线      现场：游行、集会、车队、服务点、国际人士声援
 *   破除党文化    剖析中共如何改写历史与思维 —— 江峰时刻、历史上的今天、天亮时分
 *   铁证如山      活摘器官与追查国际
 *   觉醒之旅      三退人数的里程碑、纪录片、公众觉醒
 *   退一步海阔天空 劝退故事、真相感化、人物专访
 *
 * Only films that still play are moved. A film whose YouTube id is gone would
 * just carry the breakage into a category people actually browse; those stay
 * in 其它系列 until the playability list is dealt with separately.
 *
 * A film keeps 其它系列 only if nothing matched. Secondary categories are not
 * touched -- this replaces the one mapping that put it in 其它系列.
 *
 *   node --env-file=.env.local scripts/recategorize-other-videos.mjs
 *   node --env-file=.env.local scripts/recategorize-other-videos.mjs --apply
 *   node --env-file=.env.local scripts/recategorize-other-videos.mjs --restore backups/video-cats-<stamp>.json
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
  const backup = JSON.parse(fs.readFileSync(RESTORE, "utf8"));
  for (const m of backup.moves) {
    const { error } = await s
      .from("cms_video_category_map")
      .update({ category_id: m.fromCategoryId })
      .eq("video_id", m.videoId)
      .eq("category_id", m.toCategoryId);
    if (error) throw error;
  }
  console.log(`  已还原 ${backup.moves.length} 支影片的分类`);
  process.exit(0);
}

/**
 * First match wins, so the order is the judgement.
 *
 * The named series come before the generic 三退 rule: a 江峰时刻 episode about
 * the 退党潮 is still a 江峰时刻 episode, and sorting it by its one mention of
 * 三退 would scatter the series across four categories.
 */
const RULES = [
  { to: "ironclad", why: "活摘器官／追查国际", test: /活摘|摘取器官|器官移植|追查国际|追查迫害法轮功/ },
  /*
   * A speech, titled by who gave it: 「维吾尔族人权活动家：与法轮功共抗跨境迫害」.
   * These are people speaking for us at an event, which is what 三退前线 is --
   * it already holds 「基督教自由国际」总裁温迪·赖特…. Matched on the role in
   * front of the colon, so it does not catch a programme name like
   * 「石涛聚焦：…」, which is a show rather than a person.
   */
  {
    to: "frontline",
    why: "个人演讲／国际人士声援",
    /* Title only. Against title+description the `^` still anchored at the
       title, but the colon could be found in the description -- which is how
       「血旗怎能代表中国」 was read as a speech by someone called 代表. */
    field: "title",
    test: /^[^：:【】]{2,14}(主任|会长|主席|总裁|执行长|秘书长|理事长|创始人|发言人|大使|顾问|委员|教授|博士|学者|专家|研究员|议员|市长|州长|律师|作家|记者|导演|活动家|牧师|神父|将军|官员|幸存者)[^：:]{0,8}[：:]/
  },
  /*
   * Named commentary shows. Same genre as 江峰时刻 and 历史上的今天, which are
   * already in 破除党文化; splitting them by host would scatter one kind of
   * programme across two categories.
   */
  {
    to: "party-culture",
    why: "名家评论节目",
    test: /【?李天笑|快评天下事|【?今日点击|【?石涛聚焦|【?老北京茶馆|【?菁英论坛|【?细语人生|【?世事关心/
  },
  {
    to: "party-culture",
    why: "历史与党文化评论系列",
    test:
      /【?江峰时刻|【?天亮时分|章天亮|历史上的今天|【?百年真相|辛灏年|名家论坛|抗日真相|党文化|洗脑|愚民|篡改历史|历史真相|毛泽东|林彪|马克思|列宁|斯大林|蒋介石|戴笠|张灵甫|红卫兵|文革|柏林墙|苏联秘档|共产党领袖|中共党史/
  },
  {
    to: "frontline",
    why: "现场：游行、集会、车队、服务点、声援",
    test: /游行|集会|车队|服务点|真相点|法拉盛|唐人街|退党中心.{0,6}(活动|纽约|游行)|声援|褒奖|颁奖|议员|国会|市长|州长|市议会|联署|征签|纪念日活动/
  },
  {
    to: "awakening",
    why: "三退里程碑、纪录片与公众觉醒",
    test: /三退人数|退党人数|突破\s*\d|[一二三四五六七八九十\d]\s*亿.{0,8}(三退|退党|觉醒)|觉醒|首映|纪录片|《四亿人/
  },
  {
    to: "step-back",
    why: "劝退故事、真相感化、人物专访",
    test: /专访|访谈|口述|自述|亲历|感化|劝退|有缘人|讲真相.{0,6}(退|明白)|退党故事|心路/
  },
  { to: "frontline", why: "三退相关报导", test: /三退|退党|退团|退队|解体中共|End\s*CCP|天灭中共/i }
];

const { data: cats, error: catError } = await s.from("cms_video_categories").select("id, slug, name");
if (catError) throw catError;
const bySlug = new Map(cats.map((c) => [c.slug, c]));
const others = bySlug.get("others");
if (!others) throw new Error("找不到 others 分类");

const { data: map } = await s.from("cms_video_category_map").select("video_id").eq("category_id", others.id);
const ids = (map ?? []).map((r) => String(r.video_id));

const videos = [];
for (let i = 0; i < ids.length; i += 200) {
  const { data } = await s
    .from("cms_videos")
    .select("id, slug, title, description, published_at")
    .in("id", ids.slice(i, i + 200))
    .eq("status", "published");
  videos.push(...(data ?? []));
}

/* Which of them still play, from the playability scan. */
const csv = "docs/implementation/video-playability-others.csv";
if (!fs.existsSync(csv)) {
  console.log(`  先跑 check-video-playability.mjs others，${csv} 还不存在`);
  process.exit(1);
}
const playable = new Set();
const brokenBySlug = new Map();
{
  const lines = fs.readFileSync(csv, "utf8").split("\n").slice(1);
  for (const line of lines) {
    const cells = line.match(/"([^"]|"")*"/g);
    if (!cells || cells.length < 5) continue;
    const un = (c) => c.slice(1, -1).replace(/""/g, '"');
    const state = un(cells[0]);
    const slug = un(cells[4]);
    if (state === "可播放") playable.add(slug);
    else brokenBySlug.set(slug, state);
  }
}

const moves = [];
const stay = [];
const skippedBroken = [];
for (const v of videos) {
  if (!playable.has(v.slug)) {
    skippedBroken.push({ ...v, state: brokenBySlug.get(v.slug) ?? "未知" });
    continue;
  }
  const hay = `${v.title} ${v.description ?? ""}`;
  const hit = RULES.find((r) => r.test.test(r.field === "title" ? v.title : hay));
  if (!hit) {
    stay.push(v);
    continue;
  }
  const target = bySlug.get(hit.to);
  if (!target) throw new Error(`目标分类不存在: ${hit.to}`);
  moves.push({
    videoId: v.id,
    slug: v.slug,
    title: v.title,
    toCategoryId: target.id,
    toName: target.name,
    fromCategoryId: others.id,
    why: hit.why
  });
}

const byTarget = {};
for (const m of moves) (byTarget[m.toName] ??= []).push(m);

console.log(`\n=== 其它系列 ${videos.length} 支 ===`);
console.log(`  可播放并已分类：${moves.length}`);
console.log(`  可播放但没有明确归属，留在其它系列：${stay.length}`);
console.log(`  播不了，暂不动：${skippedBroken.length}`);

console.log("\n=== 建议的去向 ===");
for (const [name, list] of Object.entries(byTarget).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n■ ${name} ← ${list.length} 支   （${list[0].why}）`);
  for (const m of list.slice(0, 6)) console.log(`     ${m.title.slice(0, 46)}`);
  if (list.length > 6) console.log(`     …另有 ${list.length - 6} 支`);
}

if (stay.length) {
  console.log(`\n■ 留在其它系列的 ${stay.length} 支（样例）`);
  for (const v of stay.slice(0, 8)) console.log(`     ${v.title.slice(0, 46)}`);
}

if (!APPLY) {
  console.log("\n  空跑 —— 没有写入。确认后加 --apply。");
  process.exit(0);
}

fs.mkdirSync("backups", { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const file = path.join("backups", `video-cats-${stamp}.json`);
fs.writeFileSync(file, JSON.stringify({ at: stamp, moves }, null, 2));
console.log(`\n  备份已写入 ${file}`);

let done = 0;
for (const m of moves) {
  const { error } = await s
    .from("cms_video_category_map")
    .update({ category_id: m.toCategoryId })
    .eq("video_id", m.videoId)
    .eq("category_id", m.fromCategoryId);
  if (error) throw error;
  done += 1;
  if (done % 20 === 0) process.stdout.write(`\r  已移动 ${done}/${moves.length}   `);
}
process.stdout.write(`\r  已移动 ${done}/${moves.length}   \n`);
console.log(`  撤销：node --env-file=.env.local scripts/recategorize-other-videos.mjs --restore ${file}`);
