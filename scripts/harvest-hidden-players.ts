/**
 * Finds the players the WordPress REST API does not expose.
 *
 * The old site plays most of its own videos through an "Elite Video Player"
 * Elementor widget. The widget is a shortcode, and its markup -- along with the
 * .mp4 address -- only exists on the rendered page. `content.rendered` from the
 * REST API has no trace of it, which is why 233 imported videos came through
 * looking like text-only posts. They are not: they are self-hosted MP4s under
 * tuidang.org/wp-content/uploads/.
 *
 * This walks the rendered page of every video that has no source_url yet and
 * pulls the address out of the widget's data-options JSON. It only reads and
 * writes source_url -- nothing else about the video is touched.
 *
 *   npx tsx scripts/harvest-hidden-players.ts --dry-run
 *   npx tsx scripts/harvest-hidden-players.ts --apply
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

/** Direct requests are answered with a Cloudflare challenge; this read-through proxy is not. */
const PROXY = "https://r.jina.ai/";
const WIDGET = /Elite_video_player"[^>]*?data-options="(.*?)"/gs;
/** Last resort: the player is self-hosted, so the address is on the page regardless. */
const SELF_HOSTED = /https?:\/\/[^"'\s]*\/wp-content\/uploads\/[^"'\s]+\.mp4/gi;
const ATTEMPTS = 3;

function unescapeHtml(value: string): string {
  return value
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

/** The widget carries several address fields; which one is set depends on videoType. */
function addressOf(video: Record<string, unknown>): string {
  for (const key of ["mp4HD", "mp4SD", "youtubeURL", "vimeoURL", "videoURL", "hlsURL"]) {
    const value = String(video[key] ?? "").trim();
    // The plugin ships its placeholders as the literal field name.
    if (value && value !== key && /^https?:\/\//.test(value)) return value;
  }
  return "";
}

function playersOn(html: string): string[] {
  const found: string[] = [];
  for (const match of html.matchAll(WIDGET)) {
    let options: { videos?: Record<string, unknown>[] };
    try {
      options = JSON.parse(unescapeHtml(match[1]));
    } catch {
      continue;
    }
    for (const video of options.videos ?? []) {
      const address = addressOf(video);
      if (address) found.push(address);
    }
  }
  if (found.length === 0) found.push(...(html.match(SELF_HOSTED) ?? []));
  return [...new Set(found)];
}

/**
 * Fetches a page, retrying transient failures.
 *
 * The first run of this script treated a failed fetch as "this page has no
 * player", and 174 videos were written off on that basis. Three I sampled
 * afterwards all had one. A page that could not be read is not a page without a
 * player, so the two are now reported separately and a read is retried before
 * being believed.
 */
async function fetchPage(url: string): Promise<{ html: string; failed: boolean }> {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`${PROXY}${url}`, {
        headers: { "x-respond-with": "html", "user-agent": "quitccp-video-migrator/1.0" }
      });
      if (response.ok) {
        const html = await response.text();
        // A challenge page is short and carries no article markup.
        if (html.length > 20_000) return { html, failed: false };
      }
    } catch {
      // Fall through to the backoff below.
    }
    if (attempt < ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
  }
  return { html: "", failed: true };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const { data, error } = await supabase
    .from("cms_videos")
    .select("id, title, legacy_url")
    .eq("source_url", "")
    .neq("legacy_url", "");
  if (error) throw error;
  const targets = data ?? [];
  process.stderr.write(`待查 ${targets.length} 个\n`);

  const found: { id: string; title: string; url: string }[] = [];
  const missing: { title: string; legacyUrl: string }[] = [];
  /** Read from the page successfully, but it really has no player. */
  const unreadable: { title: string; legacyUrl: string }[] = [];

  for (const [index, video] of targets.entries()) {
    const page = video.legacy_url.startsWith("http")
      ? video.legacy_url
      : `https://www.tuidang.org${video.legacy_url}`;
    const { html, failed } = await fetchPage(page);
    const addresses = playersOn(html);
    if (addresses.length > 0) found.push({ id: video.id, title: video.title, url: addresses[0] });
    else if (failed) unreadable.push({ title: video.title, legacyUrl: video.legacy_url });
    else missing.push({ title: video.title, legacyUrl: video.legacy_url });

    if ((index + 1) % 20 === 0 || index + 1 === targets.length) {
      process.stderr.write(`[harvest] ${index + 1}/${targets.length} — 找到 ${found.length}\n`);
    }
  }

  writeFileSync(
    "artifacts/phase5/hidden-players.json",
    JSON.stringify({ generatedAt: new Date().toISOString(), found, missing, unreadable }, null, 2)
  );

  const hosts = new Map<string, number>();
  for (const entry of found) {
    const host = new URL(entry.url).hostname;
    hosts.set(host, (hosts.get(host) ?? 0) + 1);
  }
  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    checked: targets.length,
    found: found.length,
    genuinelyNoPlayer: missing.length,
    couldNotRead: unreadable.length,
    byHost: Object.fromEntries(hosts)
  }, null, 2));

  if (!apply) return;
  for (const entry of found) {
    const { error: updateError } = await supabase
      .from("cms_videos")
      .update({ source_url: entry.url })
      .eq("id", entry.id);
    if (updateError) throw updateError;
  }
  process.stderr.write(`已写入 ${found.length} 个播放地址\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
