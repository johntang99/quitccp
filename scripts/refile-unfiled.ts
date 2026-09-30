/**
 * Empties 待归类.
 *
 * The holding category exists because the import refused to guess: the seven
 * 【视频系列】 categories had no article-side equivalent, so everything under
 * them was parked rather than filed somewhere wrong.
 *
 * 214 of the 227 turn out to be the article copies of videos that are now in
 * the video library -- 《希望的路》 episodes, 【三退大潮】, 【退党洪流】, the 九评
 * essays. Since the articles stay put, they still need a category a reader can
 * make sense of, and 待归类 is not one.
 *
 *   npx tsx scripts/refile-unfiled.ts --dry-run
 *   npx tsx scripts/refile-unfiled.ts --apply
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const HOLDING = "待归类";

/**
 * Where an article belongs, by what it is.
 *
 * Deliberately conservative. Anything it cannot place stays in 待归类 rather
 * than being pushed into a category on a weak signal -- a wrong category is
 * harder to notice, and harder to undo, than an unfiled one.
 */
export function categoryFor(title: string): string | null {
  if (/^九评之|九评共产党/.test(title)) return "专题报导与时政评论";
  if (/《希望的路》|【三退大潮】|【退党洪流】|《解体中共洪势》|三退|退党|End ?CCP|征签/i.test(title))
    return "三退要闻";
  // Personal narrative series -- 维权斗士陈祥卫的抗争之路, 仇先生的故事,
  // 汲先生的故事, 专访上海企业家胡力任. These are first-person accounts of
  // leaving, which is exactly what 退党纪实故事 is for.
  if (/的故事|抗争之路|心路历程|觉醒之路|走线|专访|讲述|亲历|自述|口述/.test(title))
    return "退党纪实故事";
  // Named testimony: 维权人士张五洲（二）, 杨先生的坚持与信念（上）,
  // 赵慧子：君子不立于危墙之下 远离中共. A person speaking under their own name
  // about leaving is the same kind of piece as the series above.
  if (/维权人士|维权斗士|先生的|女士的/.test(title)) return "退党纪实故事";
  if (/^[\u4e00-\u9fa5]{2,4}[：:]/.test(title) && /退出|远离|脱离|三退|中共/.test(title))
    return "退党纪实故事";
  if (/活摘|器官|追查|铁证如山/.test(title)) return "追查国际调查报告";
  if (/欧盟|美众院|法案|国会|议员|制裁|贸易敌人|间谍/.test(title)) return "国际声援行动";
  if (/法轮功|真相点|游行|仇恨犯罪|拜年/.test(title)) return "三退要闻";
  if (/影视|演员|家国|文化|传统/.test(title)) return "中华传统文化";
  return null;
}

async function main() {
  const apply = process.argv.includes("--apply");

  const { data: holding } = await supabase
    .from("cms_article_categories")
    .select("id")
    .eq("name", HOLDING)
    .maybeSingle();
  if (!holding) {
    console.log(`没有「${HOLDING}」分类，无需处理。`);
    return;
  }

  const { data } = await supabase
    .from("cms_articles")
    .select("id, title, cms_article_category_map!inner(category_id)")
    .eq("cms_article_category_map.category_id", holding.id)
    .limit(1000);
  const articles = (data ?? []) as unknown as { id: string; title: string }[];

  const { data: categoryRows } = await supabase.from("cms_article_categories").select("id, name");
  const categoryId = new Map((categoryRows ?? []).map((row) => [String(row.name), String(row.id)]));

  const plan = articles.map((article) => ({ article, target: categoryFor(article.title) }));
  const placed = plan.filter((entry) => entry.target && categoryId.has(entry.target));
  const stuck = plan.filter((entry) => !entry.target || !categoryId.has(entry.target));

  const tally = new Map<string, number>();
  for (const entry of placed) tally.set(entry.target!, (tally.get(entry.target!) ?? 0) + 1);
  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    inHolding: articles.length,
    willFile: placed.length,
    stays: stuck.length,
    byCategory: Object.fromEntries(tally)
  }, null, 2));

  if (stuck.length > 0) {
    console.log("\n仍留在待归类的:");
    for (const entry of stuck) console.log("  ·", entry.article.title.slice(0, 50));
  }
  if (!apply) return;

  for (const entry of placed) {
    const target = categoryId.get(entry.target!)!;
    // Replace the primary category: drop position 0 and any existing copy of
    // the target, then insert the target at position 0.
    await supabase.from("cms_article_category_map").delete().eq("article_id", entry.article.id).eq("position", 0);
    await supabase
      .from("cms_article_category_map")
      .delete()
      .eq("article_id", entry.article.id)
      .eq("category_id", target);
    const { error } = await supabase
      .from("cms_article_category_map")
      .insert({ article_id: entry.article.id, category_id: target, position: 0 });
    if (error) throw error;
  }
  console.log(`\n已改归 ${placed.length} 篇。`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
