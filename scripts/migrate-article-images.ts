/**
 * Moves tuidang.org-hosted article images into Supabase Storage.
 *
 * Only images served from the old site are copied. Anything hosted by another
 * organisation -- 大纪元, 明慧, 正见, 新唐人, Flickr -- is left where it is: those
 * are not ours to re-host.
 *
 *   npx tsx scripts/migrate-article-images.ts <normalized.json> [--apply] [--limit N]
 *
 * Without --apply it reports what it would do and writes nothing.
 * It is safe to re-run: an image already in the bucket is reused, not re-fetched.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnv(filePath: string) {
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

/** Hosts whose images we own and may move. */
const OURS = /^(www\.)?tuidang\.org$/i;

interface Row {
  legacyId: number;
  slug: string;
  heroImage?: string;
  bodyMarkdown: string;
  [key: string]: unknown;
}

function isOurs(url: string): boolean {
  try {
    return OURS.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Stable path from the URL, so re-runs reuse the same object. */
function storagePath(url: string): string {
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 16);
  const ext = (url.split("?")[0].match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? "jpg").toLowerCase();
  return `articles/${hash.slice(0, 2)}/${hash}.${ext}`;
}

function collectUrls(rows: Row[]): string[] {
  const urls = new Set<string>();
  for (const row of rows) {
    if (row.heroImage && isOurs(row.heroImage)) urls.add(row.heroImage);
    for (const match of row.bodyMarkdown.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) {
      if (isOurs(match[1])) urls.add(match[1]);
    }
  }
  return [...urls];
}

async function main() {
  loadEnv(resolve(process.cwd(), "apps/web/.env.local"));
  const [input] = process.argv.slice(2);
  const apply = process.argv.includes("--apply");
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;
  if (!input) throw new Error("Usage: migrate-article-images.ts <normalized.json> [--apply] [--limit N]");

  const parsed = JSON.parse(readFileSync(input, "utf8")) as { rows?: Row[] };
  const rows = parsed.rows ?? [];
  const urls = collectUrls(rows).slice(0, limit);

  console.error(`文章 ${rows.length} 篇，其中 tuidang.org 图片 ${urls.length} 张（去重后）`);
  if (!apply) {
    console.error("未加 --apply，仅统计，不下载也不写入。");
    console.error("样本:");
    for (const url of urls.slice(0, 5)) console.error(`  ${url}\n    -> ${storagePath(url)}`);
    return;
  }

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "media";
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false }
  });
  const publicBase = `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucket}/`;

  const map: Record<string, string> = {};
  const failures: { url: string; reason: string }[] = [];
  let uploaded = 0;
  let reused = 0;
  let bytes = 0;

  // Small concurrency: enough to keep the pipe busy, gentle on the old site.
  const QUEUE = 6;
  let cursor = 0;

  async function worker() {
    while (cursor < urls.length) {
      const url = urls[cursor++];
      const path = storagePath(url);
      try {
        // Already there from an earlier run?
        const folder = path.slice(0, path.lastIndexOf("/"));
        const name = path.slice(path.lastIndexOf("/") + 1);
        const { data: existing } = await supabase.storage.from(bucket).list(folder, { search: name });
        if (existing?.some((file) => file.name === name)) {
          map[url] = publicBase + path;
          reused++;
          continue;
        }

        const response = await fetch(url, {
          headers: { "user-agent": "Mozilla/5.0 (compatible; quitccp-media-migrator/1.0)" }
        });
        if (!response.ok) {
          failures.push({ url, reason: `HTTP ${response.status}` });
          continue;
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length === 0) {
          failures.push({ url, reason: "empty" });
          continue;
        }
        const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
          contentType: response.headers.get("content-type") ?? "image/jpeg",
          upsert: true
        });
        if (error) {
          failures.push({ url, reason: error.message });
          continue;
        }
        map[url] = publicBase + path;
        uploaded++;
        bytes += buffer.length;
      } catch (error) {
        failures.push({ url, reason: error instanceof Error ? error.message : "unknown" });
      }
      const done = uploaded + reused + failures.length;
      if (done % 200 === 0) {
        console.error(`[images] ${done}/${urls.length} · 新传 ${uploaded} · 复用 ${reused} · 失败 ${failures.length}`);
      }
    }
  }

  await Promise.all(Array.from({ length: QUEUE }, () => worker()));

  // Rewrite the rows to point at the bucket.
  let rewritten = 0;
  for (const row of rows) {
    if (row.heroImage && map[row.heroImage]) {
      row.heroImage = map[row.heroImage];
      rewritten++;
    }
    const before = row.bodyMarkdown;
    row.bodyMarkdown = before.replace(/(!\[[^\]]*\]\()([^)\s]+)/g, (whole, prefix, url) =>
      map[url] ? `${prefix}${map[url]}` : whole
    );
    if (row.bodyMarkdown !== before) rewritten++;
  }

  const outPath = input.replace(/\.json$/, "-hosted.json");
  writeFileSync(outPath, JSON.stringify({ ...parsed, rows }));
  writeFileSync(input.replace(/\.json$/, "-image-map.json"), JSON.stringify({ map, failures }, null, 1));

  console.error(`\n完成：新传 ${uploaded} · 复用 ${reused} · 失败 ${failures.length} · ${(bytes / 1024 / 1024).toFixed(0)} MB`);
  console.error(`改写了 ${rewritten} 处引用 -> ${outPath}`);
  if (failures.length > 0) {
    console.error("失败样本:");
    for (const failure of failures.slice(0, 5)) console.error(`  ${failure.reason}  ${failure.url}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
