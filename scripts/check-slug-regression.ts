/**
 * 改过转写逻辑之后，现有内容的地址会不会变。
 *
 * 全站 16,233 条内容的地址是 2026-10-19 那次拼音迁移一次性算出来的。此后任何
 * 一次改动转写规则 —— 换库、改折叠表、调截断 —— 都有可能让同一个标题算出不同的
 * 地址。那不会报错，只会让**下一次有人保存这篇文章时地址悄悄变掉**，而旧地址
 * 靠跳转续命，站内链接、二维码、别人贴出去的链接则各自过期。
 *
 * 所以每次动转写层，拿真实数据跑一遍：同样的标题 + 同样的发布日，还算不算得出
 * 它现在的地址。
 *
 * 不是零也不一定是出事 —— 编辑手工改过的地址、迁移之后新建的内容，都会不一致。
 * 所以差异要逐条打印出来看，而不是只给一个数字。
 *
 *     npx tsx scripts/check-slug-regression.ts
 *     npx tsx scripts/check-slug-regression.ts --limit 2000
 */

import pg from "pg";
import { slugifyTitle } from "../apps/web/src/lib/admin/slugify";

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}
const LIMIT = Number(arg("--limit") ?? 0) || null;
const LOCALE = arg("--locale") ?? "zh";

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  let checked = 0;
  let same = 0;
  const diffs: { kind: string; title: string; now: string; recomputed: string }[] = [];

  for (const [table, kind] of [
    ["cms_articles", "文章"],
    ["cms_videos", "视频"]
  ] as [string, string][]) {
    /*
     * 只看迁移生成的那批：日期前缀开头、没有 -2 这种撞名后缀。
     * 撞名后缀是调用方加的，不是 slugifyTitle 的产出，拿它比对只会得到假差异。
     */
    const { rows } = await client.query(
      `select title, slug, published_at from ${table}
        where locale = $1
          and slug ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}-'
          and slug !~ '-[0-9]+$'
        order by id` + (LIMIT ? ` limit ${LIMIT}` : ""),
      [LOCALE]
    );
    for (const row of rows) {
      const recomputed = slugifyTitle(row.title, {
        withDate: true,
        date: row.published_at,
        locale: LOCALE
      });
      checked += 1;
      if (recomputed === row.slug) same += 1;
      else diffs.push({ kind, title: String(row.title), now: row.slug, recomputed });
    }
  }
  await client.end();

  console.log(`\n抽查 ${checked} 条（locale=${LOCALE}）：一字不差 ${same}，不同 ${diffs.length}`);
  if (diffs.length === 0) {
    console.log("\n✓ 转写逻辑没有漂移。\n");
    return;
  }

  console.log("\n不同的：\n");
  for (const d of diffs.slice(0, 30)) {
    console.log(`  [${d.kind}]《${d.title.slice(0, 40)}》`);
    console.log(`      现有 ${d.now}`);
    console.log(`      重算 ${d.recomputed}\n`);
  }
  if (diffs.length > 30) console.log(`  …另外 ${diffs.length - 30} 条\n`);
  console.log(
    "逐条看过再判断：编辑手工改过的地址、迁移之后新建的内容，本来就会不一致。\n" +
      "如果是转写规则变了导致的，那就是回归 —— 现有地址会在下一次保存时悄悄变掉。\n"
  );
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
