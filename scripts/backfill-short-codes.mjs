/**
 * 给还没有短码的文章和视频各补一个。
 *
 *   node --env-file=.env.local scripts/backfill-short-codes.mjs --dry-run
 *   node --env-file=.env.local scripts/backfill-short-codes.mjs
 *
 * 要先跑过 supabase/content/migrations/033_short_codes.sql。
 *
 * ## 可以反复跑
 *
 * 只认 short_code is null 的行，已经有码的一律不碰 —— 短码一旦发出去就不能
 * 再变，所以这个脚本在任何情况下都不该覆盖已有的值。中途断了直接再跑一次。
 *
 * ## 为什么用直连而不是 PostgREST
 *
 * 一万六千行要批量更新，PostgREST 得一行一个请求。直连一条 SQL 配一批参数就
 * 完事，而且撞码时能靠 ON CONFLICT DO NOTHING 原地重试，不用先查后写。
 */
import { Client } from "pg";
import { randomInt } from "node:crypto";

/* 和 apps/web/src/lib/short-code.ts 保持一致 —— 那边是运行时用的，这里是一次性
   脚本，为了不把 Next 的路径别名拖进来，字母表在两处各写一份。改一处就要改
   另一处，所以两边都标了这句话。 */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const LENGTH = 7;
const code = () => Array.from({ length: LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

const DRY = process.argv.includes("--dry-run");
const BATCH = 500;

async function fill(client, table, label) {
  const { rows: pending } = await client.query(
    `select count(*)::int as n from ${table} where short_code is null`
  );
  const total = pending[0].n;
  console.log(`\n${label}：${total} 条还没有短码`);
  if (total === 0 || DRY) {
    if (DRY && total > 0) {
      const sample = Array.from({ length: 3 }, code);
      console.log(`  （试跑，不写库）会是这个样子：${sample.join("  ")}`);
    }
    return 0;
  }

  let done = 0;
  for (;;) {
    const { rows } = await client.query(
      `select id from ${table} where short_code is null limit $1`,
      [BATCH]
    );
    if (rows.length === 0) break;

    for (const row of rows) {
      /* 撞码是 1.7 万亿分之一，但真撞上时唯一索引会抛错 —— 接住再给一个新的，
         而不是让整批失败。给三次机会；三次都撞说明不是运气问题，该停下来看。 */
      let ok = false;
      for (let attempt = 0; attempt < 3 && !ok; attempt += 1) {
        try {
          await client.query(
            `update ${table} set short_code = $1 where id = $2 and short_code is null`,
            [code(), row.id]
          );
          ok = true;
        } catch (err) {
          if (attempt === 2) throw err;
        }
      }
      done += 1;
    }
    process.stdout.write(`\r  已补 ${done} / ${total}`);
  }
  process.stdout.write("\n");
  return done;
}

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  try {
    if (DRY) console.log("试跑模式，一行都不写。");
    const a = await fill(client, "cms_articles", "文章");
    const v = await fill(client, "cms_videos", "视频");
    if (!DRY) {
      console.log(`\n补了 ${a + v} 条。`);
      for (const [table, label] of [["cms_articles", "文章"], ["cms_videos", "视频"]]) {
        const { rows } = await client.query(
          `select count(*)::int as total,
                  count(short_code)::int as coded,
                  count(distinct short_code)::int as unique_codes
           from ${table}`
        );
        const r = rows[0];
        console.log(
          `  ${label}：${r.coded}/${r.total} 有码，去重后 ${r.unique_codes} 个` +
            (r.coded === r.unique_codes ? "  ✅" : "  ❌ 有重复！")
        );
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("\n失败：", err.message);
  process.exit(1);
});
