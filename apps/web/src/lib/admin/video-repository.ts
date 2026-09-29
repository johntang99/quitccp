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

export interface VideoSearchFilters {
  q?: string;
  category?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

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

  const run = async (select: string, withCategory: boolean) => {
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
    // Order by when the video was published, not when we imported it. The whole
    // library was written in one pass, so `updated_at` is the same timestamp on
    // all 745 rows and sorting by it produces an arbitrary order.
    return withCategory
      ? query
          .order("published_at", { ascending: false, nullsFirst: false })
          .range(offset, offset + pageSize - 1)
      : query.order("updated_at", { ascending: false }).range(offset, offset + pageSize - 1);
  };

  let result = await run(`${base}, ${extra}`, true);
  let ready = true;
  if (result.error && missing(result.error, "source_url", "cover_image", "cms_video_category_map")) {
    ready = false;
    result = await run(base, false);
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
      updatedAt: String(row.updated_at)
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
}

const EDITABLE =
  "id, slug, title, description, status, duration_seconds, source_url, cover_image, published_at, " +
  "body_markdown, episode, speaker, source_credit, backup_url, cover_image_alt, legacy_url";

export async function getVideo(id: string): Promise<VideoRecord | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("cms_videos").select(EDITABLE).eq("id", id).maybeSingle();
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
    category: String(category)
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
}

export async function saveVideo(input: VideoInput): Promise<string> {
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

  let id = input.id?.trim() ?? "";
  if (id) {
    const { error } = await supabase.from("cms_videos").update(payload).eq("id", id);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from("cms_videos").insert(payload).select("id").single();
    if (error) throw error;
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
