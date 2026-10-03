/**
 * Scrapes santui.tuidang.org.
 *
 * Shared by two callers: `scripts/sync-santui.ts` (a local browser) and
 * `app/api/cron/santui` (a hosted browser over WebSocket). It never imports
 * playwright itself -- the caller supplies an already-open page -- so the web
 * app can use it without pulling a browser into the bundle.
 */

export const SANTUI_ORIGIN = "https://santui.tuidang.org";
/** The band shows ten; one page of 精彩推荐 holds fifteen. */
export const WANT = 12;
/** Cloudflare's interstitial can take a couple of seconds to resolve. */
const CHALLENGE_TRIES = 8;
const ORIGIN = SANTUI_ORIGIN;

export const SANTUI_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

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

export type ScrapePage = {
  goto: (url: string, opts?: unknown) => Promise<unknown>;
  title: () => Promise<string>;
  content: () => Promise<string>;
  waitForTimeout: (ms: number) => Promise<void>;
  evaluate: <T>(script: string) => Promise<T>;
};

/** Navigates, then waits out the Cloudflare interstitial if one is served. */
export async function open(page: ScrapePage, path: string) {
  await page.goto(ORIGIN + path, { waitUntil: "domcontentloaded", timeout: 45_000 });
  for (let i = 0; i < CHALLENGE_TRIES; i += 1) {
    const title = await page.title();
    if (!/just a moment|attention required|checking your browser/i.test(title)) return;
    await page.waitForTimeout(2_000);
  }
  throw new Error(`Cloudflare challenge did not clear for ${path}`);
}

export async function readTotal(page: ScrapePage): Promise<{ total: number; display: string; updated: string }> {
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
export async function readDeclarations(page: ScrapePage, pageNo: number): Promise<SantuiDeclaration[]> {
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


/** One full pass: the total plus enough 精彩推荐 rows to fill the band. */
export async function scrapeSantui(
  page: ScrapePage,
  log: (line: string) => void = () => {}
): Promise<SantuiSnapshot> {
  const { total, display, updated } = await readTotal(page);
  log(`总计人数 ${display}  (source updated ${updated || "unknown"})`);

  const seen = new Map<string, SantuiDeclaration>();
  for (let pageNo = 1; pageNo <= 3 && seen.size < WANT; pageNo += 1) {
    const rows = await readDeclarations(page, pageNo);
    for (const row of rows) if (!seen.has(row.id)) seen.set(row.id, row);
    log(`精彩推荐 page ${pageNo}: +${rows.length} rows, ${seen.size} unique`);
  }
  if (seen.size === 0) throw new Error("No declarations parsed from 精彩推荐");

  return {
    total,
    totalDisplay: display,
    sourceUpdatedAt: updated,
    fetchedAt: new Date().toISOString(),
    declarations: Array.from(seen.values()).slice(0, WANT)
  };
}
