/**
 * 跑数据库迁移，并记住跑过哪些。
 *
 * 在这之前，supabase/*&#47;migrations 里的 SQL 是手工执行的，而且**没有任何地方
 * 记录执行到第几号**。单库时靠人记得住；多语言方案要在同一个库上继续加表，
 * 第一个问题就是「现在到底跑到哪了」—— 今天谁也答不上来，只能翻聊天记录。
 *
 * ## 三条规矩
 *
 * 1. **默认预演。** 和这个仓库里其他动库的脚本一样，`--apply` 才真跑。
 *
 * 2. **每个文件一个事务，SQL 和登记在同一个事务里。** 跑了一半失败，这个文件
 *    的改动和它的登记一起回滚 —— 不会留下「跑了但没记」或「记了但没跑」。
 *
 * 3. **已登记文件的内容变了就整体拒绝执行。** 校验和对不上意味着有人改了一个
 *    已经在生产上跑过的迁移文件。那时数据库里的实际结构和文件内容已经不一致，
 *    再跑后面的只会把两者越推越远。这种情况必须人来判断，不能让脚本猜。
 *
 * ## 两套迁移在同一个库
 *
 * content（内容后台）和 service（三退声明与证书）各有各的编号，都从 001 开始，
 * 所以登记表的主键是 (suite, filename)，不是 filename。
 *
 *     npx tsx scripts/migrate.ts                 # 预演：列出待跑的
 *     npx tsx scripts/migrate.ts --apply
 *     npx tsx scripts/migrate.ts --baseline      # 见下
 *     npx tsx scripts/migrate.ts --suite content
 *
 * ## --baseline
 *
 * 第一次启用这个执行器时，生产库里 41 个迁移**早就跑过了**。直接 --apply 会把
 * 它们重跑一遍 —— 多数是 `if not exists` 幂等的，但 024、025 这类改函数和超时
 * 设置的不是，重跑有真实风险。
 *
 * `--baseline` 只登记、不执行，把现状认定为「已到最新」。它会先核对一批关键对象
 * 确实存在，不存在就拒绝 —— 否则一个空库被 baseline 之后，就再也没人会去建表了。
 */

import pg from "pg";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const APPLY = process.argv.includes("--apply");
const BASELINE = process.argv.includes("--baseline");

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

const SUITES = ["content", "service"] as const;
type Suite = (typeof SUITES)[number];

const onlySuite = arg("--suite") as Suite | null;
if (onlySuite && !SUITES.includes(onlySuite)) {
  console.error(`--suite 只能是 ${SUITES.join(" 或 ")}`);
  process.exit(1);
}

/*
 * baseline 之前要确认这个库确实已经建好了。清单里是各个迁移建出来的、缺了就说明
 * 这个库根本没跑过迁移的东西 —— 表、函数、以及后来才加的列。
 */
const EXPECTED_OBJECTS: { kind: "table" | "function" | "column"; name: string; column?: string }[] = [
  { kind: "table", name: "cms_articles" },
  { kind: "table", name: "cms_videos" },
  { kind: "table", name: "cms_materials" },       // 017
  { kind: "table", name: "cms_faqs" },            // 023
  { kind: "table", name: "cms_search_misses" },   // 022
  { kind: "table", name: "cms_log_hourly" },      // 027
  { kind: "table", name: "cms_content_entries" }, // 008
  { kind: "table", name: "declarations" },        // service 001
  { kind: "function", name: "search_articles_trgm" },
  { kind: "function", name: "set_article_categories" },      // 024
  { kind: "function", name: "count_dead_redirects" },        // 035
  { kind: "function", name: "content_inbound_links" },       // 036
  { kind: "column", name: "cms_articles", column: "short_code" },  // 033
  { kind: "column", name: "cms_articles", column: "slug_legacy" }  // 034
];

interface Found {
  suite: Suite;
  filename: string;
  sql: string;
  checksum: string;
}

function readMigrations(): Found[] {
  const out: Found[] = [];
  for (const suite of SUITES) {
    if (onlySuite && suite !== onlySuite) continue;
    const dir = path.join("supabase", suite, "migrations");
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      /* 按文件名排序即按编号排序，因为编号是零填充的三位数。哪天到了 1000，
         这里要改成按数字排 —— 届时 "1000_" 会排在 "999_" 前面。 */
      .sort();
    for (const filename of files) {
      const sql = readFileSync(path.join(dir, filename), "utf8");
      out.push({ suite, filename, sql, checksum: createHash("sha256").update(sql).digest("hex") });
    }
  }
  return out;
}

async function ensureTable(client: pg.Client): Promise<void> {
  /* 登记表自己不能由迁移文件来建 —— 那是先有鸡还是先有蛋。它由执行器保证存在，
     并且这段必须是幂等的。 */
  await client.query(`
    create table if not exists schema_migrations (
      suite       text        not null,
      filename    text        not null,
      checksum    text        not null,
      applied_at  timestamptz not null default now(),
      applied_by  text,
      primary key (suite, filename)
    )
  `);
}

async function checkExpectedObjects(client: pg.Client): Promise<string[]> {
  const missing: string[] = [];
  for (const o of EXPECTED_OBJECTS) {
    if (o.kind === "table") {
      const { rows } = await client.query(
        `select 1 from information_schema.tables where table_schema='public' and table_name=$1`,
        [o.name]
      );
      if (!rows.length) missing.push(`表 ${o.name}`);
    } else if (o.kind === "function") {
      const { rows } = await client.query(
        `select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
          where n.nspname='public' and p.proname=$1`,
        [o.name]
      );
      if (!rows.length) missing.push(`函数 ${o.name}()`);
    } else {
      const { rows } = await client.query(
        `select 1 from information_schema.columns
          where table_schema='public' and table_name=$1 and column_name=$2`,
        [o.name, o.column]
      );
      if (!rows.length) missing.push(`列 ${o.name}.${o.column}`);
    }
  }
  return missing;
}

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  await ensureTable(client);

  const found = readMigrations();
  const { rows: recorded } = await client.query<{ suite: Suite; filename: string; checksum: string }>(
    `select suite, filename, checksum from schema_migrations`
  );
  const byKey = new Map(recorded.map((r) => [`${r.suite}/${r.filename}`, r]));

  /* 先查篡改，在跑任何东西之前。 */
  const tampered = found.filter((f) => {
    const r = byKey.get(`${f.suite}/${f.filename}`);
    return r && r.checksum !== f.checksum;
  });
  if (tampered.length) {
    console.error(`\n✗ 有 ${tampered.length} 个已跑过的迁移文件内容被改过，整体拒绝执行：\n`);
    for (const t of tampered) console.error(`    ${t.suite}/${t.filename}`);
    console.error(
      "\n数据库里的实际结构是按改动前的内容建的，和现在的文件已经不一致。\n" +
        "要改已经上线的迁移，正确做法是新写一个迁移文件去修正，而不是改旧的。\n" +
        "如果这次改动确实只是注释或排版，手工更新 schema_migrations 里的 checksum。\n"
    );
    await client.end();
    process.exit(1);
  }

  const pending = found.filter((f) => !byKey.has(`${f.suite}/${f.filename}`));

  const say = (s: string) => console.log(s);
  say(`\n迁移文件 ${found.length} 个，已登记 ${found.length - pending.length} 个，待跑 ${pending.length} 个`);
  for (const s of SUITES) {
    if (onlySuite && s !== onlySuite) continue;
    const all = found.filter((f) => f.suite === s);
    const left = pending.filter((f) => f.suite === s);
    const last = all[all.length - 1]?.filename.slice(0, 3) ?? "—";
    say(`  ${s.padEnd(8)} 共 ${String(all.length).padStart(2)} 个，最高号 ${last}，待跑 ${left.length}`);
  }

  if (!pending.length) {
    say("\n✓ 已是最新，无事可做。\n");
    await client.end();
    return;
  }

  say("\n待跑：");
  for (const p of pending) say(`  ${p.suite}/${p.filename}`);

  if (BASELINE) {
    const missing = await checkExpectedObjects(client);
    if (missing.length) {
      console.error(
        `\n✗ 拒绝 baseline：这个库里缺 ${missing.length} 样东西，说明迁移并没有真的跑过。\n`
      );
      for (const m of missing) console.error(`    缺 ${m}`);
      console.error("\n空库或新库请用 --apply 正常执行，不要 baseline。\n");
      await client.end();
      process.exit(1);
    }
    say(`\n核对通过：${EXPECTED_OBJECTS.length} 样关键对象都在，这个库确实已经建好了。`);

    if (!APPLY) {
      say("\n（预演。加上 --apply 才会把这些登记为「已跑」—— 注意 baseline 不执行 SQL。）\n");
      await client.end();
      return;
    }
    await client.query("begin");
    for (const p of pending) {
      await client.query(
        `insert into schema_migrations (suite, filename, checksum, applied_by)
         values ($1, $2, $3, $4)`,
        [p.suite, p.filename, p.checksum, "baseline"]
      );
    }
    await client.query("commit");
    say(`\n✓ 已把 ${pending.length} 个迁移登记为「已跑」（没有执行任何 SQL）。\n`);
    await client.end();
    return;
  }

  if (!APPLY) {
    say("\n（预演，没有执行任何 SQL。加 --apply 才真跑。）\n");
    await client.end();
    return;
  }

  say("");
  for (const p of pending) {
    process.stdout.write(`  跑 ${p.suite}/${p.filename} … `);
    /* SQL 和登记在同一个事务里：跑了一半失败，两边一起回滚。 */
    await client.query("begin");
    try {
      await client.query(p.sql);
      await client.query(
        `insert into schema_migrations (suite, filename, checksum, applied_by)
         values ($1, $2, $3, $4)`,
        [p.suite, p.filename, p.checksum, process.env.USER ?? "unknown"]
      );
      await client.query("commit");
      console.log("✓");
    } catch (error) {
      await client.query("rollback");
      console.log("✗");
      console.error(`\n${p.suite}/${p.filename} 失败，已回滚：`);
      console.error(error instanceof Error ? error.message : error);
      console.error("\n它之前的迁移已经跑完并登记，修好之后再跑一次即可从这里继续。\n");
      await client.end();
      process.exit(1);
    }
  }
  say(`\n✓ 跑完 ${pending.length} 个。\n`);
  await client.end();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
