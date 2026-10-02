import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";

/**
 * 真相点资料 — the downloadable materials.
 *
 * The third content type, after articles and videos, and deliberately the same
 * shape as the second: a record, a category map with `position` 0 marking the
 * primary one, and a status. See `video-repository.ts`, which this mirrors.
 *
 * What differs is the payload. A material is a preview image plus a set of
 * files, not prose -- so `files` is an ordered list on the record rather than a
 * body an editor writes.
 *
 * Every read degrades to "not ready" rather than throwing when the tables are
 * missing, so the admin renders a "run the migration" notice instead of a 500.
 */

export interface MaterialCategoryRecord {
  id: string;
  slug: string;
  name: string;
  summary: string;
  sortOrder: number;
  /** Published materials filed under it. */
  count: number;
}

export interface MaterialFile {
  label: string;
  url: string;
  kind: string;
}

export interface MaterialListRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  coverImage: string;
  status: string;
  featured: boolean;
  fileCount: number;
  categories: string[];
  publishedAt: string | null;
  updatedAt: string;
}

export interface MaterialRecord {
  id: string;
  slug: string;
  title: string;
  summary: string;
  bodyMarkdown: string;
  coverImage: string;
  coverImageAlt: string;
  files: MaterialFile[];
  status: string;
  featured: boolean;
  publishedAt: string | null;
  legacyUrl: string;
  categoryIds: string[];
}

function missingTable(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const message = `${error.code ?? ""} ${error.message ?? ""}`;
  return message.includes("cms_material") && (message.includes("does not exist") || message.includes("42P01") || message.includes("PGRST205"));
}

function asFiles(value: unknown): MaterialFile[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
    .map((row) => ({
      label: typeof row.label === "string" ? row.label : "",
      url: typeof row.url === "string" ? row.url : "",
      kind: typeof row.kind === "string" ? row.kind : ""
    }))
    .filter((row) => row.label || row.url);
}

export async function listMaterialCategories(): Promise<{ ready: boolean; rows: MaterialCategoryRecord[] }> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cms_material_categories")
    .select("id, slug, name, summary, sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    if (missingTable(error)) return { ready: false, rows: [] };
    throw error;
  }

  // Counts come from the map rather than from a stored number, which is the
  // whole point of moving these off the hand-written page.
  const { data: mapRows, error: mapError } = await supabase
    .from("cms_material_category_map")
    .select("category_id, cms_materials!inner(status)")
    .eq("cms_materials.status", "published");
  if (mapError && !missingTable(mapError)) throw mapError;

  const counts = new Map<string, number>();
  for (const row of mapRows ?? []) {
    const id = String((row as Record<string, unknown>).category_id);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return {
    ready: true,
    rows: (data ?? []).map((row) => ({
      id: String(row.id),
      slug: String(row.slug),
      name: String(row.name),
      summary: String(row.summary ?? ""),
      sortOrder: Number(row.sort_order ?? 0),
      count: counts.get(String(row.id)) ?? 0
    }))
  };
}

export interface MaterialSearchFilters {
  q?: string;
  category?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export async function searchMaterials(filters: MaterialSearchFilters): Promise<{
  ready: boolean;
  rows: MaterialListRow[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const supabase = createSupabaseAdminClient();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, filters.pageSize ?? 20));

  let query = supabase
    .from("cms_materials")
    .select(
      "id, slug, title, summary, cover_image, status, featured, files, published_at, updated_at, cms_material_category_map(position, cms_material_categories(id, slug, name))",
      { count: "exact" }
    );

  if (filters.q?.trim()) {
    const term = `%${filters.q.trim()}%`;
    query = query.or(`title.ilike.${term},summary.ilike.${term},slug.ilike.${term}`);
  }
  if (filters.status) query = query.eq("status", filters.status);

  const { data, error, count } = await query
    .order("published_at", { ascending: false, nullsFirst: false })
    // A tiebreaker, because the import writes a whole batch on one timestamp
    // and without this the pager repeats and drops rows. Same fix as articles.
    .order("id", { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) {
    if (missingTable(error)) return { ready: false, rows: [], total: 0, page, pageSize };
    throw error;
  }

  let rows: MaterialListRow[] = (data ?? []).map((row) => {
    const maps = Array.isArray(row.cms_material_category_map) ? row.cms_material_category_map : [];
    return {
      id: String(row.id),
      slug: String(row.slug),
      title: String(row.title),
      summary: String(row.summary ?? ""),
      coverImage: String(row.cover_image ?? ""),
      status: String(row.status),
      featured: Boolean(row.featured),
      fileCount: asFiles(row.files).length,
      categories: maps
        .map((m) => (m as Record<string, { name?: string } | undefined>).cms_material_categories?.name ?? "")
        .filter(Boolean),
      publishedAt: row.published_at ? String(row.published_at) : null,
      updatedAt: String(row.updated_at)
    };
  });

  // Filtering by category name after the fetch: PostgREST cannot filter the
  // parent by an embedded row's value without an inner join that would also
  // drop materials filed under nothing.
  if (filters.category) {
    rows = rows.filter((row) => row.categories.includes(filters.category as string));
  }

  return { ready: true, rows, total: count ?? rows.length, page, pageSize };
}

export async function getMaterial(id: string): Promise<MaterialRecord | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cms_materials")
    .select(
      "id, slug, title, summary, body_markdown, cover_image, cover_image_alt, files, status, featured, published_at, legacy_url, cms_material_category_map(category_id, position)"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (missingTable(error)) return null;
    throw error;
  }
  if (!data) return null;

  const maps = Array.isArray(data.cms_material_category_map) ? data.cms_material_category_map : [];
  return {
    id: String(data.id),
    slug: String(data.slug),
    title: String(data.title),
    summary: String(data.summary ?? ""),
    bodyMarkdown: String(data.body_markdown ?? ""),
    coverImage: String(data.cover_image ?? ""),
    coverImageAlt: String(data.cover_image_alt ?? ""),
    files: asFiles(data.files),
    status: String(data.status),
    featured: Boolean(data.featured),
    publishedAt: data.published_at ? String(data.published_at) : null,
    legacyUrl: String(data.legacy_url ?? ""),
    categoryIds: maps
      .slice()
      .sort((a, b) => Number((a as { position?: number }).position ?? 0) - Number((b as { position?: number }).position ?? 0))
      .map((m) => String((m as { category_id?: string }).category_id ?? ""))
      .filter(Boolean)
  };
}

export interface MaterialInput {
  id?: string;
  slug: string;
  title: string;
  summary: string;
  bodyMarkdown: string;
  coverImage: string;
  coverImageAlt: string;
  files: MaterialFile[];
  status: string;
  featured: boolean;
  publishedAt?: string | null;
  categoryIds: string[];
}

export async function saveMaterial(input: MaterialInput): Promise<string> {
  const supabase = createSupabaseAdminClient();

  const row: Record<string, unknown> = {
    slug: input.slug,
    title: input.title,
    summary: input.summary,
    body_markdown: input.bodyMarkdown,
    cover_image: input.coverImage,
    cover_image_alt: input.coverImageAlt,
    files: input.files,
    status: input.status,
    featured: input.featured,
    updated_at: new Date().toISOString()
  };
  // Publishing stamps a date once; re-saving a published material keeps the
  // original, so an edit does not reorder the public listing.
  if (input.publishedAt !== undefined) row.published_at = input.publishedAt;
  else if (input.status === "published") row.published_at = new Date().toISOString();

  let id = input.id;
  if (id) {
    const { error } = await supabase.from("cms_materials").update(row).eq("id", id);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from("cms_materials").insert(row).select("id").single();
    if (error) throw error;
    id = String(data.id);
  }

  await supabase.from("cms_material_category_map").delete().eq("material_id", id);
  if (input.categoryIds.length > 0) {
    const { error } = await supabase.from("cms_material_category_map").insert(
      input.categoryIds.map((categoryId, index) => ({
        material_id: id,
        category_id: categoryId,
        position: index
      }))
    );
    if (error) throw error;
  }
  return id as string;
}

export async function deleteMaterial(id: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("cms_materials").delete().eq("id", id);
  if (error) throw error;
}

export async function upsertMaterialCategory(input: {
  id?: string;
  slug: string;
  name: string;
  summary: string;
  sortOrder: number;
}): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const row = { slug: input.slug, name: input.name, summary: input.summary, sort_order: input.sortOrder };
  if (input.id) {
    const { error } = await supabase.from("cms_material_categories").update(row).eq("id", input.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("cms_material_categories").insert(row);
    if (error) throw error;
  }
}

export async function deleteMaterialCategory(id: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("cms_material_categories").delete().eq("id", id);
  if (error) throw error;
}
