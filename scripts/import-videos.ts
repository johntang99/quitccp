/**
 * Imports the old site's videos into `cms_videos`.
 *
 * Takes the groups `scripts/allocate-videos.ts` picked out -- series, tagged and
 * rescue -- and writes one video row per post plus its category mapping. Matches
 * on `legacy_id`, so re-running updates rather than duplicating.
 *
 * Retiring the corresponding articles is deliberately NOT done here. That is a
 * destructive step on 745 live rows and belongs in its own reviewed pass.
 *
 *   npx tsx scripts/import-videos.ts --dry-run
 *   npx tsx scripts/import-videos.ts --apply
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const IMPORT_GROUPS = new Set(["series", "tagged", "rescue"]);

/**
 * `--include-platform` also takes `orphan` entries whose player is on YouTube or
 * Gan Jing World.
 *
 * Orphans are posts the allocator could not place confidently, and the first
 * import left all 722 of them out. But one group inside them is unambiguous:
 * if the post embeds a YouTube or 干净世界 player, it IS a video, and listing it
 * costs nothing -- the file stays on the platform, we only store the address.
 * Orphans whose only player is a bare .mp4 on someone else's server are still
 * left out; those are links that rot.
 */
const INCLUDE_PLATFORM = process.argv.includes("--include-platform");

/**
 * Only the ones that still play.
 *
 * `scripts/verify-platform-videos.mjs` asks every address first and writes the
 * allowlist here. Of the 191 platform orphans, 31 had been removed or had
 * embedding turned off -- importing the list unchecked would have put 31 dead
 * players into the library.
 */
const LIVE_LIST = "artifacts/phase5/platform-orphans-live.json";
const liveIds = (() => {
  if (!INCLUDE_PLATFORM) return null;
  if (!existsSync(LIVE_LIST)) {
    throw new Error(
      `--include-platform 需要先跑 node --env-file=.env.local scripts/verify-platform-videos.mjs（缺 ${LIVE_LIST}）`
    );
  }
  return new Set(JSON.parse(readFileSync(LIVE_LIST, "utf8")).live.map((row: { legacyId: number }) => row.legacyId));
})();

interface Allocation { group: string; category: string; slug: string; legacyId: number }
interface Post {
  slug: string; title: string; bodyMarkdown: string; publishedAt: string;
  legacyId: number; legacyUrl: string; heroImage?: string; heroImageAlt?: string; heroCredit?: string;
}

/** `::: video <url>` is what the HTML converter turns an <iframe> into. */
const EMBED = /^::: video\s+(\S+)\s*$/gm;
const PLATFORM_LINK = /https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|ganjingworld\.com|ganjing\.com|vimeo\.com)\/\S*[^\s.,)\]]/gi;
const isGanjing = (url: string) => /ganjing/i.test(url);

/**
 * Picks the player address, and a mainland-reachable backup when one exists.
 *
 * Embeds win over bare links: an embed is what the old page actually played,
 * a link may just be a citation in the body text.
 */
function pickSources(body: string): { source: string; backup: string } {
  const embeds = [...body.matchAll(EMBED)].map((m) => m[1]);
  const links = body.match(PLATFORM_LINK) ?? [];
  const all = [...embeds, ...links];
  if (all.length === 0) return { source: "", backup: "" };
  const source = embeds[0] ?? links[0];
  // A 干净世界 address is only a backup if it is not already the main one.
  const backup = isGanjing(source) ? "" : (all.find(isGanjing) ?? "");
  return { source, backup };
}

/** 第 12 集 / 第十六期 / 九评之三 -- left blank when the title carries no number. */
function pickEpisode(title: string): string {
  const match = title.match(/第\s*([0-9一二三四五六七八九十百]+)\s*([集期讲部])/) ?? title.match(/(九评之[一二三四五六七八九])/);
  return match ? match[0].replace(/\s+/g, "") : "";
}

/** Body with the player block taken out; the player is rendered by the page. */
function bodyWithoutPlayer(body: string): string {
  return body.replace(EMBED, "").replace(/\n{3,}/g, "\n\n").trim();
}

function describe(body: string): string {
  const plain = body
    .replace(EMBED, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`|-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.slice(0, 300);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const allocations: Allocation[] = JSON.parse(
    readFileSync("artifacts/phase5/video-allocation.json", "utf8")
  ).items;
  const parsed = JSON.parse(readFileSync("artifacts/phase5/normalized-full-hosted.json", "utf8"));
  const posts: Post[] = parsed.rows ?? parsed;
  const postBySlug = new Map(posts.map((post) => [post.slug, post]));

  const { data: categories, error: categoryError } = await supabase
    .from("cms_video_categories")
    .select("id, name");
  if (categoryError) throw categoryError;
  const categoryId = new Map((categories ?? []).map((row) => [row.name as string, row.id as string]));

  const wanted = allocations.filter((entry) => {
    if (IMPORT_GROUPS.has(entry.group)) return true;
    if (!INCLUDE_PLATFORM || entry.group !== "orphan") return false;
    return liveIds!.has(entry.legacyId);
  });
  if (INCLUDE_PLATFORM) {
    const extra = wanted.filter((entry) => entry.group === "orphan").length;
    console.log(`[videos] --include-platform：额外纳入 ${extra} 条 YouTube／干净世界 的 orphan`);
  }

  const rows = wanted.flatMap((entry) => {
    const post = postBySlug.get(entry.slug);
    if (!post) return [];
    const { source, backup } = pickSources(post.bodyMarkdown || "");
    return [{
      category: entry.category,
      record: {
        slug: post.slug,
        title: post.title,
        description: describe(post.bodyMarkdown || ""),
        body_markdown: source ? bodyWithoutPlayer(post.bodyMarkdown || "") : (post.bodyMarkdown || ""),
        source_url: source,
        backup_url: backup,
        episode: pickEpisode(post.title),
        cover_image: post.heroImage ?? "",
        cover_image_alt: post.heroImageAlt ?? "",
        source_credit: post.heroCredit ?? "",
        published_at: post.publishedAt || null,
        legacy_id: post.legacyId,
        legacy_url: post.legacyUrl ?? "",
        status: "published"
      }
    }];
  });

  const missingCategory = [...new Set(rows.map((r) => r.category))].filter((name) => !categoryId.has(name));
  if (missingCategory.length > 0) throw new Error(`分类不存在: ${missingCategory.join(", ")}（012 跑了吗？）`);

  const summary = {
    mode: apply ? "apply" : "dry-run",
    total: rows.length,
    withPlayer: rows.filter((r) => r.record.source_url).length,
    textOnly: rows.filter((r) => !r.record.source_url).length,
    withBackup: rows.filter((r) => r.record.backup_url).length,
    withCover: rows.filter((r) => r.record.cover_image).length,
    withEpisode: rows.filter((r) => r.record.episode).length,
    byCategory: Object.fromEntries(
      [...new Set(rows.map((r) => r.category))].map((name) => [name, rows.filter((r) => r.category === name).length])
    )
  };

  if (!apply) {
    console.log(JSON.stringify(summary, null, 2));
    console.log("\n样例:");
    for (const row of rows.slice(0, 3)) {
      console.log(` · ${row.record.title}\n   分类 ${row.category} | 集数 ${row.record.episode || "—"} | 地址 ${row.record.source_url || "（无，按文字页渲染）"}`);
    }
    return;
  }

  const BATCH = 50;

  // Split into inserts and updates rather than upserting. `legacy_id` is unique
  // only where it is not null, and PostgREST cannot name a partial index in an
  // ON CONFLICT clause -- so the lookup happens here instead.
  const { data: existingRows, error: existingError } = await supabase
    .from("cms_videos")
    .select("id, legacy_id, source_url, backup_url")
    .not("legacy_id", "is", null);
  if (existingError) throw existingError;
  const existing = new Map((existingRows ?? []).map((row) => [Number(row.legacy_id), row.id as string]));
  /**
   * Addresses already stored win over anything recomputed here.
   *
   * `source_url` is derived from the old article body, which is a snapshot. The
   * stored value is not: 185 videos were repointed at Gan Jing World, 18 at
   * YouTube, and 19 are waiting to be uploaded. Re-running this import used to
   * recompute all of them from the snapshot and wipe that work -- it blanked
   * every one of those 222 addresses once. A row that already has an address
   * keeps it; only an empty one gets filled.
   */
  const keptSource = new Map(
    (existingRows ?? [])
      .filter((row) => String(row.source_url ?? "").trim() !== "")
      .map((row) => [Number(row.legacy_id), { source_url: row.source_url, backup_url: row.backup_url }])
  );

  const toInsert = rows.filter((row) => !existing.has(row.record.legacy_id));
  const toUpdate = rows.filter((row) => existing.has(row.record.legacy_id));

  for (let index = 0; index < toInsert.length; index += BATCH) {
    const slice = toInsert.slice(index, index + BATCH);
    const { error } = await supabase.from("cms_videos").insert(slice.map((row) => row.record));
    if (error) throw error;
    process.stderr.write(`[videos insert] ${Math.min(index + BATCH, toInsert.length)}/${toInsert.length}\n`);
  }
  let keptCount = 0;
  for (const row of toUpdate) {
    const kept = keptSource.get(row.record.legacy_id);
    const payload = { ...row.record };
    if (kept) {
      payload.source_url = kept.source_url;
      payload.backup_url = kept.backup_url;
      if (kept.source_url !== row.record.source_url) keptCount += 1;
    }
    const { error } = await supabase
      .from("cms_videos")
      .update(payload)
      .eq("id", existing.get(row.record.legacy_id)!);
    if (error) throw error;
  }
  if (keptCount > 0) process.stderr.write(`[videos] 保留了 ${keptCount} 条已存在的播放地址，未被重算覆盖\n`);
  if (toUpdate.length > 0) process.stderr.write(`[videos update] ${toUpdate.length}\n`);

  // Map the categories in a second pass: the ids only exist once the rows do.
  const { data: saved, error: savedError } = await supabase
    .from("cms_videos")
    .select("id, legacy_id")
    .not("legacy_id", "is", null);
  if (savedError) throw savedError;
  const videoId = new Map((saved ?? []).map((row) => [Number(row.legacy_id), row.id as string]));

  const mappings = rows.flatMap((row) => {
    const id = videoId.get(row.record.legacy_id);
    return id ? [{ video_id: id, category_id: categoryId.get(row.category)!, position: 0 }] : [];
  });
  for (let index = 0; index < mappings.length; index += BATCH) {
    const slice = mappings.slice(index, index + BATCH);
    const { error } = await supabase
      .from("cms_video_category_map")
      .upsert(slice, { onConflict: "video_id,category_id" });
    if (error) throw error;
    process.stderr.write(`[map] ${Math.min(index + BATCH, mappings.length)}/${mappings.length}\n`);
  }

  console.log(JSON.stringify({ ...summary, mapped: mappings.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
