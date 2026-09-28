import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";

/**
 * Media library backed by Supabase Storage, indexed in `cms_media_assets`.
 *
 * Storage holds the bytes; the table holds the index so the picker can list
 * what exists without walking the bucket. Content JSON only ever stores the
 * resulting public URL, which keeps the CMS payloads portable.
 */

export interface MediaAsset {
  id: string;
  name: string;
  url: string;
  mimeType: string | null;
  byteSize: number | null;
  updatedAt: string;
}

export function storageBucketName(): string {
  return (
    process.env.SUPABASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ||
    ""
  ).trim();
}

async function audit(
  actorEmail: string,
  action: string,
  targetId: string,
  accessMode: "read" | "write",
  detail: Record<string, unknown> = {}
) {
  const supabase = createSupabaseAdminClient();
  try {
    await supabase.from("cms_audit_logs").insert({
      actor_email: actorEmail,
      action,
      target_type: "media",
      target_id: targetId,
      access_mode: accessMode,
      detail
    });
  } catch {
    // Auditing must never break an upload.
  }
}

export async function recordUploadedAsset(
  input: { name: string; url: string; mimeType: string; byteSize: number },
  actorEmail: string
): Promise<MediaAsset> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cms_media_assets")
    .insert({
      asset_type: "image",
      name: input.name,
      storage_path: input.url,
      mime_type: input.mimeType,
      byte_size: input.byteSize,
      metadata: { uploadedBy: actorEmail }
    })
    .select("id, name, storage_path, mime_type, byte_size, updated_at")
    .single();
  if (error) throw error;

  await audit(actorEmail, "media.upload", String(data.id), "write", { name: input.name });

  return {
    id: String(data.id),
    name: String(data.name),
    url: String(data.storage_path),
    mimeType: data.mime_type ? String(data.mime_type) : null,
    byteSize: data.byte_size ? Number(data.byte_size) : null,
    updatedAt: String(data.updated_at)
  };
}

export async function listImageAssets(actorEmail: string, limit = 200): Promise<MediaAsset[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cms_media_assets")
    .select("id, name, storage_path, mime_type, byte_size, updated_at")
    .eq("asset_type", "image")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  await audit(actorEmail, "media.list", "all", "read", { returned: (data ?? []).length });

  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    url: String(row.storage_path),
    mimeType: row.mime_type ? String(row.mime_type) : null,
    byteSize: row.byte_size ? Number(row.byte_size) : null,
    updatedAt: String(row.updated_at)
  }));
}

export async function deleteImageAsset(id: string, actorEmail: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cms_media_assets")
    .select("id, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Asset not found");

  // Remove the object too, otherwise the bucket accumulates orphans that
  // nothing can ever reference again.
  const bucket = storageBucketName();
  if (bucket) {
    const url = String(data.storage_path);
    const marker = `/object/public/${bucket}/`;
    const at = url.indexOf(marker);
    if (at !== -1) {
      const objectPath = decodeURIComponent(url.slice(at + marker.length));
      try {
        await supabase.storage.from(bucket).remove([objectPath]);
      } catch {
        // Fall through: the index row still goes, which is what the UI shows.
      }
    }
  }

  const { error: deleteError } = await supabase.from("cms_media_assets").delete().eq("id", id);
  if (deleteError) throw deleteError;

  await audit(actorEmail, "media.delete", id, "write");
}
