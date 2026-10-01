/**
 * Gives older articles a cover image taken from their own body.
 *
 * "Hero image" is a recent convention. The articles from the site's first
 * decade predate it: they were written with their photographs inline and no
 * cover field, so `hero_image` is empty for almost all of them -- 0.8% coverage
 * in 2007 against 99% in 2023. That emptiness was never a measure of whether an
 * article has pictures, and treating it as one made the admin list show 无图
 * against articles that are full of photographs.
 *
 * This copies the first image already present in each body into `hero_image`,
 * using the same rule the article page uses to pick its lead picture, so the
 * list, the card and the page all show one image rather than three opinions.
 * Bodies with no image at all are left alone -- there is nothing to take.
 *
 * Usage:
 *   npx tsx scripts/backfill-hero-images.ts --dry-run
 *   npx tsx scripts/backfill-hero-images.ts --apply
 *   npx tsx scripts/backfill-hero-images.ts --prune-unresolvable [--apply]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { firstImageInMarkdown } from "../apps/web/src/lib/markdown-image";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const APPLY = process.argv.includes("--apply");
const PRUNE = process.argv.includes("--prune-unresolvable");

/**
 * Hosts whose names no longer resolve (NXDOMAIN), so nothing they are asked for
 * can ever arrive. A cover pointing at one is worse than no cover: the lists
 * show a broken thumbnail instead of the honest 无图.
 *
 * www.tuidang.org is deliberately NOT here. It resolves and serves; requests
 * from this machine are refused by its bot protection, which is not the same
 * thing as the file being gone.
 */
const UNRESOLVABLE_HOSTS = ["m.tuidang.org", "truth.tuidang.org"];
/** PostgREST caps a response at 1,000 rows, so every read is paged. */
const PAGE = 500;

interface Candidate {
  id: string;
  slug: string;
  year: string;
  image: string;
}

async function collect(): Promise<{ candidates: Candidate[]; scanned: number; noImage: number }> {
  const candidates: Candidate[] = [];
  let scanned = 0;
  let noImage = 0;
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("cms_articles")
      .select("id, slug, published_at, hero_image, body_markdown")
      .or("hero_image.is.null,hero_image.eq.")
      .order("id", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    const rows = data ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      scanned += 1;
      const image = firstImageInMarkdown(String(row.body_markdown ?? ""));
      if (!image) {
        noImage += 1;
        continue;
      }
      candidates.push({
        id: String(row.id),
        slug: String(row.slug),
        year: String(row.published_at ?? "").slice(0, 4) || "(no date)",
        image
      });
    }
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return { candidates, scanned, noImage };
}

function report(candidates: Candidate[], scanned: number, noImage: number) {
  console.log(`articles with an empty hero_image: ${scanned}`);
  console.log(`  of those, carry an image in the body: ${candidates.length}`);
  console.log(`  of those, no image anywhere:          ${noImage}`);

  const byYear = new Map<string, number>();
  for (const row of candidates) byYear.set(row.year, (byYear.get(row.year) ?? 0) + 1);
  console.log("\nby publication year");
  for (const [year, n] of [...byYear.entries()].sort()) {
    console.log(`  ${year}  ${n}`);
  }

  const byHost = new Map<string, number>();
  for (const row of candidates) {
    let host = "(unparseable)";
    try {
      host = new URL(row.image).host;
    } catch {
      /* counted as unparseable */
    }
    byHost.set(host, (byHost.get(host) ?? 0) + 1);
  }
  console.log("\nby image host");
  for (const [host, n] of [...byHost.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(5)}  ${host}`);
  }

  console.log("\nfirst five to be written");
  for (const row of candidates.slice(0, 5)) {
    console.log(`  ${row.year}  ${row.slug.slice(0, 34).padEnd(34)}  ${row.image.slice(0, 80)}`);
  }
}

async function prune() {
  let cleared = 0;
  for (const host of UNRESOLVABLE_HOSTS) {
    const { data, error } = await supabase
      .from("cms_articles")
      .select("id, slug, hero_image")
      .like("hero_image", `%://${host}/%`);
    if (error) throw error;
    const rows = data ?? [];
    console.log(`${host}: ${rows.length} covers`);
    if (!APPLY) continue;
    for (const row of rows) {
      const { error: updateError } = await supabase
        .from("cms_articles")
        .update({ hero_image: "" })
        .eq("id", row.id);
      if (updateError) {
        console.error(`  failed ${row.slug}: ${updateError.message}`);
        continue;
      }
      cleared += 1;
    }
  }
  console.log(APPLY ? `cleared ${cleared} covers` : "DRY RUN -- nothing written.");
}

async function main() {
  if (PRUNE) {
    await prune();
    return;
  }
  const { candidates, scanned, noImage } = await collect();
  report(candidates, scanned, noImage);

  if (!APPLY) {
    console.log("\nDRY RUN -- nothing written. Re-run with --apply.");
    return;
  }

  console.log(`\napplying to ${candidates.length} articles…`);
  let written = 0;
  for (const row of candidates) {
    // Updated one row at a time and filtered on the column still being empty:
    // an editor setting a cover while this runs must not be overwritten by it.
    const { error } = await supabase
      .from("cms_articles")
      .update({ hero_image: row.image })
      .eq("id", row.id)
      .or("hero_image.is.null,hero_image.eq.");
    if (error) {
      console.error(`  failed ${row.slug}: ${error.message}`);
      continue;
    }
    written += 1;
    if (written % 100 === 0) console.log(`  ${written}/${candidates.length}`);
  }
  console.log(`done: ${written} written, ${candidates.length - written} failed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
