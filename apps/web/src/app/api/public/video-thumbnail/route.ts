import { NextResponse } from "next/server";

/**
 * A YouTube poster frame, served from this origin.
 *
 * `ArticleVideo` shows a still behind its play button and only contacts YouTube
 * once the reader clicks. Pointing that still straight at i.ytimg.com would have
 * undone exactly that: every article carrying a video would announce the
 * reader's address to Google on page load, before they had asked for anything.
 * Some of these readers are inside China or have family there, so that request
 * is not a neutral one to make on their behalf.
 *
 * So the server fetches the frame and passes the bytes on. The reader's browser
 * talks only to us. The response is immutable for a day at the edge: a video's
 * poster does not change, and the upstream fetch should happen once, not once
 * per reader.
 */

/** Only a plain video id. It is interpolated into a URL this server fetches. */
const ID = /^[A-Za-z0-9_-]{6,20}$/;

/** maxres is sharper but missing for plenty of videos; hq always exists. */
const SIZES = ["maxresdefault", "hqdefault"];

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("v") ?? "";
  if (!ID.test(id)) {
    return NextResponse.json({ error: "Invalid video id" }, { status: 400 });
  }

  for (const size of SIZES) {
    try {
      const upstream = await fetch(`https://i.ytimg.com/vi/${id}/${size}.jpg`, {
        signal: AbortSignal.timeout(8_000),
        cache: "no-store"
      });
      const type = upstream.headers.get("content-type") ?? "";
      // YouTube answers a missing size with a 120x90 placeholder rather than a
      // 404, so a suspiciously small body means "not available at this size".
      const body = upstream.ok && type.startsWith("image/") ? await upstream.arrayBuffer() : null;
      if (!body || body.byteLength < 2_000) continue;

      return new NextResponse(body, {
        headers: {
          "content-type": type,
          "cache-control": "public, max-age=86400, s-maxage=86400, immutable"
        }
      });
    } catch {
      // Try the next size; a thumbnail is a nicety, never a reason to 500.
    }
  }

  // No poster: the caller falls back to its plain play button.
  return NextResponse.json({ error: "No thumbnail" }, { status: 404 });
}
