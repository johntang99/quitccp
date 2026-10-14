/**
 * Generates the set of legacy post ids that the middleware is willing to look up.
 *
 * The middleware serves 301s for old WordPress URLs of the shape
 * /YYYY/MM/DD/<id>/. To find the destination it queries Supabase, and it
 * caches the answer two ways -- an in-process Map and Next's fetch cache --
 * but both are keyed by the exact URL. That is the problem: an attacker who
 * randomises the id gets a cache miss every single time, and every miss is a
 * guaranteed database query. The 2026-10-13 flood is already aimed at exactly
 * this path shape, using one real id; randomising it would turn a fully
 * absorbed attack back into a database outage.
 *
 * There are only ~15.5k ids that can ever resolve, so the set fits in the
 * middleware bundle. With it, an unknown id is answered without touching the
 * database at all, and the attack surface disappears rather than being
 * rate-limited.
 *
 * The set is the union of two sources, and it must stay that way:
 *   cms_redirects  -- the migrated redirect map, the normal case
 *   cms_articles.legacy_id -- ids with no redirect row, which the middleware
 *                             still resolves by falling through to
 *                             /news/a/<id>. 13 ids exist only here; dropping
 *                             them would 404 links that work today.
 *
 * Re-run this whenever the migration adds redirects or articles, otherwise new
 * old-links will 404:
 *
 *   node scripts/build-legacy-id-set.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const line of readFileSync(path.join(repoRoot, ".env.local"), "utf8").split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
}

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function collect(table, column, extract, notNull = false) {
  const found = new Set();
  for (let from = 0; ; from += 1000) {
    let query = supabase.from(table).select(column).range(from, from + 999);
    if (notNull) query = query.not(column, "is", null);
    const { data, error } = await query;
    if (error) throw new Error(`${table}.${column}: ${error.message}`);
    if (!data?.length) break;
    for (const row of data) {
      const value = extract(row);
      if (Number.isInteger(value) && value > 0) found.add(value);
    }
    if (data.length < 1000) break;
  }
  return found;
}

process.stdout.write("读取 cms_redirects…");
const fromRedirects = await collect("cms_redirects", "legacy_url", (row) => {
  const match = row.legacy_url.match(/\/(\d+)\/?$/);
  return match ? Number(match[1]) : null;
});
console.log(` ${fromRedirects.size} 个 id`);

process.stdout.write("读取 cms_articles.legacy_id…");
const fromArticles = await collect("cms_articles", "legacy_id", (row) => Number(row.legacy_id), true);
console.log(` ${fromArticles.size} 个 id`);

const ids = [...new Set([...fromRedirects, ...fromArticles])].sort((a, b) => a - b);
const onlyInArticles = [...fromArticles].filter((id) => !fromRedirects.has(id)).length;
console.log(`并集 ${ids.length} 个（其中 ${onlyInArticles} 个只在文章表里，靠 /news/a/<id> 兜底）`);

/* Sorted ids with small gaps, so the deltas are far shorter than the numbers;
   base36 shortens them again. 95 KB of JSON becomes about 33 KB. */
let previous = 0;
const encoded = ids
  .map((id) => {
    const delta = id - previous;
    previous = id;
    return delta.toString(36);
  })
  .join(",");

const output = `/**
 * Legacy WordPress post ids that can resolve to a page. GENERATED FILE.
 *
 * Regenerate with \`node scripts/build-legacy-id-set.mjs\` whenever the
 * migration adds redirects or articles -- a new old-link that is missing here
 * will 404 instead of redirecting.
 *
 * This exists so the middleware can answer an unknown id without querying the
 * database. Without it, a flood of randomised /YYYY/MM/DD/<id>/ URLs is a
 * guaranteed database query per request, because both caches in front of that
 * query are keyed by the exact URL. See scripts/build-legacy-id-set.mjs.
 *
 * Ids are delta-encoded in base36 to keep the middleware bundle small:
 * ${(encoded.length / 1024).toFixed(1)} KB here versus ${(JSON.stringify(ids).length / 1024).toFixed(1)} KB as a plain array.
 */

/** ${ids.length} ids, generated ${new Date().toISOString().slice(0, 10)} from cms_redirects + cms_articles.legacy_id. */
const ENCODED =
  "${encoded}";

export const LEGACY_ID_COUNT = ${ids.length};

/* Built on first use rather than at module load: the middleware runs on every
   request, but only requests matching the legacy path shape ever ask. */
let ids: Set<number> | null = null;

export function isKnownLegacyId(id: number): boolean {
  if (!ids) {
    const built = new Set<number>();
    let running = 0;
    for (const delta of ENCODED.split(",")) {
      running += parseInt(delta, 36);
      built.add(running);
    }
    ids = built;
  }
  return ids.has(id);
}
`;

const destination = path.join(repoRoot, "apps/web/src/lib/legacy-redirect-ids.ts");
writeFileSync(destination, output);
console.log(`\n写入 ${path.relative(repoRoot, destination)}`);
console.log(`编码后 ${(encoded.length / 1024).toFixed(1)} KB（朴素数组要 ${(JSON.stringify(ids).length / 1024).toFixed(1)} KB）`);
