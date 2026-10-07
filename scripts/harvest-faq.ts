/**
 * Pulls the old site's FAQ (BetterDocs `docs` post type) into a normalised file.
 *
 * The FAQ at tuidang.org/faq/ is a WordPress BetterDocs install: each answer is
 * a `docs` post, grouped by the `doc_category` taxonomy and ordered inside its
 * category. All three are exposed by the REST API, so this reads them rather
 * than scraping the hub page -- which only lists the first few per category.
 *
 * Direct API access is blocked by Cloudflare; the read-through proxy that
 * `migrate-wp-posts.ts` falls back to is used here too.
 *
 *   npx tsx scripts/harvest-faq.ts
 *   npx tsx scripts/harvest-faq.ts --out artifacts/faq/faq.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { htmlToMarkdownLite } from "./migrate-wp-posts";

const BASE = process.env.WP_BASE_URL ?? "https://www.tuidang.org";
const UA = "quitccp-phase4-migrator/1.0";

const outIndex = process.argv.indexOf("--out");
const OUT = outIndex === -1 ? "artifacts/faq/faq.json" : process.argv[outIndex + 1];

/** Same shape as the migrator's fetch: try direct, fall back to the proxy. */
async function getJson<T>(url: string): Promise<T> {
  const direct = await fetch(url, { headers: { "user-agent": UA } }).catch(() => null);
  if (direct && direct.ok) return (await direct.json()) as T;

  const proxied = `https://r.jina.ai/http://${url.replace(/^https?:\/\//, "")}`;
  const res = await fetch(proxied, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`proxy ${res.status} for ${url}`);
  const body = await res.text();
  const marker = "Markdown Content:";
  const at = body.indexOf(marker);
  if (at < 0) throw new Error(`proxy response had no payload for ${url}`);
  return JSON.parse(body.slice(at + marker.length).trim()) as T;
}

interface WpCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
  description?: string;
  parent?: number;
}
interface WpDoc {
  id: number;
  slug: string;
  link: string;
  date_gmt: string;
  modified_gmt: string;
  menu_order?: number;
  title: { rendered: string };
  content: { rendered: string };
  doc_category?: number[];
}

const decode = (value: string) =>
  value
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&rsquo;/g, "’")
    .replace(/\s+/g, " ")
    .trim();

async function fetchAll<T>(pathAndQuery: string): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; page <= 50; page += 1) {
    const url = `${BASE}${pathAndQuery}${pathAndQuery.includes("?") ? "&" : "?"}per_page=100&page=${page}`;
    let batch: T[] = [];
    try {
      batch = await getJson<T[]>(url);
    } catch {
      break; // past the last page the API answers 400
    }
    if (!Array.isArray(batch) || batch.length === 0) break;
    rows.push(...batch);
    process.stdout.write(`\r  ${pathAndQuery.split("?")[0]} … ${rows.length}   `);
    if (batch.length < 100) break;
  }
  process.stdout.write("\n");
  return rows;
}

async function main() {
const categories = await fetchAll<WpCategory>("/wp-json/wp/v2/doc_category?_fields=id,name,slug,count,description,parent");
const docs = await fetchAll<WpDoc>(
  "/wp-json/wp/v2/docs?_fields=id,slug,link,date_gmt,modified_gmt,menu_order,title,content,doc_category"
);

const byId = new Map(categories.map((c) => [c.id, c]));
const normalised = docs.map((doc) => {
  const cats = (doc.doc_category ?? []).map((id) => byId.get(id)).filter(Boolean) as WpCategory[];
  return {
    legacyId: doc.id,
    legacyUrl: doc.link.replace(BASE, ""),
    slug: decode(doc.title.rendered).slice(0, 90),
    question: decode(doc.title.rendered),
    answerMarkdown: htmlToMarkdownLite(doc.content?.rendered ?? "").trim(),
    categorySlug: cats[0]?.slug ?? "uncategorised",
    categoryName: cats[0]?.name ?? "未分类",
    extraCategories: cats.slice(1).map((c) => c.slug),
    menuOrder: doc.menu_order ?? 0,
    publishedAt: doc.date_gmt,
    updatedAt: doc.modified_gmt
  };
});

// Within a category BetterDocs orders by menu_order, then by date.
normalised.sort(
  (a, b) =>
    a.categorySlug.localeCompare(b.categorySlug) ||
    a.menuOrder - b.menuOrder ||
    a.publishedAt.localeCompare(b.publishedAt)
);

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify(
    {
      harvestedAt: new Date().toISOString(),
      source: `${BASE}/faq/`,
      categories: categories
        .map((c) => ({ slug: c.slug, name: decode(c.name), count: c.count, description: decode(c.description ?? "") }))
        .sort((a, b) => a.slug.localeCompare(b.slug)),
      items: normalised
    },
    null,
    2
  )
);

const perCategory: Record<string, number> = {};
for (const item of normalised) perCategory[item.categoryName] = (perCategory[item.categoryName] ?? 0) + 1;
const empty = normalised.filter((i) => !i.answerMarkdown).length;

console.log(`\n  分类 ${categories.length} 个，问答 ${normalised.length} 条`);
for (const [name, n] of Object.entries(perCategory).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${name.padEnd(14)} ${n}`);
}
if (empty > 0) console.log(`  ⚠️ 答案为空的 ${empty} 条`);
console.log(`\n  已写入 ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
