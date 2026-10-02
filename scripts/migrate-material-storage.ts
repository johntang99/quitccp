/**
 * Moves every material's assets into a folder of its own.
 *
 *   npx tsx scripts/migrate-material-storage.ts --dry-run
 *   npx tsx scripts/migrate-material-storage.ts --apply
 *
 * Before: the importer wrote flat keys (`materials/zhenxiang-zhanban-1.jpg`)
 * while the uploader wrote nested ones (`materials/<slug>/<file>`), so one lone
 * folder sat buried among fifty files -- and Supabase sorts folders inline with
 * files rather than grouping them first, which makes it genuinely hard to find.
 *
 * After: `materials/<slug>/cover.jpg`, `materials/<slug>/1.jpg`, and so on.
 * With four more categories still to import, twenty named folders beat two
 * hundred loose files.
 *
 * ## Driven by the database, not by filenames
 *
 * Deriving the slug from a filename is not safe here: `zhenxiang-zhanban-2-2.jpg`
 * could be the second image of `zhenxiang-zhanban-2` or the "2-2" of
 * `zhenxiang-zhanban`, and both slugs exist. Only the records know which asset
 * belongs to which material, so the move is driven from `cms_materials` and
 * anything unreferenced is left untouched.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFileIfPresent(filePath: string) {
  try {
    for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (!key || process.env[key] !== undefined) continue;
      process.env[key] = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // optional
  }
}

interface MaterialRow {
  id: string;
  slug: string;
  title: string;
  cover_image: string;
  files: { label: string; url: string; kind: string }[];
}

async function main() {
  loadEnvFileIfPresent(resolve(process.cwd(), ".env.local"));
  const apply = process.argv.includes("--apply");
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "media";
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const PUBLIC_PREFIX = `${url}/storage/v1/object/public/${bucket}/`;

  const { data, error } = await supabase
    .from("cms_materials")
    .select("id, slug, title, cover_image, files")
    .order("slug");
  if (error) throw error;
  const materials = (data ?? []) as MaterialRow[];

  /** The object key a public URL points at, or "" if it is not ours. */
  const keyOf = (value: string): string => {
    const address = value.split("?")[0];
    return address.startsWith(PUBLIC_PREFIX) ? decodeURIComponent(address.slice(PUBLIC_PREFIX.length)) : "";
  };

  /**
   * `materials/zhenxiang-zhanban-1.jpg` -> `materials/zhenxiang-zhanban/1.jpg`.
   * The slug prefix is dropped inside the folder, where it is redundant.
   */
  const targetFor = (objectKey: string, slug: string): string => {
    const base = objectKey.slice(objectKey.lastIndexOf("/") + 1);
    const stripped = base.startsWith(`${slug}-`) ? base.slice(slug.length + 1) : base;
    const name = stripped && !stripped.startsWith(".") ? stripped : base;
    return `materials/${slug}/${name}`;
  };

  let moved = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const material of materials) {
    const rewrites = new Map<string, string>();

    const plan = (value: string) => {
      const objectKey = keyOf(value);
      if (!objectKey) return;
      const target = targetFor(objectKey, material.slug);
      if (objectKey === target) {
        skipped += 1;
        return;
      }
      rewrites.set(objectKey, target);
    };

    plan(material.cover_image);
    for (const file of material.files ?? []) plan(file.url);
    if (rewrites.size === 0) continue;

    console.log(`\n${material.title}  (${material.slug})`);
    for (const [from, to] of rewrites) {
      console.log(`  ${from.replace("materials/", "")}  ->  ${to.replace("materials/", "")}`);
      if (!apply) continue;
      const { error: moveError } = await supabase.storage.from(bucket).move(from, to);
      if (moveError) {
        failures.push(`${from}: ${moveError.message}`);
        rewrites.delete(from);
        continue;
      }
      moved += 1;
    }

    if (!apply) continue;

    // Rewrite the record only for the objects that actually moved, and keep any
    // ?download= suffix -- that is what gives a file its original name back.
    const rewrite = (value: string): string => {
      const objectKey = keyOf(value);
      const target = objectKey ? rewrites.get(objectKey) : undefined;
      if (!target) return value;
      const query = value.includes("?") ? value.slice(value.indexOf("?")) : "";
      return `${PUBLIC_PREFIX}${target}${query}`;
    };

    const nextCover = rewrite(material.cover_image);
    const nextFiles = (material.files ?? []).map((file) => ({ ...file, url: rewrite(file.url) }));
    const { error: saveError } = await supabase
      .from("cms_materials")
      .update({ cover_image: nextCover, files: nextFiles })
      .eq("id", material.id);
    if (saveError) failures.push(`${material.slug}: ${saveError.message}`);

    // The media library points at the old addresses too.
    for (const [from, to] of rewrites) {
      await supabase
        .from("cms_media_assets")
        .update({ storage_path: `${PUBLIC_PREFIX}${to}` })
        .eq("storage_path", `${PUBLIC_PREFIX}${from}`);
    }
  }

  console.log(
    apply
      ? `\nmoved ${moved} object(s); ${skipped} already in place; ${failures.length} failure(s)`
      : `\n--dry-run: nothing moved (${skipped} already in place)`
  );
  for (const failure of failures) console.log(`  FAILED ${failure}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
