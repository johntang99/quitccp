import { NextResponse } from "next/server";
import { adminCanWrite, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { recordUploadedAsset, storageBucketName } from "@/lib/admin/media-storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { downloadUrlFor, extensionOf } from "@/lib/admin/upload-policy";

/** Images stay images; everything else is a download. */
function assetTypeFor(filename: string): string {
  const extension = extensionOf(filename);
  if (["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(extension)) return "image";
  // Video is played, not saved. Typed as a file it was handed back a
  // `?download=` URL, which makes Storage answer with
  // `content-disposition: attachment` -- so the hero backdrop was being served
  // as a download, and opening the address in a browser saved the file instead
  // of showing it.
  if (["mp4", "webm"].includes(extension)) return "video";
  return "file";
}

/**
 * Records an upload in `cms_media_assets` after the browser has put it in
 * Storage, so the media library knows about it and it can be deleted later.
 *
 * The object is verified to exist before a row is written: the client reports
 * the path, and a client that is wrong -- or lying -- would otherwise leave an
 * index row pointing at nothing.
 */
export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminCanWrite(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // Throws when MFA is required but the session never passed a TOTP check.
  // Uncaught it surfaces as a bare 500, which tells an editor nothing.
  try {
    requireAdminMfa(user);
  } catch {
    return NextResponse.json({ error: "需要通过两步验证后才能上传或保存。" }, { status: 403 });
  }

  const bucket = storageBucketName();
  if (!bucket) return NextResponse.json({ error: "未配置 SUPABASE_STORAGE_BUCKET。" }, { status: 501 });

  let body: { path?: string; name?: string; contentType?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误。" }, { status: 400 });
  }

  const path = String(body.path ?? "").trim();
  if (!path || path.includes("..")) return NextResponse.json({ error: "缺少文件路径。" }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  const base = path.slice(path.lastIndexOf("/") + 1);
  const { data: listed, error: listError } = await supabase.storage
    .from(bucket)
    .list(folder, { search: base, limit: 1 });
  if (listError) return NextResponse.json({ error: listError.message }, { status: 500 });
  const object = listed?.find((row) => row.name === base);
  if (!object) return NextResponse.json({ error: "未找到已上传的文件。" }, { status: 404 });

  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);
  const name = String(body.name ?? base).slice(0, 180);
  const assetType = assetTypeFor(base);
  // A download keeps the name the uploader chose; images and video must stay
  // inline, or every <img> and <video> on the site would try to save itself
  // instead of rendering.
  const url =
    assetType === "file" ? downloadUrlFor(publicData.publicUrl, name) : publicData.publicUrl;
  const asset = await recordUploadedAsset(
    {
      name,
      url,
      mimeType: String(body.contentType ?? object.metadata?.mimetype ?? ""),
      byteSize: Number(object.metadata?.size ?? 0),
      assetType
    },
    user.email
  );

  return NextResponse.json({ url, asset });
}
