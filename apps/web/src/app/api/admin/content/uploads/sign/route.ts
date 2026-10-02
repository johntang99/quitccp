import { NextResponse } from "next/server";
import { adminCanWrite, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { storageBucketName } from "@/lib/admin/media-storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { MAX_UPLOAD_BYTES, isAllowed, objectPathFor } from "@/lib/admin/upload-policy";

/**
 * Issues a short-lived ticket so the browser can upload straight to Storage.
 *
 * The file never passes through this function. That is not an optimisation: a
 * serverless request body is capped around 4.5MB in production, so a 60MB 展板
 * zip could never reach us, and today's image uploader -- which does read the
 * bytes here -- has a 5MB limit that is already above what production accepts.
 *
 *   browser -> [name, type, size] -> here -> signed ticket
 *   browser -> [the bytes] ---------------> Supabase Storage
 *
 * Going direct does not mean going unguarded: the session, the role, MFA, the
 * type allow-list and the size cap are all checked before a ticket exists, and
 * the destination path is built here rather than accepted from the client.
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
  if (!bucket) {
    return NextResponse.json({ error: "未配置 SUPABASE_STORAGE_BUCKET，无法上传。" }, { status: 501 });
  }

  let body: { filename?: string; contentType?: string; size?: number; folder?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误。" }, { status: 400 });
  }

  const filename = String(body.filename ?? "").trim();
  const contentType = String(body.contentType ?? "").trim();
  const size = Number(body.size ?? 0);

  if (!filename) return NextResponse.json({ error: "缺少文件名。" }, { status: 400 });
  if (!isAllowed(filename, contentType)) {
    return NextResponse.json(
      { error: "不支持的文件类型。可上传图片、PDF、ZIP、RAR、Word、MP3、AI、PSD。" },
      { status: 400 }
    );
  }
  if (!Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ error: "缺少文件大小。" }, { status: 400 });
  }
  if (size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `文件过大，请上传小于 ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)}MB 的文件。` },
      { status: 400 }
    );
  }

  const objectPath = objectPathFor(String(body.folder ?? "general"), filename);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(objectPath);
  if (error || !data) {
    return NextResponse.json({ error: `无法创建上传链接：${error?.message ?? "未知错误"}` }, { status: 500 });
  }

  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  return NextResponse.json({
    signedUrl: data.signedUrl,
    path: objectPath,
    publicUrl: publicData.publicUrl
  });
}
