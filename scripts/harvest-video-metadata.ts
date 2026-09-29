/**
 * Pulls file size and duration for the self-hosted videos.
 *
 * The .mp4 files cannot be fetched directly -- Cloudflare answers video
 * requests with a challenge while letting images through -- but WordPress's own
 * media library knows both numbers and the REST endpoint for it is readable.
 * That gives us the duration the admin list has been showing as "—", and the
 * storage total needed to decide where these files should actually live.
 *
 *   npx tsx scripts/harvest-video-metadata.ts --apply
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PROXY = "https://r.jina.ai/";
const PAGE_SIZE = 100;

interface MediaItem {
  source_url?: string;
  mime_type?: string;
  media_details?: { filesize?: number; length?: number };
}

/** The proxy rate-limits; a 429 is transient, so back off rather than give up. */
async function readJson(url: string): Promise<unknown> {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(`${PROXY}${url}`, {
        headers: { "x-respond-with": "text", "user-agent": "quitccp-video-migrator/1.0" }
      });
      const text = await response.text();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
      // A rate-limit answer is an object, not the array of media we asked for.
    } catch {
      // Fall through to the backoff.
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 4000));
  }
  return null;
}

async function main() {
  const apply = process.argv.includes("--apply");

  const byUrl = new Map<string, { bytes: number; seconds: number }>();
  for (let page = 1; page <= 30; page += 1) {
    const items = (await readJson(
      `https://www.tuidang.org/wp-json/wp/v2/media?mime_type=video/mp4&per_page=${PAGE_SIZE}&page=${page}`
    )) as MediaItem[] | null;
    if (!items || items.length === 0) break;
    for (const item of items) {
      const url = String(item.source_url ?? "");
      const details = item.media_details ?? {};
      if (url) byUrl.set(url, { bytes: Number(details.filesize ?? 0), seconds: Number(details.length ?? 0) });
    }
    process.stderr.write(`[media] 第 ${page} 页，累计 ${byUrl.size} 个\n`);
    if (items.length < PAGE_SIZE) break;
  }

  const { data, error } = await supabase
    .from("cms_videos")
    .select("id, title, source_url")
    .like("source_url", "%tuidang.org%");
  if (error) throw error;
  const videos = data ?? [];

  const matched = videos.flatMap((video) => {
    const meta = byUrl.get(String(video.source_url));
    return meta ? [{ id: video.id as string, title: video.title as string, ...meta }] : [];
  });

  const totalBytes = matched.reduce((sum, row) => sum + row.bytes, 0);
  const totalSeconds = matched.reduce((sum, row) => sum + row.seconds, 0);
  console.log(JSON.stringify({
    mediaLibraryVideos: byUrl.size,
    ourSelfHosted: videos.length,
    matched: matched.length,
    totalGB: Number((totalBytes / 1024 ** 3).toFixed(1)),
    averageMB: matched.length ? Math.round(totalBytes / matched.length / 1024 ** 2) : 0,
    totalHours: Number((totalSeconds / 3600).toFixed(1))
  }, null, 2));

  writeFileSync(
    "artifacts/phase5/video-metadata.json",
    JSON.stringify({ generatedAt: new Date().toISOString(), matched }, null, 2)
  );
  if (!apply) return;

  for (const row of matched) {
    if (!row.seconds) continue;
    const { error: updateError } = await supabase
      .from("cms_videos")
      .update({ duration_seconds: Math.round(row.seconds) })
      .eq("id", row.id);
    if (updateError) throw updateError;
  }
  process.stderr.write(`已写入 ${matched.filter((row) => row.seconds).length} 个时长\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
