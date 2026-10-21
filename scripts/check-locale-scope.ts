/**
 * 查出没有按语言限定的数据库查询。
 *
 * 四个语言站共用一个数据库，靠 locale 列分内容。一条忘了加 `.eq("locale", …)`
 * 的查询不会报错 —— 它只是把别的站的内容也取回来，或者把别的站的行改掉。中文站
 * 的文章出现在德文站的列表上、德文编辑改名顺手删掉中文站的跳转，都是这么来的。
 *
 * ## 为什么是检查器，不是自动注入的包装层
 *
 * 包装层（`.from()` 自动加过滤）听起来更省事，但它会悄悄改变 153 处现有调用的
 * 行为，而其中大部分服务的是唯一一个有真实读者的站。显式的 `.eq("locale", …)`
 * 看得见、好查、出错时堆栈指向真正的那一行；而「忘不掉」这件事由这个检查器保证，
 * 不由运行时的魔法保证。
 *
 * ## 判定
 *
 * 一条查询通过，当它满足任意一条：
 *
 *   - 语句里出现了 locale
 *   - 按 id 过滤（id 全局唯一，不会跨站撞）
 *   - 紧挨着写了 `/* locale-ok: 理由 *&#47;`
 *
 * 第三条是**有意留的出口**：确实有该跨语言的查询 —— 媒体库是共享的，跨语言对账
 * 本来就要看所有语言。与其在这个脚本里维护一张例外清单（改代码的人看不到），
 * 不如要求在那一行旁边写明理由（改代码的人一定看得到）。
 *
 *     npm run locale:check
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import pg from "pg";

/**
 * 带 locale 列、因而必须按站限定的表。
 *
 * 这张表现在**问数据库**，不靠这份清单。原来的注释写的是「加表时要在这里登记
 * —— 这道摩擦是有意的」，而那道摩擦没拦住任何事：037 给 cms_audit_logs 加了
 * locale 列，清单没人更新，于是检查器从来没看过审计日志那五处调用，报的却是
 * 「全部已限定」。手写的清单必然落后于 schema，而落后的那一刻它就开始骗人。
 *
 * 下面这份留作两个用途：
 *   1. 连不上数据库时（比如 CI 没有密钥）的兜底，会明说自己在兜底
 *   2. 和数据库对一遍 —— 不一致本身就是一条要报出来的事
 */
const KNOWN_LOCALE_TABLES = new Set([
  "cms_articles",
  "cms_videos",
  "cms_materials",
  "cms_faqs",
  "cms_pages",
  "cms_content_entries",
  "cms_redirects",
  "cms_article_categories",
  "cms_video_categories",
  "cms_material_categories",
  "cms_faq_categories",
  "cms_article_tags",
  "cms_site_settings",
  "cms_log_hourly",
  "cms_search_misses",
  /* 037 加的，当时没补进这份清单 —— 于是审计日志那五处调用从来没被看过。
     现在清单问数据库，这几行只是兜底用。 */
  "cms_audit_logs",
  "cms_content_revisions"
]);

/** 实际用哪张清单，由 main() 决定 —— 能连上数据库就用数据库的。 */
let LOCALE_TABLES = new Set(KNOWN_LOCALE_TABLES);

/**
 * 数据库里哪些 cms_ 表有 locale 列。
 *
 * 连不上就返回 null，由调用方决定怎么说。宁可明说「这次是按清单查的」，
 * 也不要让人以为查的是真的 schema。
 */
async function tablesWithLocaleColumn(): Promise<Set<string> | null> {
  if (!process.env.DATABASE_URL) return null;
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    /* Supabase 的连接串走 TLS，但证书链在本地不一定装着。 */
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    const { rows } = await client.query<{ table_name: string }>(
      `select table_name
         from information_schema.columns
        where table_schema = 'public'
          and table_name like 'cms_%'
          /* 只认 locale。cms_media_assets 的 uploaded_locale 是「谁上传的」
             这条元信息，不是分区键 —— 媒体库按设计是四个站共享的（一个 R2
             桶），把它算进来会凭空报出六处假问题。 */
          and column_name = 'locale'
        order by table_name`
    );
    return new Set(rows.map((r) => r.table_name));
  } catch {
    return null;
  } finally {
    await client.end().catch(() => {});
  }
}

const ROOTS = ["apps/web/src"];
const FROM = /\.from\(\s*["'`](cms_[a-z_]+)["'`]\s*\)/;

/**
 * `.from(someVariable)` —— 表名不是字面量，这个检查器看不出查的是哪张表。
 *
 * 不是假想的情况：搜索索引的同步就是 `.from(source.table)` 在三张表上循环，
 * 其中视频那一张**没有**按语言限定，而这里报的是「全都限定了」。一个说
 * 「全绿」却根本没看见那行代码的检查器，比没有检查器更坏 —— 它让人不再去看。
 *
 * 所以看不见的就说看不见，单列一栏让人自己过一遍。确认过的用
 * `locale-ok: 原因` 标掉，和其他出口一样。
 */
const DYNAMIC_FROM = /\.from\(\s*([A-Za-z_$][\w.$]*)\s*\)/;

/**
 * 文件里 `const TABLE = "cms_faqs"` 这样的常量。
 *
 * `.from(TABLE)` 本来落进「看不见」那一栏，而常量的值就在同一个文件里写着 ——
 * 解析它只要一行正则。不解析的代价是实打实的：常见问答那个文件有十四处
 * `.from(TABLE)` / `.from(CATEGORY_TABLE)`，一处 locale 都没加，而检查器
 * 一条也没报。
 *
 * 只认同文件里的字面量常量。再往下（跨文件、对象属性、运行时拼出来的表名）
 * 就要写一个真正的解析器了，那些继续留在「看不见」那一栏里由人过。
 */
function constantTables(src: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /(?:const|let|var)\s+([A-Z_][A-Z0-9_]*)\s*=\s*["'`](cms_[a-z_]+)["'`]/g;
  for (let m = re.exec(src); m; m = re.exec(src)) out.set(m[1], m[2]);
  return out;
}

/* 「这条语句里有查询动作」—— 光看 .from( 分不出 Buffer.from。 */
const QUERY_VERB = /\.(select|insert|upsert|update|delete)\(/;

/*
 * JS 内置对象的 .from()。
 *
 * 只靠 QUERY_VERB 还不够：`createHmac("sha1", Buffer.from(secret)).update(...)`
 * 里有 .update(，于是 Buffer.from 被当成了一条查询。这里是一张黑名单，但是
 * **封闭的**那种 —— 内置对象的集合不会因为我们加了一张表就变长，和表名清单
 * 不是一回事。
 */
const BUILTIN_FROM = /\b(?:Buffer|Array|Object|Set|Map|String|Number|Promise|Uint8Array|Int8Array|Float32Array|Float64Array)\.from\(/;

interface Finding {
  file: string;
  line: number;
  table: string;
  snippet: string;
}

interface Unseen {
  file: string;
  line: number;
  expression: string;
  snippet: string;
}

const unseen: Unseen[] = [];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".ts") || full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/**
 * 一条查询链的范围。
 *
 * 从 `.from(...)` 那一行起，到第一个以分号结尾的行为止 —— Supabase 的链式调用
 * 总是这个形状。上限 20 行，免得一个没有分号的怪写法把整个文件吞进来。
 */
function statementAt(lines: string[], start: number): string {
  const parts: string[] = [];
  for (let i = start; i < Math.min(start + 20, lines.length); i += 1) {
    parts.push(lines[i]);
    if (lines[i].trimEnd().endsWith(";")) break;
  }
  return parts.join("\n");
}

/**
 * 写入的 payload 里带没带 locale。
 *
 * `.insert(row)` 这种写法，locale 不在这条语句里，而在上面构造 `row` 的地方。
 * 只看语句本身会把一堆其实正确的写入报成问题，而一个总在误报的检查器，很快就会
 * 被人用出口注释一个个按掉 —— 那时它就只剩形式了。
 *
 * 所以顺着变量名回查它的声明，在声明体里找 locale。只跟一层：再深就要写一个
 * 真正的解析器，而这是个几十行的检查脚本，不是编译器。跟不动的少数情况用
 * `locale-ok` 注明，那本来就是留给需要人解释的场合。
 */
function payloadHasLocale(lines: string[], stmt: string): boolean {
  const m = /\.(insert|upsert)\(\s*([A-Za-z_$][\w$]*)\s*[,)]/.exec(stmt);
  if (!m) return false;
  const name = m[2];
  const decl = new RegExp(`(const|let|var)\\s+${name}\\b`);
  for (let i = 0; i < lines.length; i += 1) {
    if (!decl.test(lines[i])) continue;
    /* 声明体往下 30 行 —— 这些 payload 对象通常十几到二十几行。 */
    const body = lines.slice(i, i + 30).join("\n");
    if (/locale/.test(body)) return true;
  }
  return false;
}

function check(): Finding[] {
  const findings: Finding[] = [];
  for (const root of ROOTS) {
    for (const file of walk(root)) {
      const src = readFileSync(file, "utf8");
      const lines = src.split("\n");
      const constants = constantTables(src);
      for (let i = 0; i < lines.length; i += 1) {
        const m = FROM.exec(lines[i]);
        let table: string | null = m ? m[1] : null;
        if (!m) {
          const dyn = DYNAMIC_FROM.exec(lines[i]);
          /* 先看能不能解析成同文件里的常量。 */
          const resolved = dyn ? constants.get(dyn[1]) : undefined;
          if (resolved) table = resolved;
          else if (dyn && !BUILTIN_FROM.test(lines[i]) && QUERY_VERB.test(statementAt(lines, i))) {
            const near = [lines[i - 4] ?? "", lines[i - 3] ?? "", lines[i - 2] ?? "",
                          lines[i - 1] ?? "", lines[i], lines[i + 1] ?? ""].join("\n");
            if (!/locale-ok\s*:/.test(near)) {
              unseen.push({
                file: file.replace(/^apps\/web\/src\//, ""),
                line: i + 1,
                expression: dyn[1],
                snippet: lines[i].trim()
              });
            }
          }
          if (!table) continue;
        }
        if (!LOCALE_TABLES.has(table)) continue;

        const stmt = statementAt(lines, i);

        /*
         * 出口：往上找四行，往下找一行。
         *
         * 四行而不是一行，是因为跨多行的三元表达式 —— 注释自然写在整个表达式上方，
         * 而 `.from(` 可能在它下面好几行。只看紧挨着的一行，等于逼人把解释写到
         * 一个读起来不通顺的位置上。
         */
        const near = [lines[i - 4] ?? "", lines[i - 3] ?? "", lines[i - 2] ?? "", lines[i - 1] ?? "", lines[i], lines[i + 1] ?? ""].join("\n");
        if (/locale-ok\s*:/.test(near)) continue;

        if (/locale/.test(stmt)) continue;
        if (payloadHasLocale(lines, stmt)) continue;
        /* 按 id 查：id 是 uuid，全局唯一，跨站不会撞。 */
        if (/\.eq\(\s*["'`]id["'`]/.test(stmt)) continue;
        /* 关联表的外键同理。 */
        if (/\.eq\(\s*["'`][a-z_]+_id["'`]/.test(stmt)) continue;

        findings.push({
          file: file.replace(/^apps\/web\/src\//, ""),
          line: i + 1,
          table,
          snippet: lines[i].trim().slice(0, 72)
        });
      }
    }
  }
  return findings;
}

/** 看不见的那些，单独报 —— 它们不算失败，但不能不说。 */
function reportUnseen() {
  if (unseen.length === 0) return;
  console.log(`\n？ 另有 ${unseen.length} 处 .from() 的表名不是字面量，这个检查器看不出查的是哪张表：\n`);
  for (const u of unseen) {
    console.log(`  ${u.file}:${u.line}  .from(${u.expression})`);
    console.log(`      ${u.snippet.slice(0, 120)}`);
  }
  console.log(`\n  自己过一遍。确认没问题的加一行 /* locale-ok: 原因 */ 标掉。\n`);
}

async function main() {
  const fromDb = await tablesWithLocaleColumn();
  if (fromDb) {
    LOCALE_TABLES = fromDb;
    const added = [...fromDb].filter((t) => !KNOWN_LOCALE_TABLES.has(t));
    const gone = [...KNOWN_LOCALE_TABLES].filter((t) => !fromDb.has(t));
    if (added.length > 0 || gone.length > 0) {
      console.log(`\n！ 代码里那份清单和数据库对不上 —— 这次按数据库查：`);
      if (added.length > 0) console.log(`    数据库里有、清单里没有：${added.join("、")}`);
      if (gone.length > 0) console.log(`    清单里有、数据库里没有：${gone.join("、")}`);
      console.log(`    把 KNOWN_LOCALE_TABLES 补齐，它是连不上数据库时的兜底。`);
    }
  } else {
    console.log(`\n！ 连不上数据库（没有 DATABASE_URL 或连接失败），这次按代码里那份清单查。`);
    console.log(`    清单可能比 schema 旧 —— 真要确认请带上 DATABASE_URL 再跑一次。`);
  }

  const findings = check();

  if (findings.length === 0) {
    console.log(`\n✓ 针对 ${LOCALE_TABLES.size} 张带 locale 的表的查询，按字面量表名能看到的都已限定。`);
    reportUnseen();
    if (unseen.length === 0) console.log("");
    return 0;
  }

  const byFile = new Map<string, Finding[]>();
  for (const f of findings) {
    if (!byFile.has(f.file)) byFile.set(f.file, []);
    byFile.get(f.file)!.push(f);
  }

  reportUnseen();
  console.log(`\n✗ 有 ${findings.length} 处查询没有按语言限定：\n`);
  for (const [file, items] of [...byFile].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${file}  （${items.length} 处）`);
    for (const f of items) console.log(`      ${String(f.line).padStart(5)}  ${f.table.padEnd(24)} ${f.snippet}`);
    console.log("");
  }
  console.log(
    "每一处要么加上 .eq(\"locale\", SITE_LOCALE)，要么在旁边写 /* locale-ok: 理由 */ 说明\n" +
      "它为什么该跨语言。后者是给媒体库、跨语言对账这类确实要看所有语言的查询留的。\n"
  );
  return 1;
}

main().then((code) => process.exit(code));
