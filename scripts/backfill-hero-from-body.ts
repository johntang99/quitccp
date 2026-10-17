/**
 * 把正文里的第一张图提上来当封面。
 *
 *   npx tsx --env-file=.env.local scripts/backfill-hero-from-body.ts [--write]
 *
 * 「封面图」是后来才有的约定。更早的文章不带这个字段，照片都在正文里 ——
 * 所以 hero_image 为空从来不等于这篇文章没有图。全站 9,343 篇没有封面，
 * 其中这么一批其实有现成的图，只是没人把它拿出来。
 *
 * 用的是 lib/markdown-image.ts 里那个函数，和文章页取首图的规则同一套 ——
 * 两边各写一份，站上和库里就会对「这篇文章以哪张图打头」有不同意见。
 */
import { createClient } from "@supabase/supabase-js";
import { firstImageInMarkdown } from "../apps/web/src/lib/markdown-image";

const WRITE = process.argv.includes("--write");
const PAGE = 500;

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 没配");
  const supabase = createClient(url, key);

  const found: { id: string; title: string; image: string }[] = [];
  for (let from = 0; ; from += PAGE) {
    /* 分页取，不是因为优雅，是因为 PostgREST 一次最多给一千行而且不报错 ——
       不翻页的话这个脚本会安静地只处理前一千篇。 */
    const { data, error } = await supabase
      .from("cms_articles")
      .select("id, title, body_markdown")
      .eq("status", "published")
      .or("hero_image.is.null,hero_image.eq.")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data ?? [];
    for (const row of rows) {
      const image = firstImageInMarkdown(String(row.body_markdown ?? ""));
      if (image) found.push({ id: String(row.id), title: String(row.title), image });
    }
    if (rows.length < PAGE) break;
  }

  console.log(`正文里有图、但没设封面的：${found.length} 篇`);
  for (const row of found.slice(0, 8)) {
    console.log(`  ${row.title.slice(0, 32)}`);
    console.log(`      ${row.image.slice(0, 96)}`);
  }
  if (found.length > 8) console.log(`  …另外 ${found.length - 8} 篇`);

  if (!WRITE) {
    console.log("\n（试运行。加 --write 才真的写入。）");
    return;
  }

  let done = 0;
  for (const row of found) {
    const { error } = await supabase
      .from("cms_articles")
      .update({ hero_image: row.image })
      .eq("id", row.id);
    if (error) {
      console.error(`  写入失败 ${row.title}: ${error.message}`);
      continue;
    }
    done += 1;
  }
  console.log(`\n写入 ${done} / ${found.length} 篇。`);
}

main().catch((error) => {
  console.error("失败：", error instanceof Error ? error.message : error);
  process.exit(1);
});
