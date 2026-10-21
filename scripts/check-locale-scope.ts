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

/** 带 locale 列、因而必须按站限定的表。加表时要在这里登记 —— 这道摩擦是有意的。 */
const LOCALE_TABLES = new Set([
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
  "cms_search_misses"
]);

const ROOTS = ["apps/web/src"];
const FROM = /\.from\(\s*["'`](cms_[a-z_]+)["'`]\s*\)/;

interface Finding {
  file: string;
  line: number;
  table: string;
  snippet: string;
}

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

function check(): Finding[] {
  const findings: Finding[] = [];
  for (const root of ROOTS) {
    for (const file of walk(root)) {
      const lines = readFileSync(file, "utf8").split("\n");
      for (let i = 0; i < lines.length; i += 1) {
        const m = FROM.exec(lines[i]);
        if (!m) continue;
        const table = m[1];
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

const findings = check();
if (findings.length === 0) {
  console.log("\n✓ 所有针对带 locale 的表的查询都已按站限定。\n");
  process.exit(0);
}

const byFile = new Map<string, Finding[]>();
for (const f of findings) {
  if (!byFile.has(f.file)) byFile.set(f.file, []);
  byFile.get(f.file)!.push(f);
}

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
process.exit(1);
