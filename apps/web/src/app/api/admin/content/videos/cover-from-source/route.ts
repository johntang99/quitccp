import { NextResponse } from "next/server";
import { adminCanWrite, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { objectPathFor } from "@/lib/admin/upload-policy";
import { recordUploadedAsset, storageBucketName } from "@/lib/admin/media-storage";
import { findCoverForSource } from "@/lib/admin/video-cover-source";
import { putToMediaMirror } from "@/lib/admin/media-mirror-upload";

/**
 * Fetches the platform's own thumbnail for a video address and keeps a copy.
 *
 * Why a copy rather than the platform's URL: every other cover on the site
 * lives in our own storage, deliberately, so that the pages do not depend on
 * an outside host for their images. Hot-linking i.ytimg.com here would quietly
 * undo that for exactly the films an editor added most recently -- and those
 * are the ones on the homepage.
 *
 * It is also why a cover is worth fetching at all: a film with none renders as
 * a flat grey rectangle in every card grid, and the homepage skips it
 * altogether, because that band only lists films that have one.
 *
 * Returns `{ ok: true, url }` on success, and `{ ok: false, reason }` when the
 * platform has nothing to give -- a plain .mp4 on our own storage, say. The
 * caller treats that as "the editor has to choose a picture", not an error.
 */
export const maxDuration = 30;

export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!adminCanWrite(user)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  requireAdminMfa(user);

  const body = (await request.json().catch(() => ({}))) as { sourceUrl?: string };
  const sourceUrl = body.sourceUrl?.trim() ?? "";
  if (!sourceUrl) return NextResponse.json({ ok: false, error: "缺少视频地址。" }, { status: 400 });

  const bucket = storageBucketName();
  if (!bucket) {
    return NextResponse.json({ ok: false, error: "未配置 SUPABASE_STORAGE_BUCKET。" }, { status: 501 });
  }

  const found = await findCoverForSource(sourceUrl);
  if (!found) {
    return NextResponse.json({
      ok: false,
      reason: "这个地址没有可以自动取用的封面图，请手动选择一张。"
    });
  }

  const extension = found.mime === "image/png" ? "png" : found.mime === "image/webp" ? "webp" : "jpg";
  const objectPath = objectPathFor("videos/covers", `cover.${extension}`);

  const supabase = createSupabaseAdminClient();
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(objectPath, found.bytes, { contentType: found.mime, upsert: false });
  if (uploadError) {
    return NextResponse.json({ ok: false, error: `保存封面失败：${uploadError.message}` }, { status: 500 });
  }

  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  const url = publicData?.publicUrl ?? "";
  if (!url) return NextResponse.json({ ok: false, error: "保存后拿不到图片地址。" }, { status: 500 });

  /* Into the media library too, so it behaves like any other picture: it can
     be found, reused, and deleted from one place rather than being an orphan
     that only this one film knows about. */
  try {
    await recordUploadedAsset(
      {
        name: `视频封面（自动取自${
          found.platform === "youtube" ? "YouTube" : found.platform === "ganjing" ? "干净世界" : "Vimeo"
        }）`,
        url,
        mimeType: found.mime,
        byteSize: found.bytes.length,
        assetType: "image"
      },
      user.email
    );
  } catch {
    /* The cover is saved and usable; the library row is a convenience. */
  }

  /*
   * Mirrored here, inline, rather than handed to `after()`.
   *
   * It used to be `after(() => mirrorUploadInBackground(objectPath, …))`,
   * which downloaded the bytes back out of Supabase to put them in R2. The
   * bytes are already in memory here, so that was a round trip for nothing:
   * this is one PUT of about 60 KB on a request that has already spent seconds
   * fetching the picture, and nobody can feel it.
   *
   * Note for anyone reading the history: this change was first committed with
   * the explanation that `after()` was being killed by the route's 30s budget.
   * That was wrong. The log archive showed `after()` completing and R2
   * rejecting the PUT with `411 Length Required` -- fixed in
   * media-mirror-upload.ts, not here. Moving the write inline is still right,
   * just for a duller reason.
   *
   * A failure here does not fail the request: the cover is in Supabase and the
   * page will render it. The mirror is the optimisation, and the defence check
   * on the dashboard is what notices if it stops working.
   */
  const mirrored = await putToMediaMirror(objectPath, found.bytes, found.mime);
  if (mirrored.status === "copied") {
    console.log(`[media-mirror] 已复制到 R2: ${objectPath} (${mirrored.bytes} 字节)`);
  } else {
    console.warn(`[media-mirror] 未复制 ${objectPath}: ${mirrored.reason}`);
  }

  return NextResponse.json({
    ok: true,
    url,
    platform: found.platform,
    byteSize: found.bytes.length,
    from: found.sourceUrl
  });
}
