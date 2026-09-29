/**
 * WordPress ingestion scaffold:
 * - Pulls posts from /wp-json/wp/v2/posts
 * - Maps legacy taxonomy slugs to new IA sections/categories
 * - Emits normalized records suitable for cms_articles import
 */

type WpPost = {
  id: number;
  slug: string;
  link: string;
  date_gmt: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
  categories?: number[];
};

type WpCategory = {
  id: number;
  slug: string;
};

export type NormalizedArticle = {
  legacyId: number;
  legacyUrl: string;
  slug: string;
  title: string;
  summary: string;
  bodyMarkdown: string;
  bodyPlain: string;
  section: "news" | "resources";
  category: string;
  locale: "zh";
  publishedAt: string;
};

type Target = { section: "news" | "resources"; category: string };

/**
 * Old tuidang.org category -> new category.
 *
 * Keyed by the WordPress category *name* (Chinese) as well as its slug, because
 * the slug is a pinyin abbreviation that is easy to guess wrong: the previous
 * version of this map guessed four of the seven, and those four never matched a
 * single post -- which is why 7,785 of 10,000 articles fell through to the
 * catch-all `news` category.
 *
 * Every target below is an existing category slug in `cms_article_categories`.
 * Run `scripts/check-wp-taxonomy.ts` against the real export before importing:
 * it reports which of the site's categories this table does not cover.
 */
const taxonomyMap: Record<string, Target> = {
  // --- confirmed by the editor -----------------------------------------
  "红朝败相": { section: "news", category: "red-regime-collapse" },
  "三退报道": { section: "news", category: "withdrawal-news" },
  "名家评述": { section: "news", category: "topics-commentary" },
  "国际声援": { section: "news", category: "worldwide-supports" },
  "三退纪实": { section: "news", category: "withdrawal-stories" },
  // 打倒中共恶魔 is the End CCP petition drive; filed with 三退要闻 for now.
  "打倒中共恶魔": { section: "news", category: "withdrawal-news" },
  // Reference material rather than news -- these leave the article stream.
  "良言善语": { section: "resources", category: "culture" },
  "文化故事": { section: "resources", category: "culture" },

  // --- proposed, not yet confirmed --------------------------------------
  "调查报告": { section: "news", category: "worldwide-investigation" },
  "公告": { section: "news", category: "announcement-claims" },

  // --- pinyin slugs seen in the previous import -------------------------
  hcbx: { section: "news", category: "red-regime-collapse" },
  styw: { section: "news", category: "withdrawal-news" },
  sthsh: { section: "news", category: "withdrawal-stories" },
  tjbg: { section: "news", category: "worldwide-investigation" },
  gg: { section: "news", category: "announcement-claims" },
  wh: { section: "resources", category: "culture" },
  zy: { section: "resources", category: "resource-downloads" }
};

export { taxonomyMap };
export type { Target };

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlToMarkdownLite(input: string): string {
  return input
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "\n## $1\n")
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "\n### $1\n")
    .replace(/<p[^>]*>(.*?)<\/p>/gi, "\n$1\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function resolveCategory(
  legacyPath: string,
  wordpressCategorySlugs: string[] = []
): Target {
  // Names and slugs are both looked up, so a post resolves whichever the
  // caller happened to collect.
  for (const key of wordpressCategorySlugs) {
    if (taxonomyMap[key]) return taxonomyMap[key];
  }
  const pathBits = legacyPath.split("/").filter(Boolean);
  const first = pathBits[0];
  if (first && taxonomyMap[first]) return taxonomyMap[first];
  return { section: "news", category: "news" };
}

export function normalizePost(post: WpPost, categorySlugById?: Map<number, string>): NormalizedArticle {
  const postCategorySlugs =
    post.categories?.map((id) => categorySlugById?.get(id)).filter((slug): slug is string => Boolean(slug)) ?? [];
  const { section, category } = resolveCategory(new URL(post.link).pathname, postCategorySlugs);
  let normalizedSlug = post.slug;
  try {
    normalizedSlug = decodeURIComponent(post.slug);
  } catch {
    normalizedSlug = post.slug;
  }
  return {
    legacyId: post.id,
    legacyUrl: new URL(post.link).pathname,
    slug: normalizedSlug || `legacy-${post.id}`,
    title: stripHtml(post.title.rendered),
    summary: stripHtml(post.excerpt.rendered).slice(0, 240),
    bodyMarkdown: htmlToMarkdownLite(post.content.rendered),
    bodyPlain: stripHtml(post.content.rendered),
    section,
    category,
    locale: "zh",
    publishedAt: post.date_gmt
  };
}

export interface MigrationPullOptions {
  perPage?: number;
  maxPages?: number;
  maxPosts?: number;
}

export async function fetchAllPosts(baseUrl: string, options: MigrationPullOptions = {}): Promise<WpPost[]> {
  const rows: WpPost[] = [];
  let page = 1;
  const perPage = options.perPage ?? 100;
  const maxPages = options.maxPages ?? Number.POSITIVE_INFINITY;
  const maxPosts = options.maxPosts ?? Number.POSITIVE_INFINITY;
  while (true) {
    if (page > maxPages || rows.length >= maxPosts) break;
    const url = `${baseUrl.replace(/\/$/, "")}/wp-json/wp/v2/posts?per_page=${perPage}&page=${page}&_embed=1`;
    const batch = await fetchPostsPage(url);
    if (batch.length === 0) break;
    rows.push(...batch);
    if (rows.length >= maxPosts) break;
    page += 1;
  }
  return rows.slice(0, maxPosts);
}

async function fetchPostsPage(url: string): Promise<WpPost[]> {
  return fetchWpCollection<WpPost>(url);
}

async function fetchCategoryPage(url: string): Promise<WpCategory[]> {
  return fetchWpCollection<WpCategory>(url);
}

async function fetchWpCollection<T>(url: string): Promise<T[]> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "quitccp-phase4-migrator/1.0"
    }
  });
  if (response.status === 400 || response.status === 404) return [];
  if (response.ok) return (await response.json()) as T[];
  if (response.status !== 403) {
    throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
  }

  // Cloudflare may challenge server-to-server calls; fallback to a read-through proxy.
  const proxyUrl = `https://r.jina.ai/http://${url.replace(/^https?:\/\//, "")}`;
  const proxyResponse = await fetch(proxyUrl, {
    headers: {
      "user-agent": "quitccp-phase4-migrator/1.0"
    }
  });
  if (!proxyResponse.ok) {
    throw new Error(`Proxy fetch failed: ${proxyResponse.status} ${proxyResponse.statusText}`);
  }
  const proxyBody = await proxyResponse.text();
  const marker = "Markdown Content:";
  const markerIndex = proxyBody.indexOf(marker);
  if (markerIndex < 0) throw new Error("Proxy response missing markdown payload");
  const payload = proxyBody.slice(markerIndex + marker.length).trim();
  return JSON.parse(payload) as T[];
}

async function fetchAllCategories(baseUrl: string): Promise<Map<number, string>> {
  const categoryById = new Map<number, string>();
  let page = 1;
  while (true) {
    const url = `${baseUrl.replace(/\/$/, "")}/wp-json/wp/v2/categories?per_page=100&page=${page}`;
    const rows = await fetchCategoryPage(url);
    if (rows.length === 0) break;
    for (const row of rows) {
      categoryById.set(row.id, row.slug);
    }
    page += 1;
  }
  return categoryById;
}

export async function runNormalization(baseUrl: string, options: MigrationPullOptions = {}) {
  const normalized: NormalizedArticle[] = [];
  let pulledPosts = 0;
  const categoryById = await fetchAllCategories(baseUrl);
  let page = 1;
  const perPage = options.perPage ?? 100;
  const maxPages = options.maxPages ?? Number.POSITIVE_INFINITY;
  const maxPosts = options.maxPosts ?? 3_000;

  while (true) {
    if (page > maxPages || normalized.length >= maxPosts) break;
    const url = `${baseUrl.replace(/\/$/, "")}/wp-json/wp/v2/posts?per_page=${perPage}&page=${page}&_embed=1`;
    const batch = await fetchPostsPage(url);
    if (batch.length === 0) break;

    for (const post of batch) {
      normalized.push(normalizePost(post, categoryById));
      pulledPosts += 1;
      if (normalized.length >= maxPosts) break;
    }
    page += 1;
  }

  normalized.sort((a, b) => {
    if (a.legacyId !== b.legacyId) return a.legacyId - b.legacyId;
    return a.slug.localeCompare(b.slug);
  });

  return {
    total: normalized.length,
    pulledPosts,
    rows: normalized
  };
}

function parseArgs(argv: string[]) {
  const options: MigrationPullOptions = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (!next) continue;
    if (arg === "--per-page") options.perPage = Number(next);
    if (arg === "--max-pages") options.maxPages = Number(next);
    if (arg === "--max-posts") options.maxPosts = Number(next);
  }
  return options;
}

async function main() {
  const baseUrl = process.env.WP_BASE_URL;
  if (!baseUrl) {
    throw new Error("WP_BASE_URL is required");
  }
  const options = parseArgs(process.argv.slice(2));
  const result = await runNormalization(baseUrl, options);
  process.stdout.write(JSON.stringify(result, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
}
