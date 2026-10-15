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
  return putToMediaMirror(objectPath, body, contentType || data.type);
}

/**
 * Writes bytes already in hand straight to the mirror.
 *
 * Split out from `copyToMediaMirror` because one caller never needed the
 * download half. `videos/cover-from-source` fetches the picture from YouTube
 * or 干净世界, uploads it to Supabase, and used to hand the object path to
 * `after()`, which downloaded those same bytes back out of Supabase to put
 * them in R2.
 *
 * The round trip was pointless rather than harmful, and removing it is worth
 * doing on its own: one PUT instead of a download and an upload, on bytes that
 * never left memory.
 *
 * It is NOT what broke the covers. The first reading of that incident was that
 * `after()` ran out of the route's 30s budget; the log archive said otherwise
 * -- `after()` completed, logging 2-3 seconds after each request, and R2
 * rejected the PUT itself with `411 Length Required`. The fix for that is in
 * the headers below. This note stays because the wrong explanation was
 * committed first and somebody reading the history deserves the correction.
 */
export async function putToMediaMirror(
  objectPath: string,
  /* `Buffer<ArrayBuffer>` and not plain `Buffer`: the wider type admits a
     SharedArrayBuffer-backed view, which `fetch` will not accept as a body.
     Every caller here holds bytes from an `arrayBuffer()`, so the narrow type
     is the true one and the compiler can check it. */
  body: Buffer<ArrayBuffer>,
  contentType?: string
): Promise<MirrorCopyResult> {
  const config = mirrorConfig();
  if (!config) return { status: "skipped", reason: "R2 未配置" };
  if (body.length > MAX_INLINE_COPY_BYTES) {
    return { status: "skipped", reason: `${(body.length / 1024 / 1024).toFixed(0)}MB 超过内联复制上限，留给同步脚本` };
  }

  const headers = {
    "content-type": contentType || "application/octet-stream",
    /*
     * Set explicitly because R2 refuses a PUT without it, and the runtime does
     * not always supply it.
     *
     * Read from the archive 2026-10-15: `HTTP 411 Length Required`, on 21 of
     * the last 39 covers, while others in the same minutes went through. R2
     * will not accept a chunked upload; when the runtime frames the body as a
     * stream instead of a known-length buffer it sends
     * `Transfer-Encoding: chunked` and R2 answers 411. The same code run from
     * a laptop never does this -- 22 backfilled files, zero failures -- so it
     * is the server runtime's framing, not the bytes.
     *
     * We know the length exactly, so there is no reason to let anything infer
     * it.
     */
    "content-length": String(body.length),
    /* The same header `scripts/push-media-mirror.mjs` writes. Object keys
       carry an upload timestamp and are never rewritten, so the mirror can
       be cached for a year and Cloudflare can answer without asking R2. */
    "cache-control": "public, max-age=31536000, immutable"
  };

  /*
   * Tried twice. The failure above was intermittent -- a copy succeeded at
   * 19:16 and the next five did not -- and whatever makes the framing vary
   * between calls is not ours to control. One retry costs a few hundred
   * milliseconds on a path that already has the bytes in hand, and turns an
   * intermittent fault into a rare one. A second failure is reported, and the
   * dashboard check is what notices if it becomes the rule again.
   */
  let last = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await config.aws.fetch(`${config.endpoint}/${config.bucket}/${objectPath}`, {
      method: "PUT",
      body,
      headers
    });
    if (response.ok) return { status: "copied", bytes: body.length };
    last = response.status;
  }
  return { status: "skipped", reason: `写入 R2 失败：HTTP ${last}（已重试一次）` };
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
