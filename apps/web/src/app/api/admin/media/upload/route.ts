import { NextResponse } from "next/server";
import { adminCanWrite, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { recordUploadedAsset, storageBucketName } from "@/lib/admin/media-storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";

/**
 * Uploads an image to Supabase Storage and records it in `cms_media_assets`,
 * returning the public URL for the editor to drop into a content field.
 *
 * Follows the pattern already proven on the clinic sites: storage holds the
 * bytes, the table holds the index, and the CMS JSON only ever stores a URL.
 */

const MAX_UPLOAD_MB = 5;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

function sanitizeFolder(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9/_-]/g, "").replace(/^\/+|\/+$/g, "");
  if (!cleaned) return "general";
  // Reject any attempt to climb out of the prefix.
  if (cleaned.split("/").some((part) => part === "..")) return "general";
  return cleaned;
}

function sanitizeFilename(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || `upload-${Date.now()}`;
}

export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminCanWrite(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    requireAdminMfa(user);
  } catch {
    return NextResponse.json({ error: "MFA required" }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Expected a multipart upload" }, { status: 415 });
  }

  const bucket = storageBucketName();
  if (!bucket) {
    // Vercel's filesystem is read-only, so there is no local-disk fallback to
    // offer here: without a bucket the feature simply cannot work.
    return NextResponse.json(
      { error: "未配置 SUPABASE_STORAGE_BUCKET，无法上传图片。" },
      { status: 501 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const folder = sanitizeFolder(String(formData.get("folder") ?? "general"));

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少文件。" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: `不支持的文件类型：${file.type || "未知"}。仅支持 JPEG/PNG/WebP/GIF/AVIF。` },
      { status: 400 }
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `文件过大，请上传小于 ${MAX_UPLOAD_MB}MB 的图片。` },
      { status: 400 }
    );
  }

  const objectPath = `${folder}/${Date.now()}-${sanitizeFilename(file.name)}`;

  try {
    const supabase = createSupabaseAdminClient();
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(objectPath, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type,
        cacheControl: "3600",
        upsert: true
      });
    if (uploadError) {
      return NextResponse.json({ error: `上传失败：${uploadError.message}` }, { status: 500 });
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    const url = data.publicUrl;

    await recordUploadedAsset(
      { name: file.name, url, mimeType: file.type, byteSize: file.size },
      user.email
    );

    return NextResponse.json({ url, path: objectPath, name: file.name }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "上传失败。" },
      { status: 500 }
    );
  }
}
