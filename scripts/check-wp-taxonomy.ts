/**
 * Read-only check of the old site's categories against `taxonomyMap`.
 *
 * Answers the only question that matters before re-importing: does the mapping
 * table cover every category the old site actually uses, and how many posts sit
 * in each? It writes nothing -- not to the database, not to disk.
 *
 *   npx tsx scripts/check-wp-taxonomy.ts --wxr  path/to/export.xml
 *   npx tsx scripts/check-wp-taxonomy.ts --rest https://www.tuidang.org
 *
 * The WXR route is the reliable one: WordPress → 工具 → 导出 → 所有内容 gives a
 * file that needs no network access and cannot be blocked by Cloudflare, which
 * does block automated requests to the live REST API.
 */
import { readFileSync } from "node:fs";
import { taxonomyMap } from "./migrate-wp-posts";

interface Seen {
  name: string;
  slug: string;
  posts: number;
}

function fromWxr(path: string): Seen[] {
  const xml = readFileSync(path, "utf8");
  const counts = new Map<string, Seen>();

  // Category declarations, for names of categories that hold no posts.
  for (const m of xml.matchAll(
    /<wp:category>[\s\S]*?<wp:category_nicename>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/wp:category_nicename>[\s\S]*?<wp:cat_name>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/wp:cat_name>[\s\S]*?<\/wp:category>/g
  )) {
    const slug = decodeURIComponent(m[1]);
    counts.set(slug, { slug, name: m[2], posts: 0 });
  }

  // One entry per <item>, counting only published posts.
  for (const item of xml.split("<item>").slice(1)) {
    if (!/<wp:post_type>(?:<!\[CDATA\[)?post/.test(item)) continue;
    if (!/<wp:status>(?:<!\[CDATA\[)?publish/.test(item)) continue;
    for (const c of item.matchAll(
      /<category domain="category" nicename="(.*?)">(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/category>/g
    )) {
      const slug = decodeURIComponent(c[1]);
      const row = counts.get(slug) ?? { slug, name: c[2], posts: 0 };
      row.posts += 1;
      row.name = row.name || c[2];
      counts.set(slug, row);
    }
  }
  return [...counts.values()];
}

async function fromRest(base: string): Promise<Seen[]> {
  const url = `${base.replace(/\/$/, "")}/wp-json/wp/v2/categories?per_page=100&_fields=id,slug,name,count`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  const text = await res.text();
  if (!res.ok || text.trimStart().startsWith("<")) {
    throw new Error(
      `REST returned ${res.status} and not JSON — the site is behind a bot check. Use --wxr with an export file instead.`
    );
  }
  return (JSON.parse(text) as { slug: string; name: string; count: number }[]).map((c) => ({
    slug: decodeURIComponent(c.slug),
    name: c.name,
    posts: c.count
  }));
}

async function main() {
  const [mode, arg] = process.argv.slice(2);
  if (!arg || !["--wxr", "--rest"].includes(mode)) {
    throw new Error("Usage: check-wp-taxonomy.ts --wxr <export.xml> | --rest <https://site>");
  }
  const seen = (mode === "--wxr" ? fromWxr(arg) : await fromRest(arg)).sort((a, b) => b.posts - a.posts);

  const mapped: Seen[] = [];
  const unmapped: Seen[] = [];
  for (const row of seen) {
    (taxonomyMap[row.name] || taxonomyMap[row.slug] ? mapped : unmapped).push(row);
  }

  const total = seen.reduce((n, r) => n + r.posts, 0);
  const covered = mapped.reduce((n, r) => n + r.posts, 0);

  console.log(`\n旧站分类 ${seen.length} 个，文章 ${total} 篇\n`);
  console.log("已覆盖 MAPPED");
  for (const r of mapped) {
    const t = taxonomyMap[r.name] ?? taxonomyMap[r.slug];
    console.log(`  ${r.name.padEnd(14)} ${r.slug.padEnd(16)} ${String(r.posts).padStart(6)}  →  ${t.section}/${t.category}`);
  }
  if (unmapped.length > 0) {
    console.log("\n未覆盖 UNMAPPED  ← 这些会落进兜底分类「新闻」");
    for (const r of unmapped) {
      console.log(`  ${r.name.padEnd(14)} ${r.slug.padEnd(16)} ${String(r.posts).padStart(6)}`);
    }
  }
  const pct = total ? Math.round((covered / total) * 100) : 0;
  console.log(`\n覆盖率：${covered}/${total} 篇（${pct}%）`);
  if (pct < 100) {
    console.log("把上面 UNMAPPED 的分类补进 scripts/migrate-wp-posts.ts 的 taxonomyMap 后再导入。");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(String(error instanceof Error ? error.message : error));
  process.exit(1);
});
