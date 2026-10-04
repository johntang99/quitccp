import { createClient } from "@supabase/supabase-js";

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
}

export const INDEX_SETTINGS = {
  searchableAttributes: ["title", "summary", "body"],
  filterableAttributes: ["locale", "status", "type"],
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
  row: Record<string, unknown>
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
    // cms_videos has no locale column. Every video on this site is Chinese, and
    // the search filters on locale, so an absent value would hide all of them.
    locale: String(row.locale ?? "zh"),
    status: String(row.status ?? "draft"),
    published_at: row.published_at ? String(row.published_at) : null
  };
}

interface TypeSource {
  type: SearchDocType;
  table: string;
  select: string;
  /** Materials and articles are per-locale; videos are not. */
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
    select: "id, slug, title, description, body_markdown, status, published_at",
    localeFiltered: false
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
  index: string;
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

  for (const source of SOURCES) {
    let cursor: string | null = null;
    while (true) {
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
        .map((row) => toSearchDocument(source.type, row))
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

  return {
    total: byType.article + byType.video + byType.material,
    byType,
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
