import { NextResponse } from "next/server";
import { guardMaterialWrite } from "@/lib/admin/material-guard";

/**
 * Turns whatever an editor pasted into something a browser can play.
 *
 * Separate from `/inspect` on purpose: that one shells out to ffprobe, so it
 * only answers where ffmpeg is installed. This one is three fetches and a
 * regex, which means the player works on the live site -- and the player is
 * the whole point, because choosing the moments is the half of the job that
 * does not need a render machine.
 *
 * It stays a server route rather than running in the page because 干净世界's
 * own pages are not CORS-open; their video streams are, which is what makes
 * playing them in our own player possible at all.
 */
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

async function ganjingStream(pageUrl: string): Promise<string> {
  const res = await fetch(pageUrl, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`打不开这个页面（HTTP ${res.status}）`);
  /* Next.js escapes the quotes inside its own payload, so they are undone first. */
  const flat = (await res.text()).replaceAll('\\"', '"').replaceAll("\\/", "/");
  const m = flat.match(/"video_url"\s*:\s*"(https:\/\/[^"]+?master\.m3u8)"/);
  if (!m) throw new Error("这个页面里没有找到视频流，确认是影片页而不是频道页");
  return m[1];
}

/** 1080p sits under two different names depending on when the film was uploaded. */
async function bestRendition(master: string): Promise<string> {
  const base = master.replace(/\/master\.m3u8$/, "");
  for (const candidate of ["playlist_1080p.m3u8", "v1080p/index.m3u8", "playlist_720p.m3u8", "v720p/index.m3u8"]) {
    try {
      const res = await fetch(`${base}/${candidate}`, {
        method: "HEAD",
        headers: { "user-agent": UA },
        signal: AbortSignal.timeout(20000)
      });
      if (res.ok) return `${base}/${candidate}`;
    } catch {
      /* try the next shape */
    }
  }
  return master;
}

export async function POST(request: Request) {
  const { error } = await guardMaterialWrite();
  if (error) return error;

  const body = (await request.json().catch(() => ({}))) as { source?: string };
  const source = String(body.source ?? "").trim();
  if (!source) return NextResponse.json({ error: "没有给来源" }, { status: 400 });

  try {
    if (/ganjingworld\.com\/(embed|video)\//i.test(source)) {
      const stream = await bestRendition(await ganjingStream(source));
      return NextResponse.json({ url: stream, kind: "hls" });
    }
    if (/^https?:\/\//i.test(source)) {
      return NextResponse.json({ url: source, kind: /\.m3u8(\?|$)/i.test(source) ? "hls" : "file" });
    }
    /*
     * A local path. The browser cannot open one, but `/studio/file` can stream
     * it when it sits under `artifacts/` -- which is where footage downloaded
     * for a cut lives.
     */
    return NextResponse.json({
      url: `/api/admin/studio/file?path=${encodeURIComponent(source)}`,
      kind: "file",
      local: true
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "解析失败" }, { status: 400 });
  }
}
