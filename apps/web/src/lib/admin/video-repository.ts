import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";

/**
 * Videos and their categories.
 *
 * Mirrors the article side deliberately: same category shape, same `position 0
 * is primary` rule, same graceful degradation while 012 has not been applied by
 * hand. Anything that behaves differently here would be a surprise, not a
 * feature.
 */

export interface VideoCategoryRecord {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  videoCount: number;
}

export interface VideoListRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: string;
  durationSeconds: number | null;
  sourceUrl: string;
  coverImage: string;
  category: string;
  publishedAt: string | null;
  updatedAt: string;
  featured: boolean;
  editorArchive: boolean;
  createdBy: string;
  updatedBy: string;
}

function missing(error: unknown, ...names: string[]): boolean {
  const text = JSON.stringify(error ?? "");
  return names.some((name) => text.includes(name));
}

export async function listVideoCategories(): Promise<VideoCategoryRecord[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cms_video_categories")
    .select("id, slug, name, sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  // Before 012 the tables do not exist; the admin should say so, not crash.
  if (error) return [];

  const rows = (data ?? []) as { id: string; slug: string; name: string; sort_order: number }[];
  const counts = await Promise.all(
    rows.map(async (row) => {
      const { count } = await supabase
        .from("cms_video_category_map")
        .select("video_id", { count: "exact", head: true })
        .eq("category_id", row.id);
      return count ?? 0;
    })
  );

  return rows.map((row, index) => ({
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    sortOrder: Number(row.sort_order ?? 0),
    videoCount: counts[index]
  }));
}

export async function upsertVideoCategory(
  input: { id?: string; name: string; slug?: string; sortOrder?: number }
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const name = input.name.trim();
  const explicit = input.slug?.trim().toLowerCase();
  // Same rule as article categories: the slug is a URL, so it stays latin.
  if (!explicit && !/[a-z0-9]/i.test(name)) {
    throw new Error("请为中文分类名填写英文 slug（用于网址）。");
  }
  const slug =
    explicit ||
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const payload: Record<string, unknown> = { slug, name };
  if (Number.isFinite(input.sortOrder)) payload.sort_order = Math.trunc(Number(input.sortOrder));

  const { error } = input.id?.trim()
    ? await supabase.from("cms_video_categories").update(payload).eq("id", input.id)
    : await supabase.from("cms_video_categories").insert(payload);
  if (error) throw error;
}

export async function deleteVideoCategory(id: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { count } = await supabase
    .from("cms_video_category_map")
    .select("video_id", { count: "exact", head: true })
    .eq("category_id", id);
  if ((count ?? 0) > 0) {
    throw new Error(`该分类下还有 ${count} 个视频，请先移走再删除。`);
  }
  const { error } = await supabase.from("cms_video_categories").delete().eq("id", id);
  if (error) throw error;
}

export type VideoSort = "published" | "updated" | "title" | "duration";

export interface VideoSearchFilters {
  q?: string;
  category?: string;
  status?: string;
  /** Where it plays from: youtube / ganjing / tuidang / file / none. */
  host?: string;
  gap?: "no-source" | "no-cover" | "no-description";
  /** 重要 / 精彩保留. Undefined means "do not filter on it". */
  featured?: boolean;
  editorArchive?: boolean;
  from?: string;
  to?: string;
  sort?: VideoSort;
  page?: number;
  pageSize?: number;
}

/** How a host filter maps onto the stored address. */
const HOST_PATTERNS: Record<string, { like?: string; empty?: boolean }> = {
  youtube: { like: "%youtu%" },
  ganjing: { like: "%ganjing%" },
  tuidang: { like: "%tuidang.org%" },
  file: { like: "%.mp4%" },
  none: { empty: true }
};

export async function searchVideos(filters: VideoSearchFilters): Promise<{
  rows: VideoListRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  ready: boolean;
}> {
  const supabase = createSupabaseAdminClient();
  const pageSize = Math.min(Math.max(filters.pageSize ?? 20, 1), 200);
  const page = Math.max(filters.page ?? 1, 1);
  const offset = (page - 1) * pageSize;

  const base = "id, slug, title, description, status, duration_seconds, updated_at";
  const extra = "source_url, cover_image, published_at";
  /**
   * The flags 016 adds plus the authorship 019 adds. They travel together so a
   * single retry covers either migration being absent.
   */
  const flags = "featured, editor_archive, created_by, updated_by";

  const run = async (select: string, withCategory: boolean, withFlags: boolean) => {
    let query = withCategory && filters.category
      ? supabase
          .from("cms_videos")
          .select(`${select}, cms_video_category_map!inner(cms_video_categories!inner(slug))`, {
            count: "exact"
          })
          .eq("cms_video_category_map.cms_video_categories.slug", filters.category)
      : supabase.from("cms_videos").select(select, { count: "exact" });
    if (filters.q?.trim()) {
      const term = filters.q.trim().replace(/[%,()]/g, " ");
      query = query.or(`title.ilike.%${term}%,slug.ilike.%${term}%`);
    }
    if (filters.status) query = query.eq("status", filters.status);
    if (withFlags) {
      if (filters.featured !== undefined) query = query.eq("featured", filters.featured);
      if (filters.editorArchive !== undefined) query = query.eq("editor_archive", filters.editorArchive);
    }

    const host = filters.host ? HOST_PATTERNS[filters.host] : undefined;
    if (host?.empty) query = query.eq("source_url", "");
    else if (host?.like) query = query.like("source_url", host.like);

    if (filters.from) query = query.gte("published_at", `${filters.from}T00:00:00Z`);
    if (filters.to) query = query.lte("published_at", `${filters.to}T23:59:59Z`);

    switch (filters.gap) {
      case "no-source":
        query = query.eq("source_url", "");
        break;
      case "no-cover":
        query = query.eq("cover_image", "");
        break;
      case "no-description":
        query = query.eq("description", "");
        break;
      default:
        break;
    }

    // Order by when the video was published, not when we imported it: the whole
    // library was written in one pass, so `updated_at` is the same timestamp on
    // all 745 rows. `id` underneath, or the order inside a group is arbitrary.
    if (!withCategory) {
      return query
        .order("updated_at", { ascending: false })
        .order("id", { ascending: true })
        .range(offset, offset + pageSize - 1);
    }
    const column =
      filters.sort === "updated"
        ? "updated_at"
        : filters.sort === "title"
          ? "title"
          : filters.sort === "duration"
            ? "duration_seconds"
            : "published_at";
    return query
      .order(column, { ascending: filters.sort === "title", nullsFirst: false })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
  };

  let result = await run(`${base}, ${extra}, ${flags}`, true, true);
  let hasFlags = true;
  // 016 or 019 not applied: drop those columns and the filters that read them.
  if (
    result.error &&
    missing(result.error, "featured", "editor_archive", "created_by", "updated_by")
  ) {
    hasFlags = false;
    result = await run(`${base}, ${extra}`, true, false);
  }
  let ready = true;
  if (result.error && missing(result.error, "source_url", "cover_image", "cms_video_category_map")) {
    ready = false;
    hasFlags = false;
    result = await run(base, false, false);
  }
  if (result.error) throw result.error;

  const rows = (result.data ?? []) as unknown as Record<string, unknown>[];
  const categoryByVideo = new Map<string, string>();
  if (ready && rows.length > 0) {
    const { data: mapRows } = await supabase
      .from("cms_video_category_map")
      .select("video_id, position, cms_video_categories(name)")
      .in("video_id", rows.map((row) => String(row.id)))
      .order("position", { ascending: true });
    for (const row of mapRows ?? []) {
      const videoId = String((row as { video_id: string }).video_id);
      if (categoryByVideo.has(videoId)) continue;
      const name = (row as { cms_video_categories?: { name?: string } }).cms_video_categories?.name;
      if (name) categoryByVideo.set(videoId, String(name));
    }
  }

  const total = result.count ?? 0;
  return {
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    ready,
    rows: rows.map((row) => ({
      id: String(row.id),
      slug: String(row.slug),
      title: String(row.title),
      description: String(row.description ?? ""),
      status: String(row.status),
      durationSeconds: row.duration_seconds ? Number(row.duration_seconds) : null,
      sourceUrl: String(row.source_url ?? ""),
      coverImage: String(row.cover_image ?? ""),
      category: categoryByVideo.get(String(row.id)) ?? "",
      publishedAt: row.published_at ? String(row.published_at) : null,
      updatedAt: String(row.updated_at),
      featured: hasFlags && row.featured === true,
      editorArchive: hasFlags && row.editor_archive === true,
      createdBy: hasFlags ? String(row.created_by ?? "") : "",
      updatedBy: hasFlags ? String(row.updated_by ?? "") : ""
    }))
  };
}


export interface VideoRecord {
  id: string;
  slug: string;
  title: string;
  episode: string;
  description: string;
  bodyMarkdown: string;
  sourceUrl: string;
  backupUrl: string;
  coverImage: string;
  coverImageAlt: string;
  speaker: string;
  sourceCredit: string;
  legacyUrl: string;
  status: string;
  publishedAt: string | null;
  category: string;
  featured: boolean;
  editorArchive: boolean;
}

const EDITABLE_BASE =
  "id, slug, title, description, status, duration_seconds, source_url, cover_image, published_at, " +
  "body_markdown, episode, speaker, source_credit, backup_url, cover_image_alt, legacy_url";
/** With the flags 016 adds. Asked for first; dropped if the migration has not run. */
const EDITABLE = `${EDITABLE_BASE}, featured, editor_archive`;

/** Postgres names only the first missing column, so both go together. */
function isMissingFlagColumn(error: unknown): boolean {
  return /featured|editor_archive|created_by|updated_by/.test(JSON.stringify(error ?? ""));
}

export async function getVideo(id: string): Promise<VideoRecord | null> {
  const supabase = createSupabaseAdminClient();
  let { data, error } = await supabase.from("cms_videos").select(EDITABLE).eq("id", id).maybeSingle();
  if (error && isMissingFlagColumn(error)) {
    // 016 has not been applied yet: read what exists and treat both as off.
    ({ data, error } = await supabase
      .from("cms_videos")
      .select(EDITABLE_BASE)
      .eq("id", id)
      .maybeSingle());
  }
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as Record<string, unknown>;

  const { data: mapRows } = await supabase
    .from("cms_video_category_map")
    .select("position, cms_video_categories(name)")
    .eq("video_id", id)
    .order("position", { ascending: true });
  const category =
    (mapRows ?? [])
      .map((entry) => (entry as { cms_video_categories?: { name?: string } }).cms_video_categories?.name)
      .find(Boolean) ?? "";

  return {
    id: String(row.id),
    slug: String(row.slug ?? ""),
    title: String(row.title ?? ""),
    episode: String(row.episode ?? ""),
    description: String(row.description ?? ""),
    bodyMarkdown: String(row.body_markdown ?? ""),
    sourceUrl: String(row.source_url ?? ""),
    backupUrl: String(row.backup_url ?? ""),
    coverImage: String(row.cover_image ?? ""),
    coverImageAlt: String(row.cover_image_alt ?? ""),
    speaker: String(row.speaker ?? ""),
    sourceCredit: String(row.source_credit ?? ""),
    legacyUrl: String(row.legacy_url ?? ""),
    status: String(row.status ?? "draft"),
    publishedAt: row.published_at ? String(row.published_at) : null,
    category: String(category),
    featured: row.featured === true,
    editorArchive: row.editor_archive === true
  };
}

export interface VideoInput {
  id?: string;
  slug: string;
  title: string;
  episode: string;
  description: string;
  bodyMarkdown: string;
  sourceUrl: string;
  backupUrl: string;
  coverImage: string;
  coverImageAlt: string;
  speaker: string;
  sourceCredit: string;
  status: string;
  publishedAt: string | null;
  category: string;
  featured: boolean;
  editorArchive: boolean;
}

export async function saveVideo(input: VideoInput, actorEmail: string): Promise<string> {
  const supabase = createSupabaseAdminClient();
  const payload = {
    slug: input.slug,
    title: input.title,
    episode: input.episode,
    description: input.description,
    body_markdown: input.bodyMarkdown,
    source_url: input.sourceUrl,
    backup_url: input.backupUrl,
    cover_image: input.coverImage,
    cover_image_alt: input.coverImageAlt,
    speaker: input.speaker,
    source_credit: input.sourceCredit,
    status: input.status,
    published_at: input.publishedAt,
    updated_at: new Date().toISOString()
  };
  // created_by is set once, at insert; an edit records the editor, not a new
  // creator. Folded into withFlags so the pre-migration fallback below drops it
  // along with the other columns a stale database does not have yet.
  const authorship: Record<string, string> = input.id?.trim()
    ? { updated_by: actorEmail }
    : { created_by: actorEmail, updated_by: actorEmail };
  const withFlags = {
    ...payload,
    featured: input.featured,
    editor_archive: input.editorArchive,
    ...authorship
  };

  let id = input.id?.trim() ?? "";
  if (id) {
    let { error } = await supabase.from("cms_videos").update(withFlags).eq("id", id);
    // Saving must not fail just because 016 has not been applied; everything
    // except the two flags is still written.
    if (error && isMissingFlagColumn(error)) {
      ({ error } = await supabase.from("cms_videos").update(payload).eq("id", id));
    }
    if (error) throw error;
  } else {
    let { data, error } = await supabase.from("cms_videos").insert(withFlags).select("id").single();
    if (error && isMissingFlagColumn(error)) {
      ({ data, error } = await supabase.from("cms_videos").insert(payload).select("id").single());
    }
    if (error) throw error;
    if (!data) throw new Error("保存失败：数据库没有返回新建视频的 id。");
    id = String(data.id);
  }

  if (input.category) {
    const { data: category } = await supabase
      .from("cms_video_categories")
      .select("id")
      .eq("name", input.category)
      .maybeSingle();
    if (category) {
      // Position 0 is the primary category, same rule as articles. Clearing it
      // first keeps a re-file from leaving the old one behind.
      await supabase.from("cms_video_category_map").delete().eq("video_id", id).eq("position", 0);
      await supabase
        .from("cms_video_category_map")
        .upsert(
          { video_id: id, category_id: category.id, position: 0 },
          { onConflict: "video_id,category_id" }
        );
    }
  }

  return id;
}

export async function deleteVideo(id: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("cms_videos").delete().eq("id", id);
  if (error) throw error;
}


/**
 * Re-files a batch of videos under one primary category.
 *
 * Mirrors the article bulk action: position 0 is the primary slot, so the old
 * one is removed along with any existing copy of the target before inserting,
 * or a video could end up holding the same category twice.
 */
export async function bulkSetVideoCategory(ids: string[], categoryName: string): Promise<number> {
  if (ids.length === 0 || !categoryName.trim()) return 0;
  const supabase = createSupabaseAdminClient();
  const { data: category } = await supabase
    .from("cms_video_categories")
    .select("id")
    .eq("name", categoryName)
    .maybeSingle();
  if (!category) throw new Error(`分类「${categoryName}」不存在。`);

  let changed = 0;
  for (let index = 0; index < ids.length; index += 100) {
    const slice = ids.slice(index, index + 100);
    await supabase.from("cms_video_category_map").delete().in("video_id", slice).eq("position", 0);
    await supabase
      .from("cms_video_category_map")
      .delete()
      .in("video_id", slice)
      .eq("category_id", category.id);
    const { error } = await supabase
      .from("cms_video_category_map")
      .insert(slice.map((id) => ({ video_id: id, category_id: category.id, position: 0 })));
    if (error) throw error;
    changed += slice.length;
  }
  return changed;
}

export async function bulkSetVideoStatus(ids: string[], status: string): Promise<number> {
  if (ids.length === 0) return 0;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("cms_videos")
    .update({ status, updated_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw error;
  return ids.length;
}

/** The video holding a slug, if any -- excluding the one being edited. */
export async function findVideoBySlug(
  slug: string,
  exceptId?: string
): Promise<{ id: string; title: string } | null> {
  const supabase = createSupabaseAdminClient();
  let query = supabase.from("cms_videos").select("id, title").eq("slug", slug);
  if (exceptId) query = query.neq("id", exceptId);
  const { data } = await query.maybeSingle();
  return data ? { id: String(data.id), title: String(data.title) } : null;
}
