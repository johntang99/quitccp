/**
 * Incremental sync of new articles from the old WordPress site.
 *
 * The old site keeps publishing until cutover day. This pulls whatever it has
 * published since our last import, writes it into `cms_articles`, and moves any
 * images it brings with it into our own storage — so a sync never adds a new
 * dependency on the old server.
 *
 * The cutoff is worked out from the data, not passed in: the newest
 * `published_at` among articles that carry a `legacy_id` (articles written in
 * our own CMS have none, so they cannot push the cutoff forward and make the
 * sync skip things).
 *
 * **Direct API access is blocked.** `www.tuidang.org/wp-json/` answers 403 to
 * everything, including a real browser with a cleared Cloudflare challenge. The
 * pull therefore goes through the read-through proxy that `migrate-wp-posts.ts`
 * already falls back to (`r.jina.ai`) — the same route the original 15,514-post
 * import used. If that proxy ever stops working, the fix is to ask the old site
 * to allow `/wp-json/wp/v2/` directly; nothing else in the pipeline changes.
 *
 * Videos are reported, not imported. See the note at the end of the run.
 *
 *   node --env-file=.env.local scripts/sync-from-old-site.mjs            # dry run
 *   node --env-file=.env.local scripts/sync-from-old-site.mjs --apply
 *   node --env-file=.env.local scripts/sync-from-old-site.mjs --since 2026-09-01 --apply
 */
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const SINCE = (() => {
  const i = args.indexOf("--since");
  return i === -1 ? null : args[i + 1];
})();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WP_BASE_URL = process.env.WP_BASE_URL ?? "https://www.tuidang.org";
const OUT_DIR = path.join(process.cwd(), "artifacts/incremental");
const stamp = new Date().toISOString().slice(0, 10);

function run(command, commandArgs, options = {}) {
  return execFileSync(command, commandArgs, {
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
    env: { ...process.env, WP_BASE_URL },
    ...options
  });
}

// ----------------------------------------------------------------- 1. cutoff
let since = SINCE;
if (!since) {
  const { data, error } = await supabase
    .from("cms_articles")
    .select("published_at, legacy_id")
    .not("legacy_id", "is", null)
    .order("published_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const latest = data?.[0]?.published_at;
  if (!latest) throw new Error("找不到任何带 legacy_id 的文章，请用 --since 指定起点");
  // One day back: WordPress filters on the post date, and a post published the
  // same day as our newest one would otherwise be missed. Re-importing what we
  // already have is free — the import dedupes on slug.
  const d = new Date(latest);
  d.setUTCDate(d.getUTCDate() - 1);
  since = d.toISOString().slice(0, 10);
}
const after = `${since}T00:00:00`;
console.log(`\n  老站：${WP_BASE_URL}`);
console.log(`  起点：${after}${SINCE ? "（手动指定）" : "（按最新一篇导入文章推算）"}\n`);

// ------------------------------------------------------------------- 2. pull
fs.mkdirSync(OUT_DIR, { recursive: true });
const pullFile = path.join(OUT_DIR, `articles-${stamp}.json`);
console.log("  第一步：从老站拉取…");
let pulled;
try {
  pulled = run("npx", ["tsx", "scripts/migrate-wp-posts.ts", "--after", after], { stdio: ["ignore", "pipe", "inherit"] });
} catch (error) {
  console.error("\n  ✗ 拉取失败。若是 403，说明代理通道也被封了，需要老站开放 /wp-json/wp/v2/。");
  throw error;
}
fs.writeFileSync(pullFile, pulled);
const parsed = JSON.parse(pulled);
console.log(`  拉到 ${parsed.total} 篇，已写入 ${path.relative(process.cwd(), pullFile)}\n`);

if (parsed.total === 0) {
  console.log("  老站没有新内容。");
  process.exit(0);
}

// --------------------------------------------------------- 3. what is new
const ids = parsed.rows.map((r) => r.legacyId);
const { data: known } = await supabase.from("cms_articles").select("legacy_id").in("legacy_id", ids);
const knownSet = new Set((known ?? []).map((r) => Number(r.legacy_id)));
const fresh = parsed.rows.filter((r) => !knownSet.has(r.legacyId));
console.log(`  其中 ${knownSet.size} 篇已有，${fresh.length} 篇是新的：`);
for (const r of fresh) {
  console.log(`    ${String(r.publishedAt ?? "").slice(0, 10)}  ${String(r.title).slice(0, 44)}`);
}

// ----------------------------------------------------------------- 4. videos
const allocFile = path.join(OUT_DIR, `video-allocation-${stamp}.json`);
run("npx", ["tsx", "scripts/allocate-videos.ts", pullFile, allocFile], { stdio: ["ignore", "ignore", "ignore"] });
const alloc = JSON.parse(fs.readFileSync(allocFile, "utf8"));
const importable = alloc.items.filter((i) => ["series", "tagged", "rescue"].includes(i.group));
const orphans = alloc.items.filter((i) => i.group === "orphan");
console.log(`\n  影片判定：可直接导入 ${importable.length} 条，待定（orphan）${orphans.length} 条`);
for (const o of orphans) console.log(`    待定  ${o.category}  ${String(o.slug).slice(0, 40)}`);

if (!APPLY) {
  console.log("\n  空跑 —— 没有写入。确认后加 --apply。");
  process.exit(0);
}

// ----------------------------------------------------------------- 5. import
console.log("\n  第二步：导入文章…");
// Dedupes on slug + locale, so re-running is safe.
run("npx", ["tsx", "scripts/import-normalized-posts.ts", pullFile, "--apply"], { stdio: ["ignore", "inherit", "inherit"] });

if (importable.length > 0) {
  console.log("\n  第三步：导入影片…");
  run("npx", ["tsx", "scripts/import-videos.ts", "--apply"], { stdio: ["ignore", "inherit", "inherit"] });
} else {
  console.log("\n  第三步：没有可直接导入的影片，跳过。");
}

// ---------------------------------------------------------------- 6. rehost
console.log("\n  第四步：把新文章带来的图片转存到我们自己的存储…");
run("node", ["--env-file=.env.local", "scripts/rehost-media-to-storage.mjs", "--apply"], {
  stdio: ["ignore", "inherit", "inherit"]
});

// ---------------------------------------------------------------- 7. verify
const { count: total } = await supabase.from("cms_articles").select("id", { count: "exact", head: true });
let left = 0;
for (let y = 2002; y <= new Date().getFullYear(); y += 1) {
  const { count } = await supabase
    .from("cms_articles")
    .select("id", { count: "exact", head: true })
    .ilike("body_markdown", "%tuidang.org/wp-content/%")
    .gte("published_at", `${y}-01-01`)
    .lt("published_at", `${y + 1}-01-01`);
  left += count ?? 0;
}
console.log(`\n  完成。文章总数 ${total}，正文里仍指向老站的行数 ${left}`);
if (orphans.length > 0) {
  console.log(
    `\n  注意：${orphans.length} 条内容带播放器但归类不明（orphan），按上次全量导入的既定做法未收进影片库，\n` +
      "  它们作为文章仍可正常阅读。要不要收进影片库，需要人工决定。"
  );
}
