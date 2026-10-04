import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { SIMPLIFIED_TO_TRADITIONAL, TRADITIONAL_TO_SIMPLIFIED } from "@/lib/zh-variants";
import { synonymsOf } from "@/lib/search-synonyms";

/**
 * Substring search across articles, videos and materials.
 *
 * Why substring and not something cleverer: Postgres has no Chinese word
 * segmentation. `pg_trgm` scores by three-character windows, which is built for
 * Latin words -- a query like 法轮功 is a single trigram, its similarity against
 * a twenty-character title rounds to nothing, and the `%` operator's threshold
 * rejects it. That is not a tuning problem; it is what trigrams mean. Measured
 * against this database, pg_trgm returned 0 results for 法轮功 while 410
 * published articles carry it in the title alone.
 *
 * ILIKE '%…%' needs no segmentation at all, which is exactly why it suits
 * Chinese: the query is a substring or it is not.
 *
 * Ranking is done here rather than in SQL, in tiers: title, then summary, then
 * body, each a separate query, stopping as soon as the page is full. Separate
 * queries because the database orders by date *before* we could rank a combined
 * result -- thirty recent summary matches would fill the page and older title
 * matches would never appear.
 *
 * Only the body tier is expensive, roughly 2.3s against 15,515 articles, and
 * most queries never reach it. Body text is matched but never selected: a row
 * returned by that tier is known to have matched its body, which is all the
 * ranking needs, and it saves transferring megabytes of prose.
 */

export type SearchResultType = "article" | "video" | "material";

export interface SubstringSearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  excerpt: string;
  href: string;
  /** 新闻与报告 / 视频 / 资料 — shown on the result card. */
  typeLabel: string;
  publishedAt: string | null;
  score: number;
}

const TYPE_LABEL: Record<SearchResultType, string> = {
  article: "新闻与报告",
  video: "视频",
  material: "资料"
};

/** PostgREST `or=` is comma-separated, so a comma in the query would split it. */
function escapeForOr(value: string): string {
  return value.replace(/[,()]/g, " ");
}

/** ILIKE wildcards in user input would otherwise change what the query means. */
function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, (char) => `\\${char}`);
}

function contains(haystack: string | null | undefined, needle: string): boolean {
  if (!haystack) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/**
 * Splits a query into the terms every result must contain.
 *
 * Without this, "法轮功 迫害" is one literal substring -- space included -- and
 * matches only where those characters sit together, which is essentially never:
 * the query returned 0 results while 94 articles carry both words in the title.
 * Chinese is unsegmented, so a single term stays a single term; the split is for
 * the spaces a person actually typed.
 *
 * Both space characters are handled: a Chinese IME produces the full-width one.
 */
function splitTerms(query: string): string[] {
  return query
    .split(/[\s\u3000]+/)
    .map((term) => term.trim())
    .filter(Boolean)
    .slice(0, 6); // a sane ceiling; each term is another AND condition
}

function mapChars(text: string, table: Readonly<Record<string, string>>): string {
  let out = "";
  for (const ch of text) out += table[ch] ?? ch;
  return out;
}

/**
 * Every script a term might have been written in.
 *
 * Readers in Taiwan, Hong Kong and much of the diaspora type traditional
 * characters; this archive is written almost entirely in simplified. Before
 * this, 退黨 found 3 articles where 退党 found 1,667, 聲明 found none at all
 * where 声明 found 183, and nothing in the interface explained why. A reader
 * would reasonably conclude the site had nothing on the subject.
 *
 * Conversion runs both ways so the handful of traditional-titled pieces are
 * reachable from a simplified query too. Duplicates collapse, so a term with no
 * variant forms -- most Latin text, and Han characters shared by both scripts --
 * costs one condition exactly as before.
 */
export function termVariants(term: string): string[] {
  const forms = new Set<string>();
  // Synonyms first, then every script form of each: a reader typing 三退 in
  // traditional should still reach an article that says 退黨.
  for (const synonym of synonymsOf(term)) {
    forms.add(synonym);
    forms.add(mapChars(synonym, TRADITIONAL_TO_SIMPLIFIED));
    forms.add(mapChars(synonym, SIMPLIFIED_TO_TRADITIONAL));
  }
  return [...forms].filter(Boolean);
}

/** True when some script variant of every term appears. */
function containsAll(haystack: string | null | undefined, terms: string[]): boolean {
  return terms.every((term) => termVariants(term).some((form) => contains(haystack, form)));
}

/**
 * Title beats summary beats body, and newer beats older within a tier.
 *
 * The weights are gaps rather than increments so a title match can never be
 * displaced by a row that happens to mention the term twice further down.
 */
function scoreRow(terms: string[], title: string, summary: string): number {
  if (containsAll(title, terms)) return 100;
  if (containsAll(summary, terms)) return 10;
  return 1;
}

/** Articles first on a tie: the article carries the full text. */
const TYPE_RANK: Record<SearchResultType, number> = { article: 0, video: 1, material: 2 };

function byScoreThenRecency(a: SubstringSearchResult, b: SubstringSearchResult): number {
  if (b.score !== a.score) return b.score - a.score;
  const byDate = (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
  if (byDate !== 0) return byDate;
  return TYPE_RANK[a.type] - TYPE_RANK[b.type];
}

/**
 * One row per piece of content, not one per table it lives in.
 *
 * A great deal of this material is published as both an article and a video
 * under the same title. Listing both spent up to half the page repeating
 * itself -- 15 of 30 slots on a search for 活摘器官 -- and the second copy told
 * the reader nothing the first had not.
 */
function dedupeByTitle(rows: SubstringSearchResult[]): SubstringSearchResult[] {
  const seen = new Set<string>();
  const out: SubstringSearchResult[] = [];
  for (const row of rows) {
    const key = row.title.trim().replace(/\s+/g, " ").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function excerptFrom(summary: string, fallback: string): string {
  const text = (summary || fallback || "").trim();
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

interface TypeConfig {
  type: SearchResultType;
  table: string;
  /** Columns returned. Body columns are deliberately absent. */
  select: string;
  /**
   * Match tiers, best first: title, then summary, then body.
   *
   * They are separate queries rather than one `or=` because each is ordered by
   * date in the database, and a combined query orders *before* we can rank. With
   * one query, thirty recent summary matches fill the page and older title
   * matches never appear -- which is exactly what 大纪元 did: 44 articles carry
   * it in the title and none of them was the top result.
   */
  tiers: string[][];
  localeFiltered: boolean;
}

const TYPES: TypeConfig[] = [
  {
    type: "article",
    table: "cms_articles",
    select: "id, slug, title, summary, published_at",
    tiers: [["title"], ["summary"], ["body_plain"]],
    localeFiltered: true
  },
  {
    type: "video",
    table: "cms_videos",
    select: "id, slug, title, description, published_at",
    tiers: [["title"], ["description", "speaker"], ["body_markdown"]],
    localeFiltered: false
  },
  {
    type: "material",
    table: "cms_materials",
    // The public URL needs the category slug, so it is joined here.
    select:
      "id, slug, title, summary, published_at, cms_material_category_map(cms_material_categories(slug))",
    tiers: [["title"], ["summary"], ["body_markdown"]],
    localeFiltered: true
  }
];

function materialHref(row: Record<string, unknown>): string | null {
  const maps = Array.isArray(row.cms_material_category_map) ? row.cms_material_category_map : [];
  const first = maps[0] as { cms_material_categories?: { slug?: string } } | undefined;
  const category = first?.cms_material_categories?.slug;
  const slug = String(row.slug ?? "");
  if (!category || !slug) return null;
  return `/resources/downloads/${encodeURIComponent(category)}/${encodeURIComponent(slug)}`;
}

function toResult(
  config: TypeConfig,
  row: Record<string, unknown>,
  terms: string[]
): SubstringSearchResult | null {
  const title = String(row.title ?? "");
  const summary = String(row.summary ?? row.description ?? "");
  const slug = String(row.slug ?? "");
  if (!title || !slug) return null;

  let href: string | null;
  if (config.type === "article") href = `/news/${encodeURIComponent(slug)}`;
  else if (config.type === "video") href = `/videos/${encodeURIComponent(slug)}`;
  else href = materialHref(row);
  // A material filed under no category has no public URL; listing it would be a
  // search result that leads nowhere.
  if (!href) return null;

  return {
    id: `${config.type}:${String(row.id ?? slug)}`,
    type: config.type,
    title,
    excerpt: excerptFrom(summary, ""),
    href,
    typeLabel: TYPE_LABEL[config.type],
    publishedAt: row.published_at ? String(row.published_at) : null,
    score: scoreRow(terms, title, summary)
  };
}

async function searchOneType(
  config: TypeConfig,
  terms: string[],
  locale: string,
  limit: number
): Promise<SubstringSearchResult[]> {
  const supabase = createSupabaseAdminClient();
  // One entry per term, each holding every script form that term could take.
  const needleGroups = terms.map((term) =>
    termVariants(term).map((form) => `%${escapeLike(escapeForOr(form))}%`)
  );

  const base = () => {
    let q = supabase
      .from(config.table)
      .select(config.select)
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (config.localeFiltered) q = q.eq("locale", locale);
    return q;
  };

  /**
   * Every term must appear, and all of them in the same field.
   *
   * Requiring one field to hold the lot is the conservative reading of a
   * multi-word query: someone typing 法轮功 迫害 wants pieces about both, not a
   * piece whose title mentions one while its body happens to mention the other.
   * It is also the only form Postgres can answer from an index here, because
   * spreading terms across columns would need a concatenated column to match on.
   */
  /**
   * Builds `every term present, in some script` for one field.
   *
   * Reads as AND over terms of OR over that term's variants. Separate filters on
   * a PostgREST query are ANDed, so on a single field each term can be its own
   * `or(...)` group; across several fields the whole conjunction has to be
   * written out per field and OR-ed, because a term matching in the title and
   * another in the description is not a match for the phrase someone typed.
   */
  const conjunctionFor = (field: string) =>
    needleGroups
      .map((group) =>
        group.length === 1
          ? `${field}.ilike.${group[0]}`
          : `or(${group.map((needle) => `${field}.ilike.${needle}`).join(",")})`
      )
      .join(",");

  const run = async (fields: string[]) => {
    let query = base();
    if (fields.length === 1) {
      for (const group of needleGroups) {
        query =
          group.length === 1
            ? query.ilike(fields[0], group[0])
            : query.or(group.map((needle) => `${fields[0]}.ilike.${needle}`).join(","));
      }
    } else {
      query = query.or(
        fields
          .map((field) =>
            needleGroups.length === 1 && needleGroups[0].length === 1
              ? `${field}.ilike.${needleGroups[0][0]}`
              : `and(${conjunctionFor(field)})`
          )
          .join(",")
      );
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as Record<string, unknown>[];
  };

  const results: SubstringSearchResult[] = [];
  const seen = new Set<string>();

  for (const tier of config.tiers) {
    // Each tier is skipped once the page is full, so the body scan -- the only
    // slow one, around 2.3s across 15,515 articles -- runs just for queries that
    // the title and summary could not answer.
    if (results.length >= limit) break;
    const rows = await run(tier);
    for (const row of rows) {
      const result = toResult(config, row, terms);
      if (!result || seen.has(result.id)) continue;
      seen.add(result.id);
      results.push(result);
    }
  }
  return results;
}

/**
 * Searches every content type at once.
 *
 * The three run in parallel because articles dominate the cost -- 745 videos and
 * 21 materials are answered in well under half a second, so running them
 * alongside articles makes the whole search no slower than articles alone. One
 * type failing does not take the others down: a search that returns the videos
 * is better than a search that returns an error.
 */
export async function searchEverythingBySubstring(
  query: string,
  options: { locale?: string; limit?: number } = {}
): Promise<SubstringSearchResult[]> {
  const terms = splitTerms(query);
  if (terms.length === 0) return [];
  const locale = options.locale ?? "zh";
  const limit = options.limit ?? 30;

  const settled = await Promise.allSettled(
    TYPES.map((config) => searchOneType(config, terms, locale, limit))
  );

  const merged: SubstringSearchResult[] = [];
  for (const outcome of settled) {
    if (outcome.status === "fulfilled") merged.push(...outcome.value);
    else {
      // eslint-disable-next-line no-console
      console.warn("[search-substring] one content type failed", outcome.reason);
    }
  }

  return dedupeByTitle(merged.sort(byScoreThenRecency)).slice(0, limit);
}
