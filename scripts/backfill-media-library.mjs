/**
 * Registers every object already in Storage with the media library.
 *
 * The library lists `cms_media_assets`, but only uploads made through the admin
 * ever wrote a row there -- the 7,000-odd article covers were put into Storage
 * by the WordPress import, which never registered them. So the library showed
 * twelve pictures while the bucket held seven thousand.
 *
 * Idempotent: a row is written only when no row already points at that object,
 * so this can be re-run after any later import.
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const BUCKET = "media";

const EXT = (name) => (name.toLowerCase().match(/\.([a-z0-9]+)$/) || [, ""])[1];
const typeOf = (name) => {
  const e = EXT(name);
  if (["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(e)) return "image";
  if (["mp4", "webm"].includes(e)) return "video";
  return "file";
};
const MIME = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  gif: "image/gif", avif: "image/avif", mp4: "video/mp4", webm: "video/webm"
};

async function* walk(prefix = "", depth = 0) {
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000, offset });
    if (error) throw error;
    if (!data || data.length === 0) return;
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null || !entry.metadata) {
        if (depth < 4) yield* walk(path, depth + 1);
      } else {
        yield { path, entry };
      }
    }
    if (data.length < 1000) return;
    offset += 1000;
  }
}

const known = new Set();
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase
    .from("cms_media_assets")
    .select("storage_path")
    .range(from, from + 999);
  if (error) throw error;
  if (!data || data.length === 0) break;
  for (const row of data) {
    const key = String(row.storage_path || "").split(`/${BUCKET}/`)[1];
    if (key) known.add(decodeURIComponent(key.split("?")[0]));
  }
  if (data.length < 1000) break;
}
console.log(`  already registered: ${known.size}`);

const pending = [];
let seen = 0;
let added = 0;

async function flush() {
  if (pending.length === 0) return;
  const { error } = await supabase.from("cms_media_assets").insert(pending);
  if (error) throw error;
  added += pending.length;
  pending.length = 0;
  process.stdout.write(`\r  registered ${added} new objects (scanned ${seen})   `);
}

for await (const { path, entry } of walk()) {
  seen++;
  if (known.has(path)) continue;
  const name = path.slice(path.lastIndexOf("/") + 1);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  pending.push({
    asset_type: typeOf(name),
    name,
    storage_path: data.publicUrl,
    mime_type: entry.metadata?.mimetype || MIME[EXT(name)] || "",
    byte_size: entry.metadata?.size ?? null,
    created_at: entry.created_at ?? new Date().toISOString(),
    updated_at: entry.updated_at ?? entry.created_at ?? new Date().toISOString(),
    metadata: { source: "storage-backfill" }
  });
  if (pending.length >= 500) await flush();
}
await flush();
console.log(`\n  scanned ${seen} objects, added ${added} rows`);
