/**
 * Finds the thumbnail a video platform already has for a film.
 *
 * Every film an editor adds has a picture waiting for it -- the platform made
 * one when the film was uploaded -- and until now nobody fetched it, so 66 of
 * 681 published films rendered as a flat grey rectangle in the card grids. The
 * same job was being done after the fact by scripts/backfill-video-covers.mjs;
 * this is that logic where an editor can reach it, at the moment they paste the
 * address.
 *
 * None of the three needs an API key, which is why this can run on a save.
 *
 * Measured 2026-10-14, one film each: YouTube 64 KB, 干净世界 72 KB,
 * Vimeo 12 KB.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

/** Big enough to be a real frame. See the note on the YouTube sizes below. */
const MIN_BYTES = 4000;

export interface FoundCover {
  /* Narrow on purpose -- see putToMediaMirror: a plain `Buffer` cannot be a
     fetch body, and these bytes always come from an `arrayBuffer()`. */
  bytes: Buffer<ArrayBuffer>;
  mime: string;
  /** Where it came from, for the audit trail and the editor's confirmation. */
  sourceUrl: string;
  platform: "youtube" | "ganjing" | "vimeo";
}

function youtubeIdOf(url: string): string {
  const value = (url ?? "").trim();
  const match =
    value.match(/youtube\.com\/watch\?v=([A-Za-z0-9_-]{6,20})/) ??
    value.match(/youtu\.be\/([A-Za-z0-9_-]{6,20})/) ??
    value.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{6,20})/);
  return match ? match[1] : "";
}

async function download(url: string): Promise<{ bytes: Buffer<ArrayBuffer>; mime: string } | null> {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": UA },
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    /*
     * YouTube answers a 120x90 grey placeholder instead of a 404 for a size it
     * does not hold, so a small body means "this size does not exist" rather
     * than "here is a small picture". Real frames are far larger.
     */
    if (bytes.length < MIN_BYTES) return null;
    const mime = (response.headers.get("content-type") ?? "image/jpeg").split(";")[0].trim();
    if (!mime.startsWith("image/")) return null;
    return { bytes, mime };
  } catch {
    return null;
  }
}

/** The cover a platform holds for this address, or null. Never throws. */
export async function findCoverForSource(sourceUrl: string): Promise<FoundCover | null> {
  const url = (sourceUrl ?? "").trim();
  if (!url) return null;

  const youtubeId = youtubeIdOf(url);
  if (youtubeId) {
    /* maxresdefault only exists for films uploaded large enough; hqdefault
       always does. Biggest first, so the card gets the sharpest frame. */
    for (const size of ["maxresdefault", "sddefault", "hqdefault"]) {
      const candidate = `https://i.ytimg.com/vi/${youtubeId}/${size}.jpg`;
      const got = await download(candidate);
      if (got) return { ...got, sourceUrl: candidate, platform: "youtube" };
    }
    return null;
  }

  if (/ganjing/i.test(url)) {
    /* No thumbnail API, but the watch page carries an og:image. The /embed/
       form does not, so ask for the watch form. */
    const watchPage = url.replace("/embed/", "/video/");
    try {
      const response = await fetch(watchPage, {
        headers: { "user-agent": UA },
        signal: AbortSignal.timeout(25000)
      });
      if (!response.ok) return null;
      const html = await response.text();
      const og = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1];
      if (!og) return null;
      const candidate = og.replace(/&amp;/g, "&");
      const got = await download(candidate);
      return got ? { ...got, sourceUrl: candidate, platform: "ganjing" } : null;
    } catch {
      return null;
    }
  }

  if (/vimeo\.com/i.test(url)) {
    /* oEmbed is public and needs no key. It wants the watch address, which is
       what an editor pastes anyway. */
    const watch = url.replace("player.vimeo.com/video/", "vimeo.com/");
    try {
      const response = await fetch(
        `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(watch)}`,
        { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20000) }
      );
      if (!response.ok) return null;
      const payload = (await response.json()) as { thumbnail_url?: string };
      if (!payload.thumbnail_url) return null;
      const got = await download(payload.thumbnail_url);
      return got ? { ...got, sourceUrl: payload.thumbnail_url, platform: "vimeo" } : null;
    } catch {
      return null;
    }
  }

  /* A .mp4 on our own storage has no thumbnail to fetch, and pulling a frame
     out of it would mean decoding video in a request. Not here. */
  return null;
}
