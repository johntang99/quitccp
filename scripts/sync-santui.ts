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

const FEED_PATH = "feeds/santui.json";
const LOCALE = "zh";
const ORIGIN = "https://santui.tuidang.org";
/** The band shows ten; one page of 精彩推荐 holds fifteen. */
const WANT = 12;
/** Cloudflare's interstitial can take a couple of seconds to resolve. */
const CHALLENGE_TRIES = 8;

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

export interface SantuiDeclaration {
  /** santui's own post id, e.g. 34433563. */
  id: string;
  /**
   * 标题 -- what the declarant called their own statement, so it varies:
   * 退党团队 / 退团队 / 三退声明 / 退出中共共青团和少先队组织. It says which
   * organisations were quit, which "退" alone cannot.
   */
  title: string;
  /** 声明人 as published, already partially masked at the source. */
  name: string;
  /** 来自, e.g. 河北 / 大陆 / 加拿大. */
  from: string;
  /** 人数 -- a statement can be made on behalf of a family. */
  people: string;
  /** Local date of the statement, YYYY-MM-DD. */
  at: string;
  /** The declaration text as published. */
  text: string;
  /** Permalink back to the full statement on santui. */
  href: string;
}

export interface SantuiSnapshot {
  total: number;
  totalDisplay: string;
  sourceUpdatedAt: string;
  fetchedAt: string;
  declarations: SantuiDeclaration[];
}

type Page = {
  goto: (url: string, opts?: unknown) => Promise<unknown>;
  title: () => Promise<string>;
  content: () => Promise<string>;
  waitForTimeout: (ms: number) => Promise<void>;
  evaluate: <T>(script: string) => Promise<T>;
};

/** Navigates, then waits out the Cloudflare interstitial if one is served. */
async function open(page: Page, path: string) {
  await page.goto(ORIGIN + path, { waitUntil: "domcontentloaded", timeout: 45_000 });
  for (let i = 0; i < CHALLENGE_TRIES; i += 1) {
    const title = await page.title();
    if (!/just a moment|attention required|checking your browser/i.test(title)) return;
    await page.waitForTimeout(2_000);
  }
  throw new Error(`Cloudflare challenge did not clear for ${path}`);
}

async function readTotal(page: Page): Promise<{ total: number; display: string; updated: string }> {
  await open(page, "/stat/statics");
  const html = await page.content();
  const total = html.match(/<TOTAL>([\d,]+)<\/TOTAL>/i);
  if (!total) throw new Error("No <TOTAL> in /stat/statics");
  const updated = html.match(/<LASTUPDATE>([^<]+)<\/LASTUPDATE>/i);
  const display = total[1];
  const value = Number(display.replace(/,/g, ""));
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Unusable total: ${display}`);
  return { total: value, display, updated: updated ? updated[1].trim() : "" };
}

/**
 * Reads one page of 精彩推荐.
 *
 * Parsed through the DOM rather than with regexes: the markup nests unclosed
 * `<span>`s and pads everything with `&nbsp;`, so matching on the 声明人/时间/来自
 * labels and taking each one's next element is the only stable reading of it.
 */
async function readDeclarations(page: Page, pageNo: number): Promise<SantuiDeclaration[]> {
  await open(page, `/index/showpage/type/2?page=${pageNo}`);
  // Passed as source text, not as a function: tsx compiles with `keepNames`,
  // which wraps every named function in a `__name()` helper that does not exist
  // in the page and makes Playwright's serialisation throw.
  return page.evaluate(`(() => {
    const field = (li, label) => {
      const tag = Array.from(li.querySelectorAll("span.title1"))
        .find((span) => (span.textContent || "").includes(label));
      return (tag && tag.nextElementSibling && tag.nextElementSibling.textContent || "").trim();
    };
    return Array.from(document.querySelectorAll("li")).map((li) => {
      const link = li.querySelector('a[href*="/index/showpost/id/"]');
      if (!link) return null;
      const href = link.getAttribute("href") || "";
      const match = href.match(/id\\/(\\d+)/);
      const id = match ? match[1] : "";
      const body = li.querySelector(".contentpart");
      const text = ((body && body.textContent) || "").replace(/\\s+/g, " ").trim();
      if (!id || !text) return null;
      const when = field(li, "时间");
      return {
        id: id,
        title: (link.textContent || "").replace(/\\s+/g, " ").trim(),
        name: field(li, "声明人"),
        from: field(li, "来自"),
        people: field(li, "人数"),
        at: when.slice(0, 10),
        text: text,
        href: "https://santui.tuidang.org/index/showpost/id/" + id
      };
    }).filter((row) => row !== null);
  })()`);
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
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    });
    const page = (await context.newPage()) as unknown as Page;

    const { total, display, updated } = await readTotal(page);
    console.log(`总计人数 ${display}  (source updated ${updated || "unknown"})`);

    const seen = new Map<string, SantuiDeclaration>();
    for (let pageNo = 1; pageNo <= 3 && seen.size < WANT; pageNo += 1) {
      const rows = await readDeclarations(page, pageNo);
      for (const row of rows) if (!seen.has(row.id)) seen.set(row.id, row);
      console.log(`精彩推荐 page ${pageNo}: +${rows.length} rows, ${seen.size} unique`);
    }
    if (seen.size === 0) throw new Error("No declarations parsed from 精彩推荐");

    snapshot = {
      total,
      totalDisplay: display,
      sourceUpdatedAt: updated,
      fetchedAt: new Date().toISOString(),
      declarations: Array.from(seen.values()).slice(0, WANT)
    };
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
