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
 *
 * ## 改完之后，前台不会立刻跟上
 *
 * 文章页 `revalidate = 300`。库里改完的那一刻，CDN 还会按老样子再服务最多五
 * 分钟 —— 旧地址继续返回缓存里的 200（而不是跳转），回退之后拼音地址也会继续
 * 返回 200（而不是 404）。这是实测过的，不是推测。
 *
 * 所以：改完立刻去前台看，看到的可能是旧的，不代表没生效 —— 先看库。真要让
 * 前台立刻跟上，用后台 Dashboard 的「强制刷新全站缓存」。
 *
 * ## 跳数
 *
 * 老 WP 地址到新地址实测 2 跳。查过对照组：没改过的文章也是 2 跳，多出来的
 * 那一跳是末尾斜杠归一化，站上原来就有，不是改名带来的。换句话说第 3 步确实
 * 起作用了 —— 它没有给链条添新的一跳。
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
/**
 * 只替换「完整的一段路径」，不是裸子串。
 *
 * 第一版是 `text.split(from).join(to)`。站上有一篇文章的旧 slug 就是单个字符
 * `2`，于是 `/news/2` 这个替换键命中了正文里每一条外部链接：
 *
 *   http://www.bloomberg.com/news/2011-11-01/china-says-no-talking-tibet
 *                               ↑ 这里的 /news/2 被换成了整条拼音地址
 *
 * 实际改坏了 13 行，而且因为新地址本身以 `2` 开头、又被下一轮再次命中，嵌套了
 * 四层。已经逐行还原。
 *
 * 所以：命中之后还要看紧跟着的那个字符。地址在文本里总是以边界收尾 —— 引号、
 * 空白、右括号、标点、或者就是结尾。后面若是字母、数字、连字符，说明这只是
 * 另一条更长地址的前缀，不能动。
 */
function replacePath(text: string, from: string, to: string): string {
  let out = "";
  let i = 0;
  for (;;) {
    const at = text.indexOf(from, i);
    if (at === -1) return out + text.slice(i);
    const after = text[at + from.length];
    const isBoundary = after === undefined || !/[A-Za-z0-9\-_%.]/.test(after);
    out += text.slice(i, at) + (isBoundary ? to : from);
    i = at + from.length;
  }
}

async function fixLinks(client: pg.Client, _changes: Change[], undo = false) {
  /* 列名写错过一次：FAQ 的正文列叫 answer_markdown，不是 answer。下面那个
     `catch { continue }` 把「列不存在」当成「这张表没这一列，跳过」静静吞掉，
     于是那张表整个没被处理，而输出上看不出任何异常。所以现在先验列名存在，
     不存在就报出来。 */
  const targets: [string, string][] = [
    ["cms_articles", "body_markdown"],
    ["cms_videos", "body_markdown"],
    ["cms_content_entries", "data"],
    ["cms_faqs", "answer_markdown"]
  ];

  for (const [table, column] of targets) {
    const r = await client.query(
      `select count(*)::int n from information_schema.columns where table_name = $1 and column_name = $2`,
      [table, column]
    );
    if (r.rows[0].n === 0) throw new Error(`${table} 没有 ${column} 这一列 —— 列名写错了，不是「这张表不需要处理」`);
  }

  /*
   * 替换对来自库里的 slug_legacy → slug，不是来自重算的计划。
   *
   * 第一版拿计划里的 `slug → next` 构造，结果是「将改 0 行」：改名跑完之后，
   * 库里读出来的 slug 已经是新地址，重算的 next 还是它自己，from 和 to 相等，
   * 什么都匹配不上 —— 一个只会安静地什么都不做的 bug。真跑一遍才看出来。
   *
   * slug_legacy 记录的是真实发生过的事，比任何重算都可靠。
   */
  const pairs: (readonly [string, string])[] = [];
  for (const kind of ["article", "video"] as const) {
    const r = await client.query(
      `select slug, slug_legacy from ${TABLE[kind]} where slug_legacy is not null and slug <> slug_legacy`
    );
    for (const row of r.rows as { slug: string; slug_legacy: string }[]) {
      const from = publicPath(kind, row.slug_legacy);
      const to = publicPath(kind, row.slug);
      pairs.push(undo ? ([to, from] as const) : ([from, to] as const));
    }
  }
  if (!APPLY) console.log(`  （共 ${pairs.length} 组替换对）`);

  let touched = 0;
  for (const [table, column] of targets) {
    const rows = (
      await client.query(
        `select id::text, ${column}::text as text from ${table} where ${column}::text ~ '/(news|videos)/'`
      )
    ).rows as { id: string; text: string }[];

    for (const row of rows) {
      let next = row.text;
      for (const [from, to] of pairs) {
        if (!next.includes(from) && !next.includes(encodeURI(from))) continue;
        next = replacePath(next, from, to);
        const enc = encodeURI(from);
        if (enc !== from) next = replacePath(next, enc, encodeURI(to));
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
          /*
           * 反方向补一条「新拼音地址 → 旧地址」。这一条不是多余的 ——
           * 没有它，回退会在生产上造成真实的 404，这是实测出来的。
           *
           * 中间件处理老 WP 地址用的是自己的缓存：一个没有 TTL 的进程内 Map，
           * 外加 `next: { revalidate: 3600 }`。那里的注释写着「跳转目的地只有
           * 重跑迁移时才会变」—— 这次改名正是那个情况。于是回退之后最长一小时
           * 里，中间件仍然认为「老 WP 地址 → 拼音地址」，而拼音地址已经不存在：
           *
           *     /2002/09/21/14179/  →（陈旧缓存）→  /news/2002-09-21-wu-...  →  404
           *
           * 有了这一条，那条陈旧的链接得以接上：
           *
           *     ...  →  /news/2002-09-21-wu-...  →  /news/吴弘达：改造班禅喇嘛  ✓
           *
           * 往前改名的方向不需要对称的处理 —— 那个方向上陈旧缓存指向的是旧地址，
           * 而旧地址这时已经有「旧 → 新」的跳转，自己就接上了。只有回退这一侧
           * 的链条会断。
           */
          await client.query(
            `insert into cms_redirects (legacy_url, destination_url, status_code) values ($1, $2, 308)
             on conflict (legacy_url) do update set destination_url = excluded.destination_url`,
            [now, was]
          );
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
