/**
 * Files the last 23 films out of 其它系列, by hand.
 *
 * At this size a regex would be pretending to understand them. Each line below
 * is a decision made after reading the film's own summary, and the three
 * destinations are the ones that exist:
 *
 *   三退前线        a speech, an event, or a report tied to 三退 / 退党证明
 *   破除党文化      analysis: how the Party works, rewrites history, or is failing
 *   退一步海阔天空  one person's experience, plea, or the piece of truth that moved them
 *
 *   node --env-file=.env.local scripts/empty-others-category.mjs
 *   node --env-file=.env.local scripts/empty-others-category.mjs --apply
 *   node --env-file=.env.local scripts/empty-others-category.mjs --restore backups/empty-others-<stamp>.json
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
  for (const m of b.moves) {
    const { error } = await s
      .from("cms_video_category_map")
      .update({ category_id: m.fromCategoryId })
      .eq("video_id", m.videoId)
      .eq("category_id", m.toCategoryId);
    if (error) throw error;
  }
  console.log(`  已还原 ${b.moves.length} 支`);
  process.exit(0);
}

/** 标题里足以认出这支片的一段 → 去向。 */
const PLAN = [
  // 个人演讲、现场、与三退直接相关的报导
  ["汪志远：纪念4.25", "frontline", "汪志远的演讲"],
  ["隐瞒军旅身份 入境美国被捕", "frontline", "党员身份与入境／退党证明直接相关"],

  // 一个人的经历、请求，或打动他的那一点真相
  ["藏字石惊现天意", "step-back", "被广泛用来劝三退的那块石头"],
  ["一个美国女孩的中国经历", "step-back", "亲历见闻"],
  ["一位老人的请求", "step-back", "一位老人对世人的劝告"],

  // 剖析中共：手法、历史、败象
  ["血旗怎能代表中国", "party-culture", "党旗与国旗的偷换"],
  ["美前驻华大使回忆让邓小平大为光火", "party-culture", "中共高层历史"],
  ["成龙是曾庆红兄弟在台前的头号王牌", "party-culture", "统战与代理人"],
  ["江派黑帮特工袭击香港", "party-culture", "中共打压香港的手法"],
  ["〝雨伞运动〞台前幕后搅局的江派人马", "party-culture", "中共打压香港的手法"],
  ["香港旺角伤人暴徒被曝曾为梁振英站台", "party-culture", "中共打压香港的手法"],
  ["拆解中共打压香港雨伞运动招术", "party-culture", "中共打压香港的手法"],
  ["中共图谋用人工智能奴役全世界", "party-culture", "监控与控制手段"],
  ["法轮功在中国一直是合法的", "party-culture", "拆穿中共的法律谎言"],
  ["中国农村疫情引关注", "party-culture", "掩盖疫情"],
  ["胡鑫宇离奇失踪", "party-culture", "官方叙事与真相"],
  ["维护中国人的尊严", "party-culture", "党文化如何改变中国人的形象"],
  ["深圳大火背后", "party-culture", "产业与权力博弈分析"],
  ["党魁江习二家轮流为许家印站台", "party-culture", "权贵与债务"],
  ["中共最高层犯罪率远超社会", "party-culture", "体制败象"],
  ["思科案真的会带来", "party-culture", "中共迫害的境外共谋"],
  ["中共利用礼品卡、加密货币与洗钱网络", "party-culture", "中共的境外资金手法"],
  ["中共入党新规的魔性逻辑", "party-culture", "入党制度本身"]
];

const { data: cats } = await s.from("cms_video_categories").select("id, slug, name");
const bySlug = new Map(cats.map((c) => [c.slug, c]));
const others = bySlug.get("others");

const { data: map } = await s.from("cms_video_category_map").select("video_id").eq("category_id", others.id);
const ids = (map ?? []).map((r) => String(r.video_id));
let videos = [];
for (let i = 0; i < ids.length; i += 150) {
  const { data } = await s
    .from("cms_videos")
    .select("id, slug, title, published_at")
    .in("id", ids.slice(i, i + 150))
    .eq("status", "published");
  videos = videos.concat(data ?? []);
}

const moves = [];
const matched = new Set();
const unmatchedPlan = [];
for (const [needle, slug, why] of PLAN) {
  const v = videos.find((x) => x.title.includes(needle) && !matched.has(x.id));
  if (!v) {
    unmatchedPlan.push(needle);
    continue;
  }
  matched.add(v.id);
  const target = bySlug.get(slug);
  if (!target) throw new Error(`没有这个分类: ${slug}`);
  moves.push({ videoId: v.id, title: v.title, toCategoryId: target.id, toName: target.name, fromCategoryId: others.id, why });
}
const leftover = videos.filter((v) => !matched.has(v.id));

const byTarget = {};
for (const m of moves) (byTarget[m.toName] ??= []).push(m);

console.log(`\n=== 其它系列 ${videos.length} 支 ===`);
for (const [name, list] of Object.entries(byTarget).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n■ ${name} ← ${list.length} 支`);
  for (const m of list) console.log(`     ${m.title.slice(0, 38).padEnd(40)} ${m.why}`);
}
if (unmatchedPlan.length) {
  console.log(`\n  ⚠ 计划里有 ${unmatchedPlan.length} 条没对上影片（标题可能变了）：`);
  for (const n of unmatchedPlan) console.log(`     ${n}`);
}
if (leftover.length) {
  console.log(`\n  ⚠ 还有 ${leftover.length} 支没安排：`);
  for (const v of leftover) console.log(`     ${v.title.slice(0, 48)}`);
}

if (!APPLY) {
  console.log("\n  空跑 —— 没有写入。确认后加 --apply。");
  process.exit(0);
}

const backup = { at: new Date().toISOString(), moves };
fs.mkdirSync("backups", { recursive: true });
const file = path.join("backups", `empty-others-${backup.at.replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(file, JSON.stringify(backup, null, 2));

for (const m of moves) {
  const { error } = await s
    .from("cms_video_category_map")
    .update({ category_id: m.toCategoryId })
    .eq("video_id", m.videoId)
    .eq("category_id", m.fromCategoryId);
  if (error) throw error;
}
console.log(`\n  已移动 ${moves.length} 支`);
console.log(`  备份：${file}`);
console.log(`  撤销：node --env-file=.env.local scripts/empty-others-category.mjs --restore ${file}`);
