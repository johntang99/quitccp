/**
 * 只读检查：每一条重定向的目标，现在还在不在。
 *
 * 和 validate-redirects.ts 的分工：那个验形状（legacy_url 不重复、以 / 开头、
 * 301、目标前缀在白名单里），读的是迁移时的 JSON 文件；这个验「通不通」，读的
 * 是数据库当下的样子。2026-10-20 断掉的 411 条在 validate-redirects 眼里全部
 * 合格 —— 形状没问题，只是目标不存在。
 *
 * 用的是 count_dead_redirects()（035 迁移），和每小时自检里那一项同一个定义。
 * 两处各写一份 SQL，迟早会漂移到一个说有问题、另一个说没有。
 *
 * 目标不为 0 时以非零状态退出，方便挂进任何自动化。改名或下架内容的脚本跑完，
 * 顺手跑一下这个。
 *
 *     npx tsx scripts/check-redirect-targets.ts
 *     npm run redirects:check
 */

import pg from "pg";
import { scriptLocale } from "./lib/locale";

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  /* 不传 --locale 就查全表 —— 跨站盘点时要的是总数。自检那边传的是本站的 locale。 */
  const onlyLocale = process.argv.includes("--locale") ? scriptLocale() : null;

  const { rows: counted } = await client.query<{ dead: number; total: number }>(
    `select count_dead_redirects($1) as dead,
            (select count(*)::integer from cms_redirects where $1 is null or locale = $1) as total`,
    [onlyLocale]
  );
  const { dead, total } = counted[0];

  if (dead === 0) {
    console.log(`\n✓ ${total} 条重定向${onlyLocale ? `（${onlyLocale}）` : ""}，目标全部指向现有内容。\n`);
    await client.end();
    return;
  }

  const { rows: listed } = await client.query<{ legacy_url: string; destination_url: string }>(
    `select * from list_dead_redirects(40, $1)`, [onlyLocale]
  );
  console.log(`\n✗ ${total} 条重定向里有 ${dead} 条指向不存在的地址：\n`);
  for (const row of listed) console.log(`  ${row.legacy_url}\n      → ${row.destination_url}`);
  if (dead > listed.length) console.log(`\n  …另外 ${dead - listed.length} 条`);
  console.log(
    "\n先分清是「内容搬了」还是「内容没了」：\n" +
      "  搬了（改名）     npx tsx scripts/repoint-stale-destinations.ts\n" +
      "  换了形态（文章改视频）  npx tsx scripts/repoint-series-redirects.ts\n" +
      "  真的没了         npx tsx scripts/retire-dead-redirects.ts\n" +
      "三个都默认预演，加 --apply 才动库。\n"
  );

  await client.end();
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
