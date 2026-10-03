/**
 * Pulls the live registry total and the 精彩推荐 declarations from
 * santui.tuidang.org into `feeds/santui.json`, which the homepage reads.
 *
 *   npm run sync:santui            # fetch and store
 *   npm run sync:santui -- --dry-run
 *
 * ## Why this is a scheduled job and not a fetch in the page
 *
 * santui.tuidang.org sits behind a Cloudflare managed challenge. Every plain
 * HTTP client -- curl, undici, `fetch` in a route handler -- is answered with a
 * 403 "Just a moment..." interstitial on every path, including /stat/statics.
 * Only a real browser that runs the challenge script gets through, which rules
 * out fetching at request time from Vercel.
 *
 * So a browser does it here, on a schedule, and writes a snapshot the site
 * reads from Supabase. That is the better shape anyway: the homepage never
 * waits on a third party, and santui being slow, blocked or down cannot take
 * the registry band with it. The numbers move slowly enough -- a few tens of
 * thousands a day against 466 million -- that an hourly or daily run is ample.
 *
 * ## Sources
 *
 * - `/stat/statics` -- the XML the site itself links as 统计数据 XML:
 *   `<TOTAL>466,911,794</TOTAL>` plus a `<LASTUPDATE>`. This is the publisher's
 *   own machine-readable figure, so we take the count from there rather than
 *   scraping the rendered homepage.
 * - `/index/showpage/type/2` -- 精彩推荐, 15 declarations per page.
 *
 * Nothing is written unless both parse, so a half-failed run leaves the
 * previous good snapshot in place rather than blanking the band.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  SANTUI_USER_AGENT,
  type SantuiSnapshot,
  type ScrapePage,
  scrapeSantui
} from "../apps/web/src/lib/santui-scrape";

const FEED_PATH = "feeds/santui.json";
const LOCALE = "zh";

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

async function main() {
  const cwd = process.cwd();
  loadEnvFileIfPresent(resolve(cwd, ".env.local"));

  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dryRun && (!url || !key)) {
    throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }

  // Imported lazily so the web app never pulls playwright into its build; this
  // script is the only thing that needs a browser.
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  let snapshot: SantuiSnapshot;
  try {
    const context = await browser.newContext({
      locale: "zh-CN",
      userAgent: SANTUI_USER_AGENT
    });
    const page = (await context.newPage()) as unknown as ScrapePage;
    snapshot = await scrapeSantui(page, (line) => console.log(line));
  } finally {
    await browser.close();
  }

  // Truncated, matching formatYi() in the app -- a registry count is a floor.
  const yi = (Math.floor(snapshot.total / 1e6) / 100).toFixed(2);
  console.log(`\n${yi} 亿 · ${snapshot.declarations.length} declarations`);
  for (const row of snapshot.declarations.slice(0, 3)) {
    console.log(`  ${row.at}  ${row.name} · ${row.from}  ${row.text.slice(0, 34)}…`);
  }

  if (dryRun) {
    console.log("\n--dry-run: nothing written");
    return;
  }

  const supabase = createClient(url!, key!, { auth: { persistSession: false } });
  const { data: existing, error: readError } = await supabase
    .from("cms_content_entries")
    .select("id")
    .eq("path", FEED_PATH)
    .eq("locale", LOCALE)
    .maybeSingle();
  if (readError) throw readError;

  if (existing) {
    const { error } = await supabase
      .from("cms_content_entries")
      .update({ data: snapshot, updated_by: "sync:santui" })
      .eq("id", existing.id);
    if (error) throw error;
    console.log(`\nupdated ${FEED_PATH}`);
  } else {
    const { error } = await supabase
      .from("cms_content_entries")
      .insert({ path: FEED_PATH, locale: LOCALE, data: snapshot, updated_by: "sync:santui" });
    if (error) throw error;
    console.log(`\ncreated ${FEED_PATH}`);
  }
}

// Exits explicitly rather than waiting for the event loop to drain: the
// Supabase client keeps a realtime heartbeat alive, so the process can sit idle
// after the work is finished -- which on a runner means a job that never ends
// rather than one that fails.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
