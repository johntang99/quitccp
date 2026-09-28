import {
  pageRouteToContentPath,
  prototypePageContentSeeds,
  sharedContentPaths,
  type PageContentContractSeed
} from "@quitccp/content-schema";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";

export interface ContentFileItem {
  path: string;
  label: string;
  locale: string;
  section: string;
  slug: string;
  template: string;
  updatedAt?: string;
  hasRecord: boolean;
}

export interface ContentFileRecord {
  id: string;
  locale: string;
  path: string;
  data: Record<string, unknown>;
  updatedBy?: string;
  updatedAt: string;
}

export interface ContentRevisionRecord {
  id: string;
  entryId: string;
  locale: string;
  path: string;
  data: Record<string, unknown>;
  createdBy: string;
  note?: string;
  createdAt: string;
}

const metadataByPath = new Map<string, PageContentContractSeed>(
  prototypePageContentSeeds.map((seed) => [seed.path, seed])
);

function isMissingContentTableError(error: unknown): boolean {
  const text = typeof error === "object" && error !== null ? JSON.stringify(error) : String(error);
  return (
    (text.includes("cms_content_entries") || text.includes("cms_content_revisions")) &&
    (text.includes("schema cache") || text.includes("does not exist") || text.includes("42P01"))
  );
}

function throwMissingContentTableError(error: unknown): never {
  if (isMissingContentTableError(error)) {
    throw new Error("cms_content_entries table is missing. Please apply migration 008_content_entries.sql first.");
  }
  throw error;
}

function sharedPathToLabel(path: string) {
  switch (path) {
    case "header.json":
      return "Header";
    case "footer.json":
      return "Footer";
    case "seo.json":
      return "SEO";
    case "theme.json":
      return "Theme";
    case "site.json":
      return "Site";
    case "navigation.json":
      return "Navigation";
    default:
      return path;
  }
}

function toContentLabel(path: string) {
  const seed = metadataByPath.get(path);
  if (seed) {
    return `${seed.section}/${seed.slug} - ${seed.title}`;
  }
  if (sharedContentPaths.includes(path as (typeof sharedContentPaths)[number])) {
    return sharedPathToLabel(path);
  }
  return path;
}

function toContentFileItem(
  locale: string,
  path: string,
  row?: { updated_at?: string | null; data?: unknown }
): ContentFileItem {
  const seed = metadataByPath.get(path);
  return {
    path,
    label: toContentLabel(path),
    locale,
    section: seed?.section ?? "shared",
    slug: seed?.slug ?? path.replace(/\.json$/, ""),
    template: seed?.template ?? "shared",
    updatedAt: row?.updated_at ? String(row.updated_at) : undefined,
    hasRecord: Boolean(row)
  };
}

async function createAudit(
  actorEmail: string,
  action: string,
  targetType: string,
  targetId: string,
  accessMode: "read" | "write",
  detail: Record<string, unknown> = {}
) {
  const supabase = createSupabaseAdminClient();
  await supabase.from("cms_audit_logs").insert({
    actor_email: actorEmail,
    action,
    target_type: targetType,
    target_id: targetId,
    access_mode: accessMode,
    detail
  });
}

function parseObject(input: unknown): Record<string, unknown> {
  if (typeof input === "object" && input !== null && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  return {};
}

export function getContentPathForRoute(section: string, slug: string) {
  return pageRouteToContentPath(section, slug);
}

export async function listContentFiles(locale: string, actorEmail: string): Promise<ContentFileItem[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cms_content_entries")
    .select("path, updated_at, data")
    .eq("locale", locale)
    .order("path");
  if (error && !isMissingContentTableError(error)) throw error;

  const rowByPath = new Map<string, { path: string; updated_at?: string | null; data?: unknown }>();
  if (!error) {
    for (const row of data ?? []) {
      rowByPath.set(String(row.path), {
        path: String(row.path),
        updated_at: row.updated_at ? String(row.updated_at) : null,
        data: row.data
      });
    }
  }

  for (const path of sharedContentPaths) {
    if (!rowByPath.has(path)) rowByPath.set(path, { path });
  }
  for (const seed of prototypePageContentSeeds) {
    if (!rowByPath.has(seed.path)) rowByPath.set(seed.path, { path: seed.path });
  }

  const rows = [...rowByPath.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, row]) => toContentFileItem(locale, path, row));

  await createAudit(actorEmail, "content.file.list", "content_file", `locale:${locale}`, "read", {
    count: rows.length
  });

  return rows;
}

export async function getContentFileByPath(
  locale: string,
  path: string,
  actorEmail: string
): Promise<ContentFileRecord | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cms_content_entries")
    .select("id, locale, path, data, updated_by, updated_at")
    .eq("locale", locale)
    .eq("path", path)
    .maybeSingle();
  if (error) {
    if (!isMissingContentTableError(error)) throw error;
    const fallbackSeed = metadataByPath.get(path);
    if (!fallbackSeed) return null;
    return {
      id: "",
      locale,
      path,
      data: parseObject(fallbackSeed.data),
      updatedAt: new Date(0).toISOString(),
      updatedBy: undefined
    };
  }

  if (!data) {
    const fallbackSeed = metadataByPath.get(path);
    if (!fallbackSeed) return null;
    await createAudit(actorEmail, "content.file.get", "content_file", `${locale}:${path}`, "read", {
      source: "seed_fallback"
    });
    return {
      id: "",
      locale,
      path,
      data: parseObject(fallbackSeed.data),
      updatedAt: new Date(0).toISOString(),
      updatedBy: undefined
    };
  }

  await createAudit(actorEmail, "content.file.get", "content_file", `${locale}:${path}`, "read");
  return {
    id: String(data.id),
    locale: String(data.locale),
    path: String(data.path),
    data: parseObject(data.data),
    updatedBy: data.updated_by ? String(data.updated_by) : undefined,
    updatedAt: String(data.updated_at)
  };
}

async function insertContentRevision(
  entryId: string,
  locale: string,
  path: string,
  data: Record<string, unknown>,
  actorEmail: string,
  note?: string
) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("cms_content_revisions").insert({
    entry_id: entryId,
    locale,
    path,
    data,
    created_by: actorEmail,
    note: note ?? null
  });
  if (error) throwMissingContentTableError(error);
}

export async function upsertContentFile(
  locale: string,
  path: string,
  data: Record<string, unknown>,
  actorEmail: string,
  note?: string
): Promise<ContentFileRecord> {
  const supabase = createSupabaseAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from("cms_content_entries")
    .select("id, data")
    .eq("locale", locale)
    .eq("path", path)
    .maybeSingle();
  if (existingError) throwMissingContentTableError(existingError);

  if (existing?.id) {
    await insertContentRevision(String(existing.id), locale, path, parseObject(existing.data), actorEmail, note);
  }

  const { data: row, error } = await supabase
    .from("cms_content_entries")
    .upsert(
      {
        locale,
        path,
        data,
        updated_by: actorEmail
      },
      { onConflict: "locale,path" }
    )
    .select("id, locale, path, data, updated_by, updated_at")
    .single();

  if (error) throwMissingContentTableError(error);

  await createAudit(actorEmail, "content.file.upsert", "content_file", `${locale}:${path}`, "write", {
    note: note ?? null
  });

  return {
    id: String(row.id),
    locale: String(row.locale),
    path: String(row.path),
    data: parseObject(row.data),
    updatedBy: row.updated_by ? String(row.updated_by) : undefined,
    updatedAt: String(row.updated_at)
  };
}

export async function deleteContentFile(locale: string, path: string, actorEmail: string) {
  const supabase = createSupabaseAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("cms_content_entries")
    .select("id, data")
    .eq("locale", locale)
    .eq("path", path)
    .maybeSingle();
  if (existingError) throwMissingContentTableError(existingError);

  if (existing?.id) {
    await insertContentRevision(
      String(existing.id),
      locale,
      path,
      parseObject(existing.data),
      actorEmail,
      "deleted"
    );
  }

  const { error } = await supabase.from("cms_content_entries").delete().eq("locale", locale).eq("path", path);
  if (error) throwMissingContentTableError(error);

  await createAudit(actorEmail, "content.file.delete", "content_file", `${locale}:${path}`, "write");
}

export async function listContentRevisions(
  locale: string,
  path: string,
  actorEmail: string,
  limit = 20
): Promise<ContentRevisionRecord[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cms_content_revisions")
    .select("id, entry_id, locale, path, data, created_by, note, created_at")
    .eq("locale", locale)
    .eq("path", path)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throwMissingContentTableError(error);

  await createAudit(actorEmail, "content.revision.list", "content_file", `${locale}:${path}`, "read", { limit });
  return (data ?? []).map((row) => ({
    id: String(row.id),
    entryId: String(row.entry_id),
    locale: String(row.locale),
    path: String(row.path),
    data: parseObject(row.data),
    createdBy: String(row.created_by),
    note: row.note ? String(row.note) : undefined,
    createdAt: String(row.created_at)
  }));
}

export async function restoreContentRevision(revisionId: string, actorEmail: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cms_content_revisions")
    .select("id, entry_id, locale, path, data")
    .eq("id", revisionId)
    .single();
  if (error) throwMissingContentTableError(error);

  await upsertContentFile(
    String(data.locale),
    String(data.path),
    parseObject(data.data),
    actorEmail,
    `restore:${revisionId}`
  );
  await createAudit(
    actorEmail,
    "content.revision.restore",
    "content_file",
    `${String(data.locale)}:${String(data.path)}`,
    "write",
    { revisionId }
  );
}

export async function exportContentEntries(locale: string, actorEmail: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cms_content_entries")
    .select("path, data, updated_at")
    .eq("locale", locale)
    .order("path");
  if (error) throwMissingContentTableError(error);

  await createAudit(actorEmail, "content.export", "content_file", `locale:${locale}`, "read", {
    count: data?.length ?? 0
  });

  return (data ?? []).map((row) => ({
    path: String(row.path),
    data: parseObject(row.data),
    updatedAt: row.updated_at ? String(row.updated_at) : null
  }));
}

export async function importPrototypeContent(locale: string, actorEmail: string, overwrite = false) {
  const supabase = createSupabaseAdminClient();
  const { data: existingRows, error } = await supabase
    .from("cms_content_entries")
    .select("path")
    .eq("locale", locale);
  if (error) throwMissingContentTableError(error);

  const existing = new Set((existingRows ?? []).map((row) => String(row.path)));

  let imported = 0;
  let skipped = 0;
  for (const seed of prototypePageContentSeeds) {
    if (!overwrite && existing.has(seed.path)) {
      skipped += 1;
      continue;
    }
    await upsertContentFile(locale, seed.path, parseObject(seed.data), actorEmail, "prototype-seed");
    imported += 1;
  }

  for (const sharedPath of sharedContentPaths) {
    if (!overwrite && existing.has(sharedPath)) {
      skipped += 1;
      continue;
    }
    await upsertContentFile(
      locale,
      sharedPath,
      {
        meta: {
          scope: "shared",
          path: sharedPath
        }
      },
      actorEmail,
      "prototype-shared-seed"
    );
    imported += 1;
  }

  await createAudit(actorEmail, "content.import.prototype", "content_file", `locale:${locale}`, "write", {
    overwrite,
    imported,
    skipped
  });

  return { imported, skipped, total: prototypePageContentSeeds.length + sharedContentPaths.length };
}
