/**
 * 全站地址改拼音 —— 真正动手的那个脚本。
 *
 * 默认是预演：打印将要执行的每一条语句，一个字也不写。加 `--apply` 才写。
 *
 *     npx tsx scripts/pinyin-slug-migrate.ts                 # 预演全量
 *     npx tsx scripts/pinyin-slug-migrate.ts --limit 20      # 预演前 20 条
 *     npx tsx scripts/pinyin-slug-migrate.ts --limit 20 --apply
 *     npx tsx scripts/pinyin-slug-migrate.ts --apply         # 全量
 *     npx tsx scripts/pinyin-slug-migrate.ts --links --apply # 顺带改正文里的站内链接
 *     npx tsx scripts/pinyin-slug-migrate.ts --rollback --apply
 *
 * ## 每改一条，要动四处
 *
 * 1. `slug` 换成新地址，`slug_legacy` 记下旧的（只为回退）
 * 2. 删掉任何 `legacy_url` 正好等于新地址的跳转 —— 否则新地址一上线就被一条
 *    陈年跳转劫走，读者永远到不了
 * 3. 把指向旧地址的跳转改为指向新地址 —— 这一步最容易漏。站上有 15,573 条
 *    跳转，它们的目的地是旧的中文地址；不改，就变成「老 WP 地址 → 旧中文地址
 *    → 新拼音地址」的跳转链，每多一跳掉一点权重，搜索引擎也只跟有限几跳
 * 4. 插一条「旧地址 → 新地址」的跳转，这是老链接继续可用的唯一依靠
 *
 * 顺序不能换：第 2 步必须在第 4 步之前，否则刚插的那条又被删掉。
 *
 * 这四步和后台改 slug 时 `lib/slug-redirects.ts` 做的是同一件事。那边是
 * Supabase 客户端并且吞掉错误（编辑保存文章不该因为写不了跳转而失败）；跑批
 * 不能吞错误，所以这里用原生 SQL 重写一遍，并且整批放在一个事务里。
 */

import pg from "pg";
import { writeFileSync } from "node:fs";
import { buildPlan, fetchRows, publicPath, TABLE, type Change, type Kind } from "./lib/pinyin-slug-plan";

const BATCH = 200;

function has(flag: string): boolean {
  return process.argv.includes(flag);
}
function val(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

const APPLY = has("--apply");
const ROLLBACK = has("--rollback");
const LINKS = has("--links");
const LIMIT = val("--limit") ? Number(val("--limit")) : null;
const ONLY = val("--kind") as Kind | null;

async function ensureColumn(client: pg.Client): Promise<boolean> {
  const r = await client.query(
    `select count(*)::int as n from information_schema.columns
     where table_name in ('cms_articles','cms_videos') and column_name = 'slug_legacy'`
  );
  return r.rows[0].n === 2;
}

/* ---------------------------------------------------------------- 改名 */

async function migrate(client: pg.Client, changes: Change[]) {
  let done = 0;
  for (let i = 0; i < changes.length; i += BATCH) {
    const batch = changes.slice(i, i + BATCH);
    if (APPLY) await client.query("begin");
    try {
      for (const c of batch) {
        const from = publicPath(c.kind, c.slug);
        const to = publicPath(c.kind, c.next);
        const table = TABLE[c.kind];

        const steps: [string, unknown[]][] = [
          [
            `update ${table} set slug = $1, slug_legacy = coalesce(slug_legacy, $2) where id = $3`,
            [c.next, c.slug, c.id]
          ],
          /* 2 —— 有人用新地址做过跳转的话，先让开 */
          [`delete from cms_redirects where legacy_url = $1`, [to]],
          /* 3 —— 把指向旧地址的跳转一起带过去，不留跳转链 */
          [`update cms_redirects set destination_url = $1 where destination_url = $2`, [to, from]],
          /* 4 —— 老地址继续可用 */
          [
            `insert into cms_redirects (legacy_url, destination_url, status_code) values ($1, $2, 308)
             on conflict (legacy_url) do update set destination_url = excluded.destination_url, status_code = 308`,
            [from, to]
          ]
        ];

        if (APPLY) {
          for (const [sql, args] of steps) await client.query(sql, args);
        } else if (done < 3) {
          console.log(`\n  《${c.title}》`);
          console.log(`    ${from}`);
          console.log(`    ${to}`);
          for (const [sql] of steps) console.log(`      ${sql.replace(/\s+/g, " ").slice(0, 96)}…`);
        }
        done += 1;
      }
      if (APPLY) await client.query("commit");
    } catch (error) {
      if (APPLY) await client.query("rollback");
      throw new Error(`第 ${i + 1}–${i + batch.length} 条这一批失败，已整批回滚：${String(error)}`);
    }
    if (APPLY) process.stdout.write(`\r  已改 ${done} / ${changes.length}`);
  }
  if (APPLY) console.log("");
  return done;
}

/* ------------------------------------------------------- 正文里的站内链接 */

/**
 * 正文里写死的站内链接。
 *
 * 不改也不会坏 —— 旧地址有跳转。但每点一次就多一跳，而且这些链接会一直把
 * 旧地址传播下去。全站只有 54 行含站内链接，顺手改掉。
 *
 * 要同时认两种写法：库里存的可能是原样的中文，也可能是 %E4%B8 这种编码过的。
 */
async function fixLinks(client: pg.Client, changes: Change[], undo = false) {
  const targets: [string, string][] = [
    ["cms_articles", "body_markdown"],
    ["cms_videos", "body_markdown"],
    ["cms_content_entries", "data"],
    ["cms_faqs", "answer"]
  ];

  const pairs = changes.map((c) => {
    const from = publicPath(c.kind, c.slug);
    const to = publicPath(c.kind, c.next);
    return undo ? ([to, from] as const) : ([from, to] as const);
  });

  let touched = 0;
  for (const [table, column] of targets) {
    let rows: { id: string; text: string }[];
    try {
      const r = await client.query(
        `select id::text, ${column}::text as text from ${table} where ${column}::text ~ '/(news|videos)/'`
      );
      rows = r.rows;
    } catch {
      continue; // 这张表没有这一列，跳过
    }

    for (const row of rows) {
      let next = row.text;
      for (const [from, to] of pairs) {
        if (!next.includes(from) && !next.includes(encodeURI(from))) continue;
        next = next.split(from).join(to).split(encodeURI(from)).join(encodeURI(to));
      }
      if (next === row.text) continue;
      touched += 1;
      if (APPLY) {
        await client.query(`update ${table} set ${column} = $1::jsonb where id = $2`, [next, row.id]).catch(
          async () => {
            await client.query(`update ${table} set ${column} = $1 where id = $2`, [next, row.id]);
          }
        );
      }
    }
  }
  return touched;
}

/* ---------------------------------------------------------------- 回退 */

async function rollback(client: pg.Client) {
  let total = 0;
  for (const kind of ["article", "video"] as const) {
    const table = TABLE[kind];
    const r = await client.query(
      `select id::text, slug, slug_legacy from ${table} where slug_legacy is not null and slug <> slug_legacy`
    );
    console.log(`${table}: ${r.rowCount} 条可以退回`);
    if (!APPLY) continue;

    for (let i = 0; i < r.rows.length; i += BATCH) {
      const batch = r.rows.slice(i, i + BATCH);
      await client.query("begin");
      try {
        for (const row of batch) {
          const now = publicPath(kind, row.slug);
          const was = publicPath(kind, row.slug_legacy);
          /* 我们插的那条「旧 → 新」，删掉 */
          await client.query(`delete from cms_redirects where legacy_url = $1 and destination_url = $2`, [was, now]);
          /* 被我们改成指向新地址的，改回去 */
          await client.query(`update cms_redirects set destination_url = $1 where destination_url = $2`, [was, now]);
          await client.query(`update ${table} set slug = slug_legacy, slug_legacy = null where id = $1`, [row.id]);
          total += 1;
        }
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }
  }
  return total;
}

/* ---------------------------------------------------------------- 主流程 */

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const mode = ROLLBACK ? "回退" : "改名";
  console.log(`\n========== 拼音地址 · ${mode} · ${APPLY ? "真写" : "预演（什么都不写）"} ==========\n`);

  if (!(await ensureColumn(client))) {
    console.error("缺少 slug_legacy 列。先执行 supabase/content/migrations/034_slug_legacy.sql");
    await client.end();
    process.exit(1);
  }

  if (ROLLBACK) {
    const n = await rollback(client);
    if (LINKS) {
      const rows = await fetchRows(client);
      const plan = buildPlan(rows);
      console.log(`正文站内链接改回：${await fixLinks(client, plan.changes, true)} 行`);
    }
    console.log(APPLY ? `\n已退回 ${n} 条。` : "\n（预演，什么都没写。）");
    await client.end();
    return;
  }

  const rows = await fetchRows(client);
  /* 计划永远按全量算。只改 20 条时也一样 —— 地址的唯一性是对着全站判的，
     只拿 20 条算出来的答案，下一批跑的时候就不作数了。 */
  const plan = buildPlan(rows);

  let changes = plan.changes.filter((c) => c.slug !== c.next);
  if (ONLY) changes = changes.filter((c) => c.kind === ONLY);
  if (LIMIT) changes = changes.slice(0, LIMIT);

  console.log(`全站 ${rows.length} 条，计划改 ${plan.changes.length} 条，保持原样 ${plan.skipped.length} 条`);
  for (const s of plan.skipped) console.log(`  保持原样：[${s.kind}] 《${s.title}》`);
  console.log(`这一趟处理 ${changes.length} 条${LIMIT ? `（--limit ${LIMIT}）` : ""}\n`);

  const done = await migrate(client, changes);
  if (!APPLY) console.log(`\n  …（预演只打印前 3 条的语句，共 ${done} 条）`);

  if (LINKS) {
    const n = await fixLinks(client, plan.changes);
    console.log(`\n正文与页面里的站内链接：${APPLY ? "改了" : "将改"} ${n} 行`);
  }

  const out = val("--csv");
  if (out) {
    const q = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    writeFileSync(
      out,
      ["kind,id,title,old_slug,new_slug,bump,tailed"]
        .concat(changes.map((c) => [c.kind, c.id, q(c.title), q(c.slug), q(c.next), c.bump, c.tailed ? 1 : 0].join(",")))
        .join("\n"),
      "utf8"
    );
    console.log(`对照表写入 ${out}`);
  }

  console.log(
    APPLY
      ? `\n完成。要退回：npx tsx scripts/pinyin-slug-migrate.ts --rollback --apply\n`
      : `\n（预演，一个字都没写。确认无误后加 --apply。）\n`
  );
  await client.end();
}

main().catch((error) => {
  console.error("\n" + String(error));
  process.exit(1);
});
