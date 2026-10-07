/**
 * WordPress ingestion scaffold:
 * - Pulls posts from /wp-json/wp/v2/posts
 * - Maps legacy taxonomy slugs to new IA sections/categories
 * - Emits normalized records suitable for cms_articles import
 */

type WpMedia = {
  source_url?: string;
  alt_text?: string;
  caption?: { rendered?: string };
  media_details?: { sizes?: Record<string, { source_url?: string; width?: number }> };
};

type WpPost = {
  id: number;
  slug: string;
  link: string;
  date_gmt: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
  categories?: number[];
  featured_media?: number;
  _embedded?: {
    "wp:featuredmedia"?: WpMedia[];
  };
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
  /** Featured image, and the caption the old site printed beneath it. */
  heroImage: string;
  heroImageAlt: string;
  heroCredit: string;
  /** Empty when no category in `taxonomyMap` matched -- see resolveCategory. */
  category: string;
  /** The post's original WordPress category slugs, kept for auditing. */
  wpCategories: string[];
  locale: "zh";
  publishedAt: string;
};

type Target = { section: "news" | "resources"; category: string } | { hold: string };

/**
 * Where an article goes when its old categories have no home yet.
 *
 * It is NOT a catch-all: an old category that is missing from `taxonomyMap`
 * still stops the import. This only collects the ones we have consciously
 * decided not to file yet -- the 视频系列 groups and the old site's own
 * 未分类 / 其他 / temp. They are imported rather than dropped because dropping
 * them would leave 651 old URLs with no redirect, i.e. 404 on launch day.
 */
const HOLDING_CATEGORY = { section: "news", category: "unfiled" } as const;

/**
 * 旧站分类 -> 新站分类。Keyed by the WordPress slug, with the Chinese name in a
 * comment so the table can be read without cross-referencing.
 *
 * Built from the live taxonomy fetched 2026-09-29 (51 categories, 15,513 posts;
 * see docs/implementation/wp-taxonomy-live.md). Rows marked ✔ were decided by
 * the editor; the rest are proposals awaiting confirmation.
 *
 * There is deliberately **no catch-all**. The previous import defaulted unknown
 * categories to `news`, which silently swallowed 7,785 articles -- 78% of the
 * import -- and the new site has no 新闻 category at all. An unmapped category
 * now fails the coverage check instead.
 */
const taxonomyMap: Record<string, Target> = {
  // ---- 编辑已确认 ------------------------------------------------------
  hchy:    { section: "news", category: "red-regime-collapse" },   // ✔ 红潮谎言 7581
  gcze:    { section: "news", category: "red-regime-collapse" },   // ✔ 共产罪恶 667
  hcbx:    { section: "news", category: "red-regime-collapse" },   // ✔ 红朝败相 501
  sthsh:   { section: "news", category: "withdrawal-news" },       // ✔ 三退洪势 3453
  tddsj:   { section: "news", category: "withdrawal-news" },       // ✔ 退党大事记 1287
  toutiao: { section: "news", category: "withdrawal-news" },       // ✔ 今日头条 617
  styw:    { section: "news", category: "withdrawal-news" },       // ✔ 三退要闻 568
  ddzgem:  { section: "news", category: "withdrawal-news" },       // ✔ 打倒中共恶魔 191
  gjsy:    { section: "news", category: "worldwide-supports" },    // ✔ 国际声援 63
  tdjsgs:  { section: "news", category: "withdrawal-stories" },    // ✔ 退党纪实故事 136
  lysy:    { section: "resources", category: "culture" },          // ✔ 良言善语 5

  // ---- 待确认：新闻类 --------------------------------------------------
  szps:    { section: "news", category: "topics-commentary" },     // 时政评述 209
  mjlt:    { section: "news", category: "topics-commentary" },     // 名家论坛 60（你写的「名家评述」应是它）
  rwygd:   { section: "news", category: "topics-commentary" },     // 人物与观点 27
  jtdwh:   { section: "news", category: "topics-commentary" },     // 解体党文化 19
  "9p20":  { section: "news", category: "topics-commentary" },     // 九评20周年 16
  tddt:    { section: "news", category: "withdrawal-news" },       // 退党动态 151
  dsj:     { section: "news", category: "withdrawal-news" },       // 大事记 1
  srjx:    { section: "news", category: "withdrawal-stories" },    // 世人觉醒 72
  stgs:    { section: "news", category: "withdrawal-stories" },    // 三退故事 62
  sths:    { section: "news", category: "withdrawal-stories" },    // 三退洪声 49
  styg:    { section: "news", category: "withdrawal-stories" },    // 三退义工 39
  syrjx:   { section: "news", category: "withdrawal-stories" },    // 四亿人的觉醒 23
  ygfc:    { section: "news", category: "withdrawal-stories" },    // 义工风采 14
  tzrs:    { section: "news", category: "worldwide-investigation" },// 《铁证如山》系列讲座 34
  shbjzc:  { section: "news", category: "worldwide-supports" },    // 社会褒奖支持 8
  bd10312: { section: "news", category: "announcement-claims" },   // 退党证明与移民相关报道 22
  gkbftdzm:{ section: "news", category: "announcement-claims" },   // 公开颁发退党证明 17
  bd10238: { section: "news", category: "announcement-claims" },   // 移民常见问题 6

  // ---- 待确认：资料类（离开新闻流）-------------------------------------
  zhwh:    { section: "resources", category: "culture" },          // 中华文化 101
  yinyue:  { section: "resources", category: "culture" },          // 音乐 129
  wenxue:  { section: "resources", category: "culture" },          // 文学 62
  ctgsjx:  { section: "resources", category: "culture" },          // 传统故事精选 21
  shuhua:  { section: "resources", category: "culture" },          // 书画 7
  whpd:    { section: "resources", category: "culture" },          // 文化频道 6
  dfhc:    { section: "resources", category: "culture" },          // 大法洪传 19
  zxdzl:   { section: "resources", category: "resource-downloads" },// 真相点资料 19
  zbhf:    { section: "resources", category: "resource-downloads" },// 展板横幅 10
  cdxcx:   { section: "resources", category: "resource-downloads" },// 传单小册子 6
  stqk:    { section: "resources", category: "resource-downloads" },// 三退期刊 7
  zxyd:    { section: "resources", category: "resource-downloads" },// 真相园地 50

  // ---- 暂不归类：进「待归类」，URL 照常可用 -----------------------------
  spjx:    { hold: "视频精选 245 —— 视频，稍后进 cms_videos" },
  stdc:    { hold: "【视频系列】三退大潮 230 —— 视频" },
  xwdl:    { hold: "【视频系列】希望的路 99 —— 视频" },
  tdhl:    { hold: "【视频系列】退党洪流 22 —— 视频" },
  "9ping": { hold: "【视频系列】九评共产党 9 —— 视频" },
  qtsp:    { hold: "其他视频 3 —— 视频" },
  zxgb:    { hold: "真相广播 2 —— 音频" },

  // ---- 旧站本身就没分好的 ----------------------------------------------
  wfl:     { hold: "未分类 31 —— 旧站本身就没分类" },
  qita:    { hold: "其他 6 —— 旧站的杂项" },
  temp:    { hold: "temp 4 —— 旧站的临时分类" }
};

/**
 * Chinese names for categories the import may need to create.
 *
 * Without this the importer falls back to title-casing the slug, which is how
 * the first import produced "Red Regime Collapse" instead of 红朝败相.
 */
const categoryNames: Record<string, string> = {
  "red-regime-collapse": "红朝败相",
  "withdrawal-news": "三退要闻",
  "withdrawal-stories": "退党纪实故事",
  "topics-commentary": "专题报导与时政评论",
  "worldwide-supports": "国际声援行动",
  "worldwide-investigation": "追查国际调查报告",
  "announcement-claims": "公告与声明",
  "famous-quitccp": "名人退党",
  culture: "中华传统文化",
  unfiled: "待归类",
  "resource-downloads": "资料下载"
};

export { taxonomyMap, categoryNames, HOLDING_CATEGORY };
export type { Target };

function stripHtml(input: string): string {
  return input
    .replace(/<!--\[CDATA\[/g, " ")
    .replace(/<!\[CDATA\[/g, " ")
    .replace(/\]\]>/g, " ")
    .replace(/-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * WordPress HTML -> Markdown.
 *
 * Deliberately small, but it must carry the things a reader would notice losing:
 * images, links, emphasis and list structure. The first version stripped every
 * tag, which meant all 15,513 migrated articles arrived with no inline images
 * and no links at all.
 */
export function htmlToMarkdownLite(input: string): string {
  return (
    input
      // Both CDATA spellings appear in the corpus: the standard one and an
      // HTML-comment variant. Left in place, the tag stripper below treats
      // everything up to "]]>" as one tag and deletes the whole article.
      .replace(/<!--\[CDATA\[/g, "")
      .replace(/<!\[CDATA\[/g, "")
      .replace(/\]\]>/g, "")
      .replace(/-->/g, "")
      // Drop what carries no content before anything else can mangle it.
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
      // Embedded players -- about 9% of articles carry one. Stripped as a plain
      // tag they vanish silently, and for some posts the iframe IS the article.
      // `::: video` is the block the admin's Markdown editor already renders.
      .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>|<iframe\b[^>]*\/?>/gi, (tag) => {
        const src = /\ssrc\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] ?? "";
        return src ? `\n\n::: video ${src}\n:::\n\n` : "";
      })
      // Images and links first: they carry attributes the tag stripper eats.
      .replace(/<img\b[^>]*>/gi, (tag) => {
        const src = /\ssrc\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] ?? "";
        const alt = /\salt\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] ?? "";
        return src ? `\n\n![${alt}](${src})\n\n` : "";
      })
      .replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, (whole, text) => {
        const href = /\shref\s*=\s*["']([^"']+)["']/i.exec(whole)?.[1] ?? "";
        const label = String(text).replace(/<[^>]+>/g, "").trim();
        if (!href || href.startsWith("#")) return label;
        // A link wrapping only an image keeps the image, not a nested link.
        if (/^!\[/.test(label)) return label;
        return label ? `[${label}](${href})` : "";
      })
      .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, level, text) => {
        const hashes = "#".repeat(Math.min(Number(level) + 1, 6));
        return `\n\n${hashes} ${String(text).replace(/<[^>]+>/g, "").trim()}\n\n`;
      })
      .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t, text) => `**${String(text).trim()}**`)
      .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t, text) => `*${String(text).trim()}*`)
      .replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, text) =>
        `\n\n${String(text).replace(/<[^>]+>/g, "").trim().split(/\n+/).map((l: string) => `> ${l.trim()}`).join("\n")}\n\n`
      )
      .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_m, text) => `\n- ${String(text).replace(/<[^>]+>/g, "").trim()}`)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|section|article|ul|ol|table|tr)>/gi, "\n\n")
      // Whatever tags remain carry no meaning we keep.
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#8217;|&rsquo;/g, "'")
      .replace(/&ldquo;|&rdquo;/g, '"')
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/**
 * Resolves the first of a post's categories that the table covers.
 *
 * Returns `null` rather than falling back to a catch-all: an article whose
 * categories are all unmapped has to surface in the coverage report, not be
 * quietly filed somewhere.
 */
/**
 * Resolves the first of a post's categories that has a real home.
 *
 * Falls back to the holding category when every one of them is a `hold` entry,
 * and returns `null` only when a category is absent from the table entirely --
 * that is the case that must stop the import.
 */
function resolveCategory(
  legacyPath: string,
  wordpressCategorySlugs: string[] = []
): { section: "news" | "resources"; category: string } | null {
  const keys = [...wordpressCategorySlugs];
  const first = legacyPath.split("/").filter(Boolean)[0];
  if (first) keys.push(first);

  let sawHold = false;
  let sawUnknown = false;
  for (const key of keys) {
    const hit = taxonomyMap[key];
    if (!hit) {
      sawUnknown = true;
      continue;
    }
    if ("hold" in hit) {
      sawHold = true;
      continue;
    }
    return hit;
  }
  if (sawHold) return HOLDING_CATEGORY;
  if (sawUnknown || keys.length === 0) return null;
  return null;
}

/**
 * Pulls the featured image out of the `_embed` payload.
 *
 * `_embed=1` has always been on the request, so every page of the migration
 * already carried this -- it was simply never read, which is why all 15,513
 * articles arrived with no cover image.
 *
 * Prefers a large-but-not-original size: the full-size files average over half
 * a megabyte, and the 1536px variant is more than enough for a cover.
 */
/** The image fields, given the attachment record. */
function featuredImageFromMedia(media: WpMedia): { url: string; alt: string; credit: string } {
  const sizes = media.media_details?.sizes ?? {};
  const preferred =
    sizes["1536x1536"]?.source_url ?? sizes.medium_large?.source_url ?? media.source_url ?? "";
  const caption = stripHtml(String(media.caption?.rendered ?? ""));
  const creditMatch = caption.match(/（([^（）]{2,40})）\s*$/);
  return {
    url: preferred,
    alt: String(media.alt_text ?? "").trim() || caption.slice(0, 180),
    credit: creditMatch?.[1] ?? ""
  };
}

function featuredImage(
  post: WpPost,
  mediaById?: Map<number, WpMedia>
): { url: string; alt: string; credit: string } {
  // `featured_media` is set on every post, but `_embed` does not reliably
  // return the attachment: on a sampled page 21 of 25 posts came back with the
  // *site* object in the wp:featuredmedia slot instead. So the id is resolved
  // against a media map fetched separately, and the embed is only a fallback.
  const media = (post.featured_media ? mediaById?.get(post.featured_media) : undefined)
    ?? post._embedded?.["wp:featuredmedia"]?.[0];
  if (!media?.source_url) return { url: "", alt: "", credit: "" };

  const sizes = media.media_details?.sizes ?? {};
  const preferred =
    sizes["1536x1536"]?.source_url ?? sizes.medium_large?.source_url ?? media.source_url;

  // The caption carries the photo credit, e.g. 「…（温圣缘／大纪元）」. It is the
  // only description these images have -- alt_text is empty across the corpus.
  const caption = stripHtml(String(media.caption?.rendered ?? ""));
  const creditMatch = caption.match(/（([^（）]{2,40})）\s*$/);

  return {
    url: preferred,
    alt: String(media.alt_text ?? "").trim() || caption.slice(0, 180),
    credit: creditMatch?.[1] ?? ""
  };
}

export function normalizePost(
  post: WpPost,
  categorySlugById?: Map<number, string>,
  mediaById?: Map<number, WpMedia>
): NormalizedArticle {
  const postCategorySlugs =
    post.categories?.map((id) => categorySlugById?.get(id)).filter((slug): slug is string => Boolean(slug)) ?? [];
  const resolved = resolveCategory(new URL(post.link).pathname, postCategorySlugs);
  const hero = featuredImage(post, mediaById);
  const section = resolved?.section ?? "news";
  const category = resolved?.category ?? "";
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
    heroImage: hero.url,
    heroImageAlt: hero.alt,
    heroCredit: hero.credit,
    category,
    // The original categories travel with the row from here on. Losing them was
    // what made the last import impossible to audit or redo.
    wpCategories: postCategorySlugs,
    locale: "zh",
    publishedAt: post.date_gmt
  };
}

export interface MigrationPullOptions {
  perPage?: number;
  maxPages?: number;
  maxPosts?: number;
  /** ISO date; only posts published after it. */
  after?: string;
  /** ISO date; only posts edited after it -- catches corrections to old posts. */
  modifiedAfter?: string;
}

/** Appends the incremental filters WordPress understands. */
function withWindow(url: string, options: MigrationPullOptions): string {
  const extra: string[] = [];
  if (options.after) extra.push(`after=${encodeURIComponent(options.after)}`);
  if (options.modifiedAfter) extra.push(`modified_after=${encodeURIComponent(options.modifiedAfter)}`);
  return extra.length > 0 ? `${url}&${extra.join("&")}` : url;
}

export async function fetchAllPosts(baseUrl: string, options: MigrationPullOptions = {}): Promise<WpPost[]> {
  const rows: WpPost[] = [];
  let page = 1;
  const perPage = options.perPage ?? 100;
  const maxPages = options.maxPages ?? Number.POSITIVE_INFINITY;
  const maxPosts = options.maxPosts ?? Number.POSITIVE_INFINITY;
  while (true) {
    if (page > maxPages || rows.length >= maxPosts) break;
    const url = withWindow(
      `${baseUrl.replace(/\/$/, "")}/wp-json/wp/v2/posts?per_page=${perPage}&page=${page}&_embed=1`,
      options
    );
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

/**
 * Resolves attachment ids to media records, 100 at a time.
 *
 * Doing this rather than trusting `_embed` is the difference between 54% of
 * articles having a cover and all of them.
 */
async function fetchMediaByIds(baseUrl: string, ids: number[]): Promise<Map<number, WpMedia>> {
  const byId = new Map<number, WpMedia>();
  const unique = [...new Set(ids.filter((id) => id > 0))];
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const url =
      `${baseUrl.replace(/\/$/, "")}/wp-json/wp/v2/media?include=${chunk.join(",")}` +
      `&per_page=100&_fields=id,source_url,alt_text,caption,media_details`;
    try {
      const rows = await fetchWpCollection<WpMedia & { id: number }>(url);
      for (const row of rows) byId.set(row.id, row);
    } catch {
      // A failed batch costs those covers, not the run.
    }
    if ((i / 100) % 10 === 0) {
      process.stderr.write(`[media] ${byId.size}/${unique.length} 张\n`);
    }
  }
  return byId;
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
  // Only the attachment id is held per row, not the raw post. Holding every
  // WpPost with its full HTML until the media pass ran the heap out of memory
  // at about 13,400 articles.
  const mediaIds: number[] = [];
  let pulledPosts = 0;
  const categoryById = await fetchAllCategories(baseUrl);
  let page = 1;
  const perPage = options.perPage ?? 100;
  const maxPages = options.maxPages ?? Number.POSITIVE_INFINITY;
  // No implicit ceiling. This used to default to 3,000, so a run without
  // --max-posts stopped there and still exited 0 -- a silent partial pull that
  // looks exactly like a complete one. A cap is now something the caller asks
  // for.
  const maxPosts = options.maxPosts ?? Number.POSITIVE_INFINITY;

  while (true) {
    if (page > maxPages || normalized.length >= maxPosts) break;
    const url = withWindow(
      `${baseUrl.replace(/\/$/, "")}/wp-json/wp/v2/posts?per_page=${perPage}&page=${page}&_embed=1`,
      options
    );
    const batch = await fetchPostsPage(url);
    if (batch.length === 0) break;

    for (const post of batch) {
      normalized.push(normalizePost(post, categoryById));
      mediaIds.push(post.featured_media ?? 0);
      pulledPosts += 1;
      if (normalized.length >= maxPosts) break;
    }
    if (normalized.length >= maxPosts) break;
    // Progress on stderr, so stdout stays a clean JSON document and a stalled
    // or truncated run is visible while it happens.
    if (page % 10 === 0) {
      // `normalized` is filled after the media pass now, so report what has
      // actually been pulled rather than a counter that stays at zero.
      process.stderr.write(`[fetch] page ${page} · ${normalized.length} 篇\n`);
    }
    page += 1;
  }
  process.stderr.write(`[fetch] 取得 ${normalized.length} 篇，共 ${page - 1} 页；开始解析特色图\n`);

  // Second pass over the normalized rows, which carry no raw HTML.
  const mediaById = await fetchMediaByIds(baseUrl, mediaIds);
  normalized.forEach((row, index) => {
    const media = mediaById.get(mediaIds[index]);
    if (!media?.source_url) return;
    const hero = featuredImageFromMedia(media);
    row.heroImage = hero.url;
    row.heroImageAlt = hero.alt;
    row.heroCredit = hero.credit;
  });
  const withCover = normalized.filter((row) => row.heroImage).length;
  process.stderr.write(
    `[fetch] 完成：${normalized.length} 篇，其中 ${withCover} 篇有封面图\n`
  );

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
    if (arg === "--after") options.after = next;
    if (arg === "--modified-after") options.modifiedAfter = next;
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
