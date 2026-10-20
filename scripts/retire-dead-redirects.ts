/**
 * 删掉目标已经不存在的重定向，并把清单留档。
 *
 * 一条 308 跳到 404 的重定向，对读者和搜索引擎都不比直接 404 好 —— 它只是多
 * 一跳，还让「断链」这个指标永远不为零，于是任何基于它的报警都成了噪音。
 *
 * 真正的前提是：先确认这些目标是「内容没了」，而不是「内容搬了」。搬了的要
 * 重指（见 repoint-series-redirects / repoint-stale-destinations），删是最后一步。
 *
 * 删之前把每一行写进 docs/implementation/retired-redirects.csv 并提交。那 154
 * 篇文章的正文备份（artifacts/image-recovery/deleted-articles.json）已经不在了，
 * artifacts/ 又在 .gitignore 里，所以这份清单是旧地址和标题仅剩的记录。
 *
 *     npx tsx scripts/retire-dead-redirects.ts            # 预演，并写出 CSV
 *     npx tsx scripts/retire-dead-redirects.ts --apply
 */

import pg from "pg";
import { writeFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const RECORD = "docs/implementation/retired-redirects.csv";

/*
 * 带子目录的目标（/resources/downloads/<类>/<slug>）不算在内：那是资料详情页
 * 的正常地址，按 slug 配资料表配不上，但它本来就是通的。
 */
const DEAD = `
  select r.id, r.legacy_url, r.destination_url
  from cms_redirects r
  where r.destination_url ~ '^/[a-z]+/[^/]+$'
    and not exists (select 1 from cms_articles  a where r.destination_url = '/news/'      || a.slug)
    and not exists (select 1 from cms_videos    v where r.destination_url = '/videos/'    || v.slug)
    and not exists (select 1 from cms_materials m where r.destination_url = '/resources/' || m.slug)
`;

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  /* 删除原因从审计日志里取 —— 行已经没了，标题只有那里还留着。 */
  const { rows } = await client.query(`
    with dead as (${DEAD})
    select d.id, d.legacy_url, d.destination_url,
           (select al.detail->>'title' from cms_audit_logs al
             where al.action in ('article.delete', 'video.delete', 'material.delete')
               and al.detail::text like '%' || substring(d.destination_url from '^/[a-z]+/(.*)$') || '%'
             limit 1) as deleted_title,
           (select to_char(al.created_at, 'YYYY-MM-DD') from cms_audit_logs al
             where al.action in ('article.delete', 'video.delete', 'material.delete')
               and al.detail::text like '%' || substring(d.destination_url from '^/[a-z]+/(.*)$') || '%'
             limit 1) as deleted_on
    from dead d
    order by d.destination_url
  `);

  /* 搬了家的必须先重指，不能当成「内容没了」删掉。 */
  const { rows: movable } = await client.query(`
    with dead as (${DEAD})
    select count(*)::int as n from dead d
    where exists (select 1 from cms_articles a where a.slug_legacy = substring(d.destination_url from '^/[a-z]+/([^/]+)$'))
       or exists (select 1 from cms_videos   v where v.slug_legacy = substring(d.destination_url from '^/[a-z]+/([^/]+)$'))
  `);
  if (movable[0].n > 0) {
    throw new Error(
      `有 ${movable[0].n} 条的目标其实只是改名了，内容还在。先跑 repoint-stale-destinations.ts，再回来删。`
    );
  }

  const quote = (text: string) => `"${String(text ?? "").replace(/"/g, '""')}"`;
  const csv = ["legacy_url,dead_destination,title,deleted_on"]
    .concat(
      rows.map((r) =>
        [quote(r.legacy_url), quote(r.destination_url), quote(r.deleted_title ?? ""), r.deleted_on ?? ""].join(",")
      )
    )
    .join("\n");
  writeFileSync(RECORD, csv + "\n", "utf8");

  const withTitle = rows.filter((r) => r.deleted_title).length;
  console.log(`\n${APPLY ? "删" : "预演"}：${rows.length} 条目标已不存在`);
  console.log(`  其中审计日志里查到删除记录的 ${withTitle} 条，查不到的 ${rows.length - withTitle} 条`);
  console.log(`  清单已写入 ${RECORD}（${rows.length} 行）—— 记得提交\n`);
  for (const r of rows.slice(0, 6)) {
    console.log(`  ${r.legacy_url}  ->  ${r.destination_url}`);
  }
  if (rows.length > 6) console.log(`  …另外 ${rows.length - 6} 条`);

  if (!APPLY) {
    console.log("\n（预演，没有删任何一行。加 --apply 才真删。）\n");
    await client.end();
    return;
  }

  await client.query("begin");
  try {
    const { rowCount } = await client.query(
      `delete from cms_redirects where id = any($1::uuid[])`,
      [rows.map((r) => r.id)]
    );
    await client.query("commit");
    console.log(`\n已删 ${rowCount} 条。这些旧地址今后直接 404，不再多跳一次。\n`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  }

  await client.end();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
