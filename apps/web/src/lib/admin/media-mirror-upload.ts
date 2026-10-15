import { AwsClient } from "aws4fetch";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { storageBucketName } from "@/lib/admin/media-storage";

/**
 * Copies a freshly uploaded object into the R2 mirror.
 *
 * The browser uploads straight to Supabase Storage, because a serverless
 * request body is capped far below the 200MB an editor is allowed to send. That
 * leaves the mirror behind by however long it takes somebody to remember to run
 * `scripts/mirror-media.mjs`, and the gap is not theoretical: on 2026-10-15 the
 * home page carried thirteen images that existed in Storage and not on the
 * mirror, because they had been uploaded after the last sync.
 *
 * Today that gap is survivable -- the page asks the mirror, gets a 404, and the
 * listener in `media-failover.ts` swaps the image back to Supabase. It stops
 * being survivable the day the Supabase bucket is made private: there would be
 * no second address to fall back to, and a newly uploaded image would simply be
 * dead, with nothing anywhere reporting it. Closing this gap is the prerequisite
 * for that change, not an optimisation.
 *
 * ## What it deliberately does not do
 *
 * It never fails an upload. An editor who has just waited for a 40MB video
 * should not be told the save failed because a mirror they have never heard of
 * was briefly unreachable; the object is in Storage, the row is written, and the
 * page will serve it from Supabase through the failover path. A copy that did
 * not happen is logged and left for `scripts/mirror-media.mjs`, which is
 * incremental and picks up anything missed.
 *
 * ## Why it buffers, and why there is a ceiling
 *
 * Signing an S3 PUT requires a hash of the body, so the bytes have to be in hand
 * rather than streamed. That is fine for the images that make up almost all
 * uploads and wasteful for a large video, so anything over the ceiling is left
 * to the sync script rather than risking the function's memory on it.
 */

/** Above this, leave it to `scripts/mirror-media.mjs` rather than buffer it. */
const MAX_INLINE_COPY_BYTES = 100 * 1024 * 1024;

export type MirrorCopyResult =
  | { status: "copied"; bytes: number }
  | { status: "skipped"; reason: string };

function mirrorConfig() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return {
    bucket,
    endpoint: process.env.R2_ENDPOINT?.trim() || `https://${accountId}.r2.cloudflarestorage.com`,
    aws: new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" })
  };
}

export async function copyToMediaMirror(
  objectPath: string,
  contentType?: string
): Promise<MirrorCopyResult> {
  const config = mirrorConfig();
  /* No mirror configured is the ordinary state on a preview deployment and on
     any checkout without the R2 keys. Saying so and moving on keeps this from
     becoming a reason uploads behave differently between environments. */
  if (!config) return { status: "skipped", reason: "R2 未配置" };

  const sourceBucket = storageBucketName();
  if (!sourceBucket) return { status: "skipped", reason: "SUPABASE_STORAGE_BUCKET 未配置" };

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(sourceBucket).download(objectPath);
  if (error || !data) return { status: "skipped", reason: `读取源对象失败：${error?.message ?? "无数据"}` };
  if (data.size > MAX_INLINE_COPY_BYTES) {
    return { status: "skipped", reason: `${(data.size / 1024 / 1024).toFixed(0)}MB 超过内联复制上限，留给同步脚本` };
  }

  const body = Buffer.from(await data.arrayBuffer());
  const response = await config.aws.fetch(`${config.endpoint}/${config.bucket}/${objectPath}`, {
    method: "PUT",
    body,
    headers: {
      "content-type": contentType || data.type || "application/octet-stream",
      /* The same header `scripts/push-media-mirror.mjs` writes. Object keys
         carry an upload timestamp and are never rewritten, so the mirror can
         be cached for a year and Cloudflare can answer without asking R2. */
      "cache-control": "public, max-age=31536000, immutable"
    }
  });
  if (!response.ok) {
    return { status: "skipped", reason: `写入 R2 失败：HTTP ${response.status}` };
  }
  return { status: "copied", bytes: body.length };
}

/**
 * Fire-and-forget wrapper for use inside `after()`.
 *
 * Every outcome is logged, including the uninteresting ones: a mirror that has
 * quietly stopped accepting writes looks exactly like a mirror that is working,
 * right up until the bucket is made private and the images start disappearing.
 */
export async function mirrorUploadInBackground(objectPath: string, contentType?: string) {
  try {
    const result = await copyToMediaMirror(objectPath, contentType);
    if (result.status === "copied") {
      console.log(`[media-mirror] 已复制到 R2: ${objectPath} (${result.bytes} 字节)`);
    } else {
      console.warn(`[media-mirror] 未复制 ${objectPath}: ${result.reason}`);
    }
  } catch (error) {
    console.error(`[media-mirror] 复制 ${objectPath} 时异常:`, error);
  }
}
