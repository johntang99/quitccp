/**
 * Moves the site's own audio recordings off the old server into our Storage.
 *
 *   npx tsx scripts/rehost-article-audio.ts --dry-run
 *   npx tsx scripts/rehost-article-audio.ts --apply
 *   npx tsx scripts/rehost-article-audio.ts --apply --limit 20
 *
 * 481 published articles link an audio file; 244 of those files sit on
 * www.tuidang.org, the server the site is migrating away from. Until they move,
 * every play of a 歌曲 or 乐曲 reaches out to it.
 *
 * ## Only our own files
 *
 * `media.soundofhope.org` hosts 225 of the recordings and `zhuichaguoji`,
 * `zhengjian` and `minghui` a handful more. Those belong to other
 * organisations: re-hosting someone else's media is their call to make, not
 * ours, so only tuidang.org is touched. Everything else is left exactly as it
 * is.
 *
 * ## Shape of the work
 *
 * Keys mirror the old upload path -- `audio/2024/07/xiao_dedu.mp3` -- so two
 * recordings that happen to share a filename in different months cannot collide,
 * and any file can still be traced back to where it came from.
 *
 * Safe to re-run. A file already in Storage is not downloaded again, an article
 * already pointing at Storage is left alone, and only the exact URL is
 * rewritten -- nothing else in the body is touched.
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
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

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36";

/** Ours, and only ours. */
const OUR_HOST = "www.tuidang.org";

const AUDIO = /\[([^\]]*)]\((https?:\/\/[^)\s]+\.(?:mp3|m4a|wav|ogg))\)/gi;

const CONTENT_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg"
};

/**
 * `…/uploads/2024/07/xiao_dedu.mp3` -> `audio/2024/07/xiao_dedu.mp3`.
 *
 * Storage keys must be ASCII, and a good many of these files are named in
 * Chinese -- 三退-九评共产党-方伟-时事焦点-希望之声.mp3. Sanitising those leaves
 * nothing at all, so the key would become `audio/2017/07/.mp3` and any two such
 * recordings from the same month would silently overwrite one another. When the
 * name does not survive, a short digest of the original stands in: unique,
 * and stable across runs so re-running never duplicates a file.
 */
function objectKeyFor(sourceUrl: string): string {
  const path = decodeURIComponent(new URL(sourceUrl).pathname);
  const after = path.split("/wp-content/uploads/")[1] ?? path.replace(/^\/+/, "");
  const parts = after.split("/").filter(Boolean);
  const original = parts.pop() ?? "";
  const ext = (original.match(/\.([a-z0-9]{2,4})$/i)?.[1] ?? "mp3").toLowerCase();

  const folders = parts
    .map((part) => part.toLowerCase().replace(/[^a-z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""))
    .filter(Boolean)
    .join("/");

  const stem = original
    .replace(/\.[a-z0-9]{2,4}$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const digest = createHash("sha1").update(path).digest("hex").slice(0, 10);
  const base = stem.length >= 2 ? `${stem}.${ext}` : `audio-${digest}.${ext}`;
  return `audio/${folders ? `${folders}/` : ""}${base}`;
}

async function main() {
  loadEnvFileIfPresent(resolve(process.cwd(), ".env.local"));
  const apply = process.argv.includes("--apply");
  const limitArg = process.argv.find((a) => a.startsWith("--limit"));
  const limit = limitArg ? Number(limitArg.split("=")[1] ?? process.argv[process.argv.indexOf(limitArg) + 1]) : Infinity;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "media";
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const PUBLIC_PREFIX = `${url}/storage/v1/object/public/${bucket}/`;

  // PostgREST caps a response at 1,000 rows whatever `limit` says.
  const articles: { id: string; slug: string; title: string; body_markdown: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("cms_articles")
      .select("id, slug, title, body_markdown")
      .eq("status", "published")
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    articles.push(...((data ?? []) as typeof articles));
    if (!data || data.length < 1000) break;
  }
  console.log(`scanned ${articles.length} published articles`);

  // One entry per distinct file, with every article that points at it.
  const wanted = new Map<string, string[]>();
  for (const article of articles) {
    for (const match of String(article.body_markdown ?? "").matchAll(AUDIO)) {
      const source = match[2];
      if (!source.includes(OUR_HOST)) continue;
      if (!wanted.has(source)) wanted.set(source, []);
      const list = wanted.get(source) as string[];
      if (!list.includes(article.id)) list.push(article.id);
    }
  }
  const sources = [...wanted.keys()].slice(0, Number.isFinite(limit) ? limit : undefined);
  console.log(`${wanted.size} file(s) on ${OUR_HOST}; this run will handle ${sources.length}\n`);

  const moved = new Map<string, string>();
  let bytes = 0;
  let failed = 0;

  for (const [index, source] of sources.entries()) {
    const objectKey = objectKeyFor(source);
    const publicUrl = `${PUBLIC_PREFIX}${objectKey}`;
    const ext = (objectKey.match(/\.([a-z0-9]{2,4})$/i)?.[1] ?? "mp3").toLowerCase();
    const label = `${String(index + 1).padStart(3)}/${sources.length}`;

    if (!apply) {
      console.log(`${label}  ${source.split("/uploads/")[1]}  ->  ${objectKey}`);
      moved.set(source, publicUrl);
      continue;
    }

    // Already there from an earlier run? Do not fetch it again.
    const folder = objectKey.slice(0, objectKey.lastIndexOf("/"));
    const base = objectKey.slice(objectKey.lastIndexOf("/") + 1);
    const { data: listed } = await supabase.storage.from(bucket).list(folder, { search: base, limit: 1 });
    if (listed?.some((row) => row.name === base)) {
      console.log(`${label}  ${base}  (already in Storage)`);
      moved.set(source, publicUrl);
      continue;
    }

    try {
      const response = await fetch(source, { headers: { "user-agent": UA } });
      const type = response.headers.get("content-type") ?? "";
      if (!response.ok || type.startsWith("text/html")) {
        throw new Error(`${response.status}${type.startsWith("text/html") ? " (challenge page)" : ""}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(objectKey, buffer, { contentType: CONTENT_TYPES[ext] ?? type, upsert: true });
      if (upErr) throw upErr;

      await supabase.from("cms_media_assets").insert({
        asset_type: "file",
        name: base,
        storage_path: publicUrl,
        mime_type: CONTENT_TYPES[ext] ?? type,
        byte_size: buffer.length,
        metadata: { uploadedBy: "script:rehost-article-audio", source }
      });

      bytes += buffer.length;
      moved.set(source, publicUrl);
      console.log(`${label}  ${base}  ${(buffer.length / 1024 / 1024).toFixed(1)}MB`);
    } catch (error) {
      failed += 1;
      console.log(`${label}  FAILED ${base}: ${(error as Error).message}`);
    }
  }

  // Rewrite the bodies, one article at a time, only the addresses that moved.
  let rewritten = 0;
  if (apply && moved.size > 0) {
    const touched = new Set<string>();
    for (const [source, target] of moved) for (const id of wanted.get(source) ?? []) touched.add(id);

    for (const id of touched) {
      const article = articles.find((a) => a.id === id);
      if (!article) continue;
      let body = String(article.body_markdown ?? "");
      let changed = false;
      for (const [source, target] of moved) {
        if (!body.includes(source)) continue;
        body = body.split(source).join(target);
        changed = true;
      }
      if (!changed) continue;
      const { error } = await supabase.from("cms_articles").update({ body_markdown: body }).eq("id", id);
      if (error) {
        console.log(`  body update FAILED for ${article.slug}: ${error.message}`);
        continue;
      }
      rewritten += 1;
    }
  }

  console.log(
    apply
      ? `\nmoved ${moved.size} file(s), ${(bytes / 1024 / 1024).toFixed(0)}MB transferred, ${failed} failed; ${rewritten} article(s) rewritten`
      : `\n--dry-run: nothing downloaded, uploaded or rewritten (pass --apply)`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
