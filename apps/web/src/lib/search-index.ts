import { createClient } from "@supabase/supabase-js";
import { SITE_LOCALE } from "@/lib/site-config";

/**
 * What goes into the search index, and how it gets there.
 *
 * One module because three callers need the identical document shape: the manual
 * sync in 站点设置, the cron that keeps it fresh, and the hook that indexes a
 * single piece the moment it is published. When those drift, the index disagrees
 * with itself depending on which path wrote a row -- the subtle version of the
 * bug that already cost this site seven weeks of stale search.
 *
 * One index holds all three content types rather than three indexes, so a search
 * ranks an article against a video instead of stitching separate result lists
 * together afterwards.
 */

export type SearchDocType = "article" | "video" | "material";

export interface SearchDocument {
  /** Prefixed so an article and a video can never collide, and so a single
   *  document can be deleted by id without knowing which table it came from. */
  id: string;
  type: SearchDocType;
  title: string;
  summary: string;
  body: string;
  /** Precomputed at index time: the three types have different URL shapes, and
   *  a material's URL needs its category, which is not on the row. */
  href: string;
  slug: string;
  locale: string;
  status: string;
  published_at: string | null;
  /**
   * When this document was last written, epoch milliseconds.
   *
   * A full sync stamps every document it writes, then deletes anything still
   * carrying an older stamp -- which is how rows deleted outside the admin (a
   * direct database delete, an import that drops rows) leave the index. Without
   * it the index only ever grows, and a search eventually offers pages that 404.
   */
  synced_at: number;
}

export const INDEX_SETTINGS = {
  searchableAttributes: ["title", "summary", "body"],
  filterableAttributes: ["locale", "status", "type", "synced_at"],
  sortableAttributes: ["published_at"],
  rankingRules: ["words", "typo", "proximity", "attribute", "sort", "exactness"]
} as const;

/**
 * Underscore, not a colon: Meilisearch restricts document ids to letters,
 * digits, hyphens and underscores, and rejects the whole batch otherwise.
 */
export function docId(type: SearchDocType, id: string): string {
  return `${type}_${id}`;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function meiliConfig() {
  return {
    host: requireEnv("MEILI_HOST").replace(/\/$/, ""),
    // Writing needs the master key; the search path deliberately prefers the
    // search-only key instead.
    key: process.env.MEILI_MASTER_KEY?.trim() || process.env.MEILI_SEARCH_API_KEY?.trim() || "",
    index: process.env.MEILI_INDEX_ARTICLES?.trim() || "articles"
  };
}

export async function meiliRequest<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const { host, key } = meiliConfig();
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (key) headers.authorization = `Bearer ${key}`;
  const response = await fetch(`${host}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Meilisearch ${method} ${path} failed: ${response.status} ${text.slice(0, 300)}`);
  }
  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
}

export async function waitForTask(taskUid: number, timeoutMs = 300000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const task = await meiliRequest<{ status: string; error?: unknown }>("GET", `/tasks/${taskUid}`);
    if (task.status === "succeeded") return;
    if (task.status === "failed" || task.status === "canceled") {
      throw new Error(`Meilisearch task ${taskUid} ${task.status}: ${JSON.stringify(task.error)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for Meilisearch task ${taskUid}`);
}

export async function ensureIndex(): Promise<void> {
  const { index } = meiliConfig();
  try {
    await meiliRequest("POST", "/indexes", { uid: index, primaryKey: "id" });
  } catch (error) {
    if (!String(error).includes("index_already_exists")) throw error;
  }
  const task = await meiliRequest<{ taskUid: number }>(
    "PATCH",
    `/indexes/${encodeURIComponent(index)}/settings`,
    INDEX_SETTINGS
  );
  await waitForTask(task.taskUid);
}

function materialHref(row: Record<string, unknown>): string | null {
  const maps = Array.isArray(row.cms_material_category_map) ? row.cms_material_category_map : [];
  const first = maps[0] as { cms_material_categories?: { slug?: string } } | undefined;
  const category = first?.cms_material_categories?.slug;
  const slug = String(row.slug ?? "");
  if (!category || !slug) return null;
  return `/resources/downloads/${encodeURIComponent(category)}/${encodeURIComponent(slug)}`;
}

/** Null when the row cannot be represented -- no slug, or no public URL. */
export function toSearchDocument(
  type: SearchDocType,
  row: Record<string, unknown>,
  syncedAt: number = Date.now()
): SearchDocument | null {
  const slug = String(row.slug ?? "");
  const title = String(row.title ?? "");
  if (!slug || !title) return null;

  let href: string | null;
  if (type === "article") href = `/news/${encodeURIComponent(slug)}`;
  else if (type === "video") href = `/videos/${encodeURIComponent(slug)}`;
  else href = materialHref(row);
  if (!href) return null;

  return {
    id: docId(type, String(row.id)),
    type,
    title,
    summary: String(row.summary ?? row.description ?? ""),
    body: String(row.body_plain ?? row.body_markdown ?? ""),
    href,
    slug,
    /* 037 之前 cms_videos 没有 locale 列，所以这里要兜一个值，否则搜索按
       locale 过滤会把所有视频都滤掉。现在那一列有了，兜底退为纯粹的保险 ——
       取当前站而不是写死 zh，免得英文站的视频被算成中文的。 */
    locale: String(row.locale ?? SITE_LOCALE),
    status: String(row.status ?? "draft"),
    published_at: row.published_at ? String(row.published_at) : null,
    synced_at: syncedAt
  };
}

interface TypeSource {
  type: SearchDocType;
  table: string;
  select: string;
  /**
   * 这张表的行是否按语言区分。
   *
   * 037 之前 cms_videos 没有 locale 列，所以视频是 false —— 而那意味着每个站
   * 都会把全部 861 个视频索引一遍，并且因为 select 里没取 locale，
   * toSearchDocument 的兜底会把它们标成**当前站**的语言。两个站的文档 id 相同，
   * 于是来回覆盖：中文站写成 zh，英文站再写成 en。
   *
   * 那一列现在有了（861 行全是 zh，无空值），所以三张表都是 true。
   */
  localeFiltered: boolean;
}

const SOURCES: TypeSource[] = [
  {
    type: "article",
    table: "cms_articles",
    select: "id, slug, title, summary, body_plain, locale, status, published_at",
    localeFiltered: true
  },
  {
    type: "video",
    table: "cms_videos",
    select: "id, slug, title, description, body_markdown, locale, status, published_at",
    localeFiltered: true
  },
  {
    type: "material",
    table: "cms_materials",
    select:
      "id, slug, title, summary, body_markdown, locale, status, published_at, " +
      "cms_material_category_map(cms_material_categories(slug))",
    localeFiltered: true
  }
];

export interface SyncOptions {
  locales: string[];
  batchSize?: number;
  /** Only rows changed since this timestamp -- the hourly cron's cheap path. */
  since?: string;
  /** Empty the index first. Needed when document ids change shape. */
  reset?: boolean;
}

export interface SyncResult {
  total: number;
  byType: Record<SearchDocType, number>;
  /** Documents dropped because their row no longer exists. Full passes only. */
  removed: number;
  index: string;
}

/**
 * 全量同步末尾那一扫要删掉哪些文档。
 *
 * ## 为什么必须限定语言
 *
 * 四个站共用一个索引（索引名来自 MEILI_INDEX_ARTICLES，默认 "articles"）。
 * 原来的条件是「synced_at 比本次运行早，或者没有 synced_at」—— 英文站跑一次
 * 每周全量，只写入英文文档，然后把「比本次运行早」的全删掉，**那就是中文站
 * 那一万六千条**。中文站的搜索会被清空，直到一周后它自己的全量同步跑完。
 *
 * 加上语言限定之后，每个站只扫自己的那一份。
 *
 * ## 为什么还要 NOT EXISTS
 *
 * 只按 synced_at 判断会静默跳过这个字段出现之前写进去的文档 —— 有一条孤儿
 * 就是这样活过了一次「报告删除了 0 条」的全量同步的。
 *
 * ## 为什么不用 IN
 *
 * 展开成 OR 链，而不是 `locale IN [...]`：OR 在所有版本的 Meilisearch 上都
 * 认，而一个过滤语法上的意外在这里的后果是删错东西。
 */
export function staleSweepFilter(locales: readonly string[], runStartedAt: number): string {
  /* 空列表会展开成 `() AND (...)`，那是个语法错误；但万一哪天 Meilisearch
     把它当成「全部匹配」，这一扫就会删光整个索引。在这里拦住。 */
  if (locales.length === 0) throw new Error("staleSweepFilter：没有给语言，拒绝生成清理条件");
  const mine = locales.map((l) => `locale = "${l}"`).join(" OR ");
  const stale = `synced_at < ${runStartedAt} OR synced_at NOT EXISTS`;
  return `(${mine}) AND (${stale})`;
}

/**
 * Pushes content into the index.
 *
 * Paginates by key (`id > cursor`) rather than OFFSET: OFFSET makes Postgres walk
 * every skipped row, and this sync died of a statement timeout around row 7,500
 * every time it ran -- which is why the index held 10,000 of 15,515 articles and
 * had not moved since August.
 */
export async function syncSearchIndex(options: SyncOptions): Promise<SyncResult> {
  const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false }
  });
  const { index } = meiliConfig();
  const batchSize = options.batchSize ?? 300;

  await ensureIndex();
  if (options.reset) {
    const cleared = await meiliRequest<{ taskUid: number }>(
      "DELETE",
      `/indexes/${encodeURIComponent(index)}/documents`
    );
    await waitForTask(cleared.taskUid);
  }

  const byType: Record<SearchDocType, number> = { article: 0, video: 0, material: 0 };
  let lastTaskUid: number | null = null;
  // Stamped onto every document this run writes; the sweep below uses it.
  const runStartedAt = Date.now();

  for (const source of SOURCES) {
    let cursor: string | null = null;
    while (true) {
      /* locale-ok: 下面按 source.localeFiltered 加 .in("locale", options.locales)，
         三张表现在都是 true。 */
      let query = supabase
        .from(source.table)
        .select(source.select)
        .order("id", { ascending: true })
        .limit(batchSize);
      if (source.localeFiltered) query = query.in("locale", options.locales);
      if (options.since) query = query.gte("updated_at", options.since);
      if (cursor) query = query.gt("id", cursor);

      const { data, error } = await query;
      if (error) throw error;
      const rows = (data ?? []) as unknown as Record<string, unknown>[];
      if (rows.length === 0) break;

      const documents = rows
        .map((row) => toSearchDocument(source.type, row, runStartedAt))
        .filter((doc): doc is SearchDocument => doc !== null);

      if (documents.length > 0) {
        const task = await meiliRequest<{ taskUid: number }>(
          "POST",
          `/indexes/${encodeURIComponent(index)}/documents`,
          documents
        );
        lastTaskUid = task.taskUid;
        byType[source.type] += documents.length;
      }

      cursor = String(rows[rows.length - 1].id);
      if (rows.length < batchSize) break;
    }
  }

  if (lastTaskUid !== null) await waitForTask(lastTaskUid);

  /*
   * Sweep away documents this pass did not touch.
   *
   * Only on a full pass: an incremental pass visits a few recent rows, so every
   * other document legitimately carries an older stamp and deleting them would
   * empty the index.
   *
   * This, not the upserts, is what makes a full sync authoritative -- rows
   * deleted straight from the database never reach the save-time hook, and
   * without this sweep the index keeps serving them until somebody notices a
   * search result leading to a 404.
   */
  let removed = 0;
  if (!options.since) {
    const sweep = await meiliRequest<{ taskUid: number }>(
      "POST",
      `/indexes/${encodeURIComponent(index)}/documents/delete`,
      { filter: staleSweepFilter(options.locales, runStartedAt) }
    );
    await waitForTask(sweep.taskUid);
    const task = await meiliRequest<{ details?: { deletedDocuments?: number } }>(
      "GET",
      `/tasks/${sweep.taskUid}`
    );
    removed = task.details?.deletedDocuments ?? 0;
  }

  return {
    total: byType.article + byType.video + byType.material,
    byType,
    removed,
    index
  };
}

/**
 * Indexes one piece of content immediately, or removes it.
 *
 * Called when an editor saves. Unpublished and deleted rows are deleted from the
 * index rather than left behind: a search result that 404s is worse than one
 * that is missing, and "it will be gone after the next full sync" is how an
 * index starts lying.
 *
 * Never throws. Saving an article must not fail because a search service is
 * unreachable; the cron and the full sync are there to repair whatever this
 * misses, and the dashboard shows when the two have drifted apart.
 */
export async function indexOneDocument(
  type: SearchDocType,
  row: Record<string, unknown> | null,
  id?: string
): Promise<void> {
  try {
    if (!process.env.MEILI_HOST) return;
    const { index } = meiliConfig();

    const doc = row ? toSearchDocument(type, row) : null;
    const shouldRemove = !doc || doc.status !== "published";
    const targetId = doc?.id ?? (id ? docId(type, id) : null);
    if (!targetId) return;

    if (shouldRemove) {
      await meiliRequest(
        "DELETE",
        `/indexes/${encodeURIComponent(index)}/documents/${encodeURIComponent(targetId)}`
      );
      return;
    }
    await meiliRequest("POST", `/indexes/${encodeURIComponent(index)}/documents`, [doc]);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`[search-index] failed to index ${type} ${id ?? ""}`, error);
  }
}

/**
 * Re-reads one row and brings the index in line with it.
 *
 * Callers pass an id, not a row: the write paths each hold a differently-shaped
 * record, and a search document assembled from whichever columns a particular
 * caller happened to select is how the index quietly ends up with half-filled
 * documents. One extra read per save is a small price for every document in the
 * index having come from the same query.
 *
 * A row that is gone, or no longer published, is removed from the index.
 *
 * Never throws, and never awaited by the save path: if Meilisearch is down, the
 * editor's save still succeeds and the hourly sync repairs the gap.
 */
export async function indexContentById(type: SearchDocType, id: string): Promise<void> {
  try {
    if (!process.env.MEILI_HOST || !id) return;
    const source = SOURCES.find((entry) => entry.type === type);
    if (!source) return;

    const supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } }
    );
    /* locale-ok: 按 id 查（uuid 全局唯一）—— 单条内容保存时立即进索引那条路。 */
    const { data, error } = await supabase
      .from(source.table)
      .select(source.select)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;

    await indexOneDocument(type, (data as Record<string, unknown> | null) ?? null, id);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`[search-index] indexContentById failed for ${type} ${id}`, error);
  }
}

/** Several ids at once, for the bulk publish/archive actions. */
export async function indexContentByIds(type: SearchDocType, ids: string[]): Promise<void> {
  for (const id of ids) await indexContentById(type, id);
}
