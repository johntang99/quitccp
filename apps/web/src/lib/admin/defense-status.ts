import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { t } from "@/lib/i18n";
import { SITE_LOCALE } from "@/lib/site-config";
import { mirrorRewrite, rewriteMediaUrl } from "@/lib/media-mirror";
import { AwsClient } from "aws4fetch";

/**
 * Whether the hardening put in during the attack of 2026-10-13 is still in
 * force. One function, read by two callers: the dashboard panel and the
 * self-check cron that mails when something breaks. Both have to agree on what
 * "healthy" means, so neither owns the definition.
 *
 * ## Why the probes avoid our own public pages
 *
 * The obvious design -- fetch a few of our own URLs and look at the answers --
 * does not work while the site is under attack, and this is worth writing down
 * because it will look like a bug later. Measured 2026-10-15:
 *
 *   https://www.tuidang.org/            429   x-vercel-mitigated: challenge
 *   https://<deployment>.vercel.app/    302   -> Vercel SSO login
 *
 * The public origin challenges everything that is not a real browser, which is
 * the entire point of it; and the deployment URL sits behind Deployment
 * Protection. So a server-side probe of our own site gets nothing useful from
 * either address.
 *
 * Hence the split below. Most checks read the database or Cloudflare directly
 * and need no HTTP to ourselves at all. The three that genuinely require a
 * rendered page are attempted anyway and degrade to `unknown` when the
 * challenge answers -- "could not measure", never "broken", and carrying the
 * instructions for letting them through as their remedy, since the panel is
 * where somebody will go looking. See PROBE_BYPASS_HEADER.
 *
 * ## What is deliberately not here
 *
 * The firewall's rules and the attack traffic itself. Reading those needs a
 * Vercel API token, and there is none in the environment; they are also the one
 * part already visible in a console somebody watches. What this file adds is
 * the part nobody was watching.
 */

export type CheckState = "ok" | "warn" | "bad" | "unknown";

export interface DefenseCheck {
  /** Stable across runs: the alerter compares this run to the last one by key. */
  key: string;
  label: string;
  state: CheckState;
  /** What was measured. Shown in the panel as the figure under the label. */
  value: string;
  /** Shown, and mailed, only when the state is not ok. */
  remedy?: string;
}

export interface DefenseReport {
  checks: DefenseCheck[];
  /** The worst state in the set. `bad` is what the cron mails about. */
  worst: CheckState;
  checkedAt: string;
}

/**
 * A request carrying this header with the right secret is meant to skip the
 * attack challenge, so the two render-dependent checks below can run.
 *
 * It is not a backdoor into anything: the header only changes whether Vercel's
 * firewall challenges the request, and the pages it reaches are the public ones
 * every reader already gets. Set PROBE_BYPASS_SECRET here and add the matching
 * Allow rule in Vercel, above the challenge rule.
 */
const PROBE_BYPASS_HEADER = "x-quitccp-probe";

/** Short on purpose: a health check that hangs is worse than one that fails. */
const PROBE_TIMEOUT_MS = 8000;

const UA = "quitccp-selfcheck/1.0 (+https://www.tuidang.org)";

function worstOf(checks: DefenseCheck[]): CheckState {
  if (checks.some((c) => c.state === "bad")) return "bad";
  if (checks.some((c) => c.state === "warn")) return "warn";
  if (checks.some((c) => c.state === "unknown")) return "unknown";
  return "ok";
}

/**
 * The five characters React escapes when it writes text into HTML.
 *
 * Without this the freshness check below compares a database title against a
 * page that spells it differently and concludes the page is stale -- and then
 * mails about it. Three published articles have titles that trip it:
 * 「性酷刑&妻小做人质…」, 「美德州A&M大学…」, 「幸存： \"烈士\"感想」.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** Whether the page says this, however the renderer chose to spell it. */
function htmlContainsText(html: string, text: string): boolean {
  return html.includes(text) || html.includes(escapeHtml(text));
}

function publicOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw && !/localhost|127\.0\.0\.1/.test(raw)) return raw.replace(/\/$/, "");
  return "https://www.tuidang.org";
}

/** True when Vercel's firewall answered instead of our application. */
function wasChallenged(response: Response): boolean {
  return response.status === 429 && response.headers.get("x-vercel-mitigated") === "challenge";
}

async function probe(url: string, init: RequestInit = {}): Promise<Response | null> {
  try {
    const secret = process.env.PROBE_BYPASS_SECRET?.trim();
    return await fetch(url, {
      ...init,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      headers: {
        "user-agent": UA,
        ...(secret ? { [PROBE_BYPASS_HEADER]: secret } : {}),
        ...(init.headers ?? {})
      }
    });
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * 1. The media mirror switch
 * ------------------------------------------------------------------ */

/**
 * Whether this running build rewrites media URLs to the mirror at all.
 *
 * Worth its own check because the failure is silent and the cause is easy to
 * reach: NEXT_PUBLIC_MEDIA_MIRROR_HOST is baked in at build time, so losing it
 * -- or setting it after the fact without redeploying -- sends every visitor
 * back to Supabase for every image, with nothing in any log to say so.
 */
function checkMirrorSwitch(): DefenseCheck {
  const rule = mirrorRewrite();
  if (!rule) {
    return {
      key: "mirror_switch",
      label: t("sc.mirrorSwitch"),
      state: "bad",
      value: t("sc.mirrorSwitch.off"),
      remedy:
        t("sc.mirrorSwitch.remedy")
    };
  }
  return {
    key: "mirror_switch",
    label: t("sc.mirrorSwitch"),
    state: "ok",
    value: rule.to.replace(/^\/\//, "").replace(/\/$/, "")
  };
}

/* ------------------------------------------------------------------ *
 * 2. Every media file is on the mirror
 * ------------------------------------------------------------------ */

/** Classified missing files, so the panel can say which kind it found. */
const MAX_CLASSIFY = 25;

/**
 * Compares the whole media table against the whole bucket.
 *
 * It used to check the three newest uploads, and that was not enough. On
 * 2026-10-15 it did catch a real fault -- 21 of the last 39 video covers were
 * never reaching R2 -- but only because the three newest all happened to be
 * among the failures. Three good uploads landing afterwards would have turned
 * the panel green with 21 files still missing, and nothing would ever have
 * looked again. A window that small does not answer "is the mirror complete",
 * it answers "did the last upload work", and those are different questions.
 *
 * The whole bucket is one paged LIST -- nine calls for 8,573 objects -- and the
 * whole table is one column of one query. Comparing two sets is free. So the
 * complete answer costs about what the three-file sample did.
 *
 * ## Why missing files are classified, not just counted
 *
 * 13 rows from the October content migration point at objects Supabase itself
 * answers `NoSuchKey` for: each is the highest-numbered file in its folder,
 * the signature of an import that registered N files and uploaded N-1. They
 * cannot be mirrored, because there is nothing to mirror. Counting them with
 * the real failures would leave this check permanently red, and a check that
 * is always red is a check nobody reads.
 *
 * So each missing file is asked about at the source: gone from Supabase too is
 * an orphan row (reported, not alarmed about); present at the source but not
 * on the mirror is a copy that failed (alarmed about).
 */
async function checkMirrorComplete(): Promise<DefenseCheck> {
  const key = "mirror_sync";
  const label = t("sc.mirrored");
  const rule = mirrorRewrite();
  if (!rule) return { key, label, state: "unknown", value: t("sc.mirrored.off") };

  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return { key, label, state: "unknown", value: t("sc.mirrored.noR2") };
  }
  const endpoint = process.env.R2_ENDPOINT?.trim() || `https://${accountId}.r2.cloudflarestorage.com`;
  const aws = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });

  try {
    /* Every key in the bucket. Paged, because a 1000-object page would have
       reported a healthy mirror as broken the day the bucket outgrew it. */
    const have = new Set<string>();
    let token: string | undefined;
    do {
      const url =
        `${endpoint}/${bucket}?list-type=2&max-keys=1000` +
        (token ? `&continuation-token=${encodeURIComponent(token)}` : "");
      const response = await aws.fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`R2 list ${response.status}`);
      const xml = await response.text();
      for (const [, block] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
        const k = block.match(/<Key>([^<]+)<\/Key>/)?.[1];
        if (k) have.add(k);
      }
      token = /<IsTruncated>true<\/IsTruncated>/.test(xml)
        ? xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1]
        : undefined;
    } while (token);

    /*
     * Paged, because PostgREST caps a select at 1000 rows and says nothing
     * about it. The first version of this check read 1000 of 7,994 and
     * reported「1000 个全在」-- a complete-sounding answer to a quarter of the
     * question. It was caught only because the count is printed; had the value
     * read「全在」the check would have looked healthy while six thousand files
     * went unexamined.
     *
     * The count stays in the panel for that reason: a total that can be
     * compared against the media library is what makes this check falsifiable.
     */
    const supabase = createSupabaseAdminClient();
    const PAGE = 1000;
    const rows: { storage_path: string | null; created_at: string | null }[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("cms_media_assets")
        .select("storage_path, created_at")
        .order("created_at", { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      const page = data ?? [];
      rows.push(...page);
      if (page.length < PAGE) break;
      /* A runaway table must not turn an hourly check into a long job. */
      if (rows.length >= 100_000) break;
    }

    const missing: { key: string; url: string; createdAt: string }[] = [];
    for (const row of rows) {
      const path = String(row.storage_path ?? "");
      const at = path.indexOf(rule.from.replace(/^\/\//, ""));
      const cut = path.indexOf("/storage/v1/object/public/");
      if (cut === -1 && at === -1) continue;
      const after = path.slice(path.indexOf("/object/public/") + "/object/public/".length);
      /* `bucket/key`, and the key may carry a `?download=` the reader needs but
         R2 never saw -- stripping it is the difference between a true report
         and 10 phantom misses. */
      const raw = after.slice(after.indexOf("/") + 1).split("?")[0];
      let decoded = raw;
      try {
        decoded = decodeURIComponent(raw);
      } catch {
        /* A key that will not decode is compared as written. */
      }
      if (have.has(decoded) || have.has(raw)) continue;
      missing.push({ key: decoded, url: path, createdAt: String(row.created_at ?? "") });
    }

    if (missing.length === 0) {
      return { key, label, state: "ok", value: t("sc.mirrored.allThere", { n: rows.length }) };
    }

    /* Ask the source about each one, up to a bound: an archive that has lost
       its source cannot be mirrored and must not be alarmed about. */
    const sample = missing.slice(0, MAX_CLASSIFY);
    const verdicts = await Promise.all(
      sample.map(async (m) => {
        const response = await probe(m.url, { method: "HEAD" });
        /* Supabase answers 400 with a NoSuchKey body for a missing object, so
           anything that is not a 200 counts as "not at the source". */
        return { ...m, atSource: response?.status === 200 };
      })
    );
    const broken = verdicts.filter((v) => v.atSource);
    const orphans = verdicts.filter((v) => !v.atSource);
    const unclassified = missing.length - sample.length;

    if (broken.length === 0 && unclassified === 0) {
      return {
        key,
        label,
        state: "warn",
        value: t("sc.mirrored.orphans", { n: orphans.length }),
        remedy:
          t("sc.mirrored.orphansRemedy", {
            n: orphans.length,
            examples: orphans.slice(0, 3).map((o) => o.key).join(t("admin.listSep"))
          })
      };
    }

    return {
      key,
      label,
      state: "bad",
      value: t("sc.mirrored.broken", { n: broken.length + unclassified }),
      remedy:
        t("sc.mirrored.brokenRemedy", {
          host: rule.to.replace(/^\/\//, "").replace(/\/$/, ""),
          examples: broken.slice(0, 3).map((b) => b.key).join(t("admin.listSep"))
        }) +
        (orphans.length > 0 ? t("sc.mirrored.brokenAlsoOrphans", { n: orphans.length }) : "")
    };
  } catch (error) {
    return {
      key,
      label,
      state: "unknown",
      value: t("sc.mirrored.compareFailed"),
      remedy: t("sc.mirrored.compareFailedRemedy", {
        error: error instanceof Error ? error.message : t("sc.unknownError")
      })
    };
  }
}

/* ------------------------------------------------------------------ *
 * 3. The search body scan is still bounded
 * ------------------------------------------------------------------ */

/**
 * Calls the bounded body-search function to prove it is still there.
 *
 * It cannot read the 5s ceiling back -- that lives in pg_proc.proconfig, and
 * this application has no direct Postgres connection, only PostgREST. What it
 * can establish is the part that would actually break: that migration 026 is
 * applied, that `service_role` may still execute it, and that the application
 * is therefore not quietly falling back to the unbounded filter.
 *
 * The probe term is long enough to use the trigram index and matches nothing,
 * so it costs an index lookup rather than the 2.4s scan the ceiling exists to
 * bound. Measured locally at 30-60ms.
 */
async function checkSearchBound(): Promise<DefenseCheck> {
  const key = "search_bound";
  const label = t("sc.searchTimeout");
  try {
    const supabase = createSupabaseAdminClient();
    const started = Date.now();
    const { error } = await supabase.rpc("search_articles_body", {
      p_t1: ["%zzqqxxjjselfcheck%"],
      p_t2: null,
      p_t3: null,
      p_t4: null,
      p_locale: SITE_LOCALE,
      p_limit: 1
    });
    const ms = Date.now() - started;
    if (error) {
      return {
        key,
        label,
        state: "bad",
        value: t("sc.searchTimeout.broken"),
        remedy:
          t("sc.searchTimeout.brokenRemedy", { error: error.message })
      };
    }
    return { key, label, state: "ok", value: `${ms} ms` };
  } catch (error) {
    return {
      key,
      label,
      state: "unknown",
      value: t("sc.unmeasurable"),
      remedy: error instanceof Error ? error.message : t("sc.unknownError")
    };
  }
}

/* ------------------------------------------------------------------ *
 * 4. The log archive is still receiving
 * ------------------------------------------------------------------ */

/**
 * Whether Vercel's log drain is still filing batches into R2.
 *
 * Vercel keeps runtime logs for a day. The archive exists because after
 * 2026-10-13 the question we kept wanting to ask was "what was arriving at
 * 03:40" and by the time anyone asked, the answer had expired. An archive that
 * quietly stopped receiving is worse than no archive: it looks like one right
 * up until the day somebody needs it.
 *
 * Nothing else would notice. The drain lives in Vercel's settings, the Worker
 * in Cloudflare's, and a broken one between them makes no noise anywhere --
 * the site serves pages exactly as before.
 *
 * Three hour-prefixes rather than a full listing, because the keys sort
 * lexicographically and finding the newest by paging to the end of `logs/`
 * gets more expensive every day the archive grows. The question is only ever
 * "did anything arrive recently", and that is a bounded lookup.
 */
async function checkLogArchive(): Promise<DefenseCheck> {
  const key = "log_archive";
  const label = t("sc.logArchive");

  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_LOG_BUCKET?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return { key, label, state: "unknown", value: t("sc.logArchive.unconfigured") };
  }

  const endpoint = process.env.R2_ENDPOINT?.trim() || `https://${accountId}.r2.cloudflarestorage.com`;
  const aws = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });

  const listPrefix = async (prefix: string, max: number) => {
    const url = `${endpoint}/${bucket}?list-type=2&max-keys=${max}&prefix=${encodeURIComponent(prefix)}`;
    const response = await aws.fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`R2 list ${response.status}`);
    const xml = await response.text();
    /* Parsed out of the <Contents> blocks rather than by scanning for <Key>
       anywhere: a stray match outside a block once made an empty listing look
       like a populated one. */
    const blocks = [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map((m) => m[1]);
    return blocks.map((b) => ({
      size: Number(b.match(/<Size>(\d+)<\/Size>/)?.[1] ?? 0),
      modified: b.match(/<LastModified>([^<]+)<\/LastModified>/)?.[1] ?? ""
    }));
  };

  const p = (n: number) => String(n).padStart(2, "0");
  const hourPrefix = (d: Date) =>
    `logs/${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())}/${p(d.getUTCHours())}/`;

  try {
    const now = Date.now();
    const recent = (
      await Promise.all(
        [0, 1, 2].map((back) => listPrefix(hourPrefix(new Date(now - back * 3_600_000)), 1000))
      )
    ).flat();

    if (recent.length > 0) {
      const bytes = recent.reduce((sum, o) => sum + o.size, 0);
      const newest = recent
        .map((o) => new Date(o.modified).getTime())
        .filter((t) => Number.isFinite(t))
        .sort((a, b) => b - a)[0];
      const mins = newest ? Math.round((now - newest) / 60_000) : null;
      const size = bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.round(bytes / 1024)}KB`;
      return {
        key,
        label,
        state: "ok",
        value: t("sc.logArchive.ok", {
          n: recent.length,
          size,
          age: mins === null ? "" : t("sc.logArchive.age", { mins })
        })
      };
    }

    /* Nothing in three hours. An archive that has never received anything is
       a drain that was never created -- a to-do, not a fault -- so the two are
       told apart before anyone is alarmed. */
    const ever = await listPrefix("logs/", 1);
    if (ever.length === 0) {
      return {
        key,
        label,
        state: "unknown",
        value: t("sc.logArchive.empty"),
        remedy:
          t("sc.logArchive.emptyRemedy")
      };
    }
    return {
      key,
      label,
      state: "bad",
      value: t("sc.logArchive.stale"),
      remedy:
        t("sc.logArchive.staleRemedy")
    };
  } catch (error) {
    return {
      key,
      label,
      state: "unknown",
      value: t("sc.logArchive.unreadable"),
      remedy: t("sc.logArchive.unreadableRemedy", {
        error: error instanceof Error ? error.message : t("sc.unknownError")
      })
    };
  }
}

/* ------------------------------------------------------------------ *
 * There is no "is the firewall still challenging" probe, deliberately
 * ------------------------------------------------------------------ *
 *
 * There was one. It asked for the homepage without the bypass header and
 * expected to be turned away, which worked until the bypass rule existed --
 * and then reported "未挑战（HTTP 200）" on every run while the firewall was
 * plainly still challenging everything else. Measured 2026-10-15: the same
 * request from a laptop got 429, from inside the function 200.
 *
 * The cause is that bot protection is decided largely from the TLS
 * fingerprint, at connection time, and Node's fetch pools connections. The
 * other probes in this file send the bypass header over that pool, so by the
 * time the unheadered request goes out it is riding a connection the edge has
 * already cleared. A probe cannot ask "what does an ordinary request get" from
 * a process that is concurrently making extraordinary ones.
 *
 * It could be forced onto a fresh connection, but it was never worth much:
 * it only ever reported `warn`, and turning the challenge off is a decision
 * somebody makes on purpose once the attack is over. The firewall's own state
 * is visible in `vercel firewall status`, which is the right place for it.
 *
 * Do not add it back without solving the connection reuse.
 */

/* ------------------------------------------------------------------ *
 * 5 & 6. The two that need a rendered page
 * ------------------------------------------------------------------ */

/**
 * Fetches one published article page and reads three things off it.
 *
 * One fetch for all three because they are the same question asked three ways
 * -- "is what we built still what a visitor gets" -- and because all three
 * regress the same silent way, with the page still rendering perfectly:
 *
 *   - 走 CDN 缓存    a `cookies()` call added anywhere in the tree makes the
 *                   page dynamic again, and then every request in a flood
 *                   reaches the database. This is the shape of 10-13.
 *   - 内容是最新的    the save-time `revalidatePath` stops firing, so editors'
 *                   changes never appear. Cached and wrong looks exactly like
 *                   cached and right from the outside.
 *   - 图片走镜像      a lost environment variable, or new code calling
 *                   getPublicUrl() directly, sends images back to Supabase.
 *
 * Nothing else here would notice any of them, and none of them logs anything.
 *
 * The article chosen is the most recently *updated* one rather than the most
 * recently published, because that is the only one whose freshness says
 * anything: an article nobody has touched for a week would agree with its page
 * even if revalidation had been broken the whole time.
 *
 * Returns all three as `unknown` when the firewall answers instead, which is
 * what happens until the Allow rule for PROBE_BYPASS_HEADER exists. See the
 * note at the top of this file for why this cannot be measured any other way.
 */
async function checkRenderedPage(): Promise<DefenseCheck[]> {
  const cacheKey = "page_cached";
  const cacheLabel = t("sc.cdnCache");
  const freshKey = "page_fresh";
  const freshLabel = t("sc.pageFresh");
  const htmlKey = "page_media_r2";
  const htmlLabel = t("sc.imagesMirrored");

  const blocked = (why: string, remedy?: string): DefenseCheck[] =>
    [
      { key: cacheKey, label: cacheLabel },
      { key: freshKey, label: freshLabel },
      { key: htmlKey, label: htmlLabel }
    ].map((c) => ({ ...c, state: "unknown" as CheckState, value: why, remedy }));

  /* The remedy for the one case that is expected rather than wrong. Written
     out in full because this panel is where somebody will come looking for it
     six months from now, not the documentation. */
  const bypassRemedy =
    t("sc.bypassRemedy");

  let article: { slug: string; title: string } | null = null;
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("cms_articles")
      .select("slug, title")
      .eq("status", "published")
      .eq("locale", SITE_LOCALE)
      .order("updated_at", { ascending: false })
      .limit(1);
    const row = data?.[0];
    if (row?.slug && row?.title) article = { slug: row.slug, title: row.title };
  } catch {
    return blocked(t("sc.cannotReadArticle"));
  }
  if (!article) return blocked(t("sc.noPublishedArticle"));

  const url = `${publicOrigin()}/news/${article.slug}`;

  /*
   * Asked up to three times, with a pause, and the best answer wins.
   *
   * Every deploy empties the CDN cache, so the first request for any page
   * after one is a MISS by design -- that is the cache working, not failing.
   * An earlier version asked twice back to back and still read MISS twice,
   * because the second request raced the first one's cache write; it mailed
   * about a page that answered HIT five times out of five a minute later.
   * Widening the alert rule did not help, because on a day of frequent
   * deploys the two runs it wants are both post-deploy.
   *
   * So the retry has to be the probe's, not the alerter's: a pause long
   * enough for our own first request to have populated the cache. What this
   * check exists to catch -- a page that went dynamic again -- misses on
   * every request forever, and so still fails all three.
   */
  const CACHE_ATTEMPTS = 3;
  const CACHE_RETRY_MS = 2500;
  const CACHED = /^(HIT|STALE|PRERENDER|REVALIDATED)$/i;

  let response: Response | null = null;
  let cacheHeader = "";
  let html = "";
  for (let attempt = 0; attempt < CACHE_ATTEMPTS; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, CACHE_RETRY_MS));
    response = await probe(url);
    if (!response) return blocked(t("sc.cannotConnect"));
    if (wasChallenged(response)) return blocked(t("sc.challenged"), bypassRemedy);
    cacheHeader = response.headers.get("x-vercel-cache") ?? "";
    html = await response.text();
    if (CACHED.test(cacheHeader)) break;
  }

  const checks: DefenseCheck[] = [];

  /* --- 1. still served from the edge cache --- */
  if (!cacheHeader) {
    checks.push({ key: cacheKey, label: cacheLabel, state: "unknown", value: t("sc.cdnCache.noHeader") });
  } else if (CACHED.test(cacheHeader)) {
    checks.push({ key: cacheKey, label: cacheLabel, state: "ok", value: cacheHeader });
  } else {
    checks.push({
      key: cacheKey,
      label: cacheLabel,
      state: "bad",
      value: cacheHeader,
      remedy:
        t("sc.cdnCache.missRemedy", { n: CACHE_ATTEMPTS, header: cacheHeader })
    });
  }

  /* --- 2. the cached copy is the current one ---
     Cached and stale looks identical to cached and correct from outside, so
     this compares the page against the row it was rendered from. The title is
     the right field to compare: it is on every article, it is what an editor
     most often changes, and it appears in the HTML verbatim. */
  const titleInPage = htmlContainsText(html, article.title);
  if (titleInPage) {
    checks.push({ key: freshKey, label: freshLabel, state: "ok", value: t("sc.pageFresh.ok") });
  } else {
    checks.push({
      key: freshKey,
      label: freshLabel,
      state: "bad",
      value: t("sc.pageFresh.stale"),
      remedy:
        t("sc.pageFresh.staleRemedy", { slug: article.slug, title: article.title })
    });
  }

  /* --- 3. the images a visitor gets come from the mirror ---
     Counting both hosts rather than just looking for the mirror: a page with no
     images at all would otherwise pass, and the number that matters is how many
     requests still land on unprotected Supabase Storage. */
  const rule = mirrorRewrite();
  if (!rule) {
    checks.push({ key: htmlKey, label: htmlLabel, state: "unknown", value: t("sc.mirrored.off") });
  } else {
    const mirrorHost = rule.to.replace(/^\/\//, "").replace(/\/$/, "");
    const onMirror = html.split(mirrorHost).length - 1;
    /*
     * Counted as "prefix plus at least one filename character", not as a bare
     * substring, because the page legitimately contains the prefix on its own.
     * media-failover.ts ships a script holding both hosts as constants:
     *
     *   var f="//media.tdinfo.org/", t="//<ref>.supabase.co/.../media/";
     *
     * so a bare count reported「2 处仍指向 Supabase」on a page whose images were
     * all on the mirror -- twice, because the string appears again in the RSC
     * payload. The failover constant ends at the bucket; a real asset has a
     * filename after it. That single character is the whole difference.
     */
    const assetRef = new RegExp(
      rule.from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[A-Za-z0-9_%-]",
      "g"
    );
    const onSupabase = (html.match(assetRef) ?? []).length;
    if (onSupabase > 0) {
      checks.push({
        key: htmlKey,
        label: htmlLabel,
        state: "bad",
        value: t("sc.images.onSupabase", { n: onSupabase }),
        remedy:
          t("sc.images.onSupabaseRemedy")
      });
    } else if (onMirror === 0) {
      checks.push({ key: htmlKey, label: htmlLabel, state: "unknown", value: t("sc.images.none") });
    } else {
      /* The page points at the mirror -- but pointing at it and it answering
         are two different things, and Cloudflare caches an R2 404 for four
         hours, so a missing object stays missing well after it is fixed. One
         HEAD closes that gap. The reader does not break either way: the
         failover in media-failover.ts falls back to Supabase in the browser. */
      /* The host is interpolated into a pattern, so its dots have to stop being
         metacharacters -- otherwise media.tdinfo.org also matches mediaXtdinfo.org. */
      const hostPattern = mirrorHost.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const first = html.match(new RegExp(`https?://${hostPattern}/[^"'\\\\\\s>)]+`));
      let served: number | null = null;
      if (first) {
        const head = await probe(first[0], { method: "HEAD" });
        served = head?.status ?? 0;
      }
      if (served !== null && served !== 200) {
        checks.push({
          key: htmlKey,
          label: htmlLabel,
          state: "warn",
          value: t("sc.images.mirroredUnreachable", { n: onMirror }),
          remedy:
            t("sc.images.mirroredUnreachableRemedy", {
              status: served || t("sc.cannotConnect"),
              url: first?.[0] ?? ""
            })
        });
      } else {
        checks.push({ key: htmlKey, label: htmlLabel, state: "ok", value: t("sc.images.allMirrored", { n: onMirror }) });
      }
    }
  }

  return checks;
}

/* ------------------------------------------------------------------ */

/** Every check, run together. Never throws: a failed probe is a check result. */
/**
 * 有多少条旧链接跳到了不存在的地址。
 *
 * 这件事 2026-10-20 咬过两回，两回都不是当天发现的：「铁证如山」32 集改成视频
 * 重发之后文章版被删，旧 WP 地址开始 308 跳 404；拼音迁移改了全站 slug，而旧站
 * 「中华传统文化」「资料下载」两栏那 379 篇的重定向目标写的是 /resources/<中文>，
 * 段前缀对不上，迁移脚本没认出来，整批断了四天。
 *
 * 为什么非得有个东西定时问这一句：站内爬虫撞不到它们。没有任何页面链接到这些
 * 地址，sitemap 里也没有，唯一的入口是读者手里的旧链接 —— 而读者不会报告 404。
 * 原来的 validate-redirects.ts 只验形状（不重复、以 / 开头、301、前缀在白名单
 * 里），/resources/乐曲-听儿说 每一项都合格。
 *
 * 阈值是 0，不是「少于几条」。2026-10-20 清掉了那 157 条内容确实已经没了的
 * （见 docs/implementation/retired-redirects.csv），所以现在 0 是真实的基线。
 * 一条跳到 404 的重定向不比直接 404 好，它只是多一跳 —— 既然如此，让这个数字
 * 维持在 0 就既便宜又让报警有意义。往后它一变大，就是真的有东西刚断。
 */
async function checkDeadRedirects(): Promise<DefenseCheck> {
  const key = "dead_redirects";
  const label = t("sc.redirects");

  try {
    const supabase = createSupabaseAdminClient();
    const [{ data: count, error }, { count: total }] = await Promise.all([
      supabase.rpc("count_dead_redirects", { p_locale: SITE_LOCALE }),
      supabase.from("cms_redirects").select("id", { count: "exact", head: true }).eq("locale", SITE_LOCALE)
    ]);
    if (error) throw new Error(error.message);

    const dead = Number(count ?? 0);
    if (dead === 0) {
      return { key, label, state: "ok", value: t("sc.redirects.ok", { n: total ?? "?" }) };
    }

    /* 看到数字之后第一个问题一定是「哪几条」，所以直接把前几条列进去。 */
    const { data: sample } = await supabase.rpc("list_dead_redirects", {
      p_limit: 5,
      p_locale: SITE_LOCALE
    });
    const listed = Array.isArray(sample)
      ? (sample as { legacy_url: string; destination_url: string }[])
          .map((r) => `${r.legacy_url} → ${r.destination_url}`)
          .join("；")
      : "";

    return {
      key,
      label,
      state: "bad",
      value: t("sc.redirects.dead", { n: dead }),
      remedy:
        t("sc.redirects.deadRemedy", {
          n: dead,
          examples: listed ? t("sc.redirects.examples", { list: listed }) : ""
        })
    };
  } catch (error) {
    return {
      key,
      label,
      state: "unknown",
      value: error instanceof Error ? error.message.slice(0, 60) : t("sc.notFound")
    };
  }
}

/**
 * 有没有跨语言的错误关联。
 *
 * 分类和标签的关联表（cms_article_category_map 等）不带 locale —— 它们靠两端的行
 * 继承。这意味着一条「中文文章 → 德文分类」的关联在数据库层面是合法的，写得进去，
 * 而且不会报错：那篇文章只是从此出现在一个它不该出现的栏目下。
 *
 * 收口层会在写入时挡住，但代码层的校验挡不住**已经写进去的**脏数据 —— 一次手工
 * SQL、一个绕过收口层的脚本、一次导入，都能留下这种行。所以除了写入时拦，还要有
 * 东西定时回头查一遍。
 *
 * 阈值是 0。现在确实是 0（037 迁移时核对过），所以这是一条真实的基线，不是摆设。
 */
async function checkCrossLocaleLinks(): Promise<DefenseCheck> {
  const key = "cross_locale_links";
  const label = t("sc.crossLocale");

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("count_cross_locale_links");
    if (error) throw new Error(error.message);

    const bad = Number(data ?? 0);
    if (bad === 0) return { key, label, state: "ok", value: t("sc.crossLocale.zero") };

    return {
      key,
      label,
      state: "bad",
      value: t("sc.crossLocale.bad", { n: bad }),
      /* SQL 当占位符传进去，不写在译文里 —— 它和语言无关，
         而混在句子中间的话，每种语言都得抄一遍，抄错一个字就查不出东西。 */
      remedy: t("sc.crossLocale.badRemedy", {
        n: bad,
        sql:
          "select * from cms_article_category_map m join cms_articles a on a.id=m.article_id " +
          "join cms_article_categories c on c.id=m.category_id where a.locale is distinct from c.locale"
      })
    };
  } catch (error) {
    return {
      key,
      label,
      state: "unknown",
      value: error instanceof Error ? error.message.slice(0, 60) : t("sc.notFound")
    };
  }
}

export async function getDefenseStatus(): Promise<DefenseReport> {
  const [recent, search, archive, rendered, redirects, crossLocale] = await Promise.all([
    checkMirrorComplete(),
    checkSearchBound(),
    checkLogArchive(),
    checkRenderedPage(),
    checkDeadRedirects(),
    checkCrossLocaleLinks()
  ]);
  const checks = [checkMirrorSwitch(), recent, search, ...rendered, archive, redirects, crossLocale];
  return { checks, worst: worstOf(checks), checkedAt: new Date().toISOString() };
}

/* ------------------------------------------------------------------ *
 * Persistence
 * ------------------------------------------------------------------ */

const REPORT_KEY = "ops.selfcheck.report";

/**
 * Where the dashboard gets its panel from.
 *
 * The panel reads the last stored run rather than probing when somebody opens
 * it, for two reasons. The probes make outbound requests and wait up to eight
 * seconds each, which is a poor thing to put in front of an editor who came to
 * fix a typo. And a panel that measures independently can disagree with the
 * alert that was mailed, which is exactly the kind of discrepancy nobody can
 * resolve afterwards. So the cron measures, the panel reports, and the
 * timestamp is shown so a panel that has stopped being refreshed looks stopped
 * rather than healthy.
 */
export async function saveDefenseReport(report: DefenseReport): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient();
    await supabase
      .from("cms_site_settings")
      .upsert(
        { setting_key: REPORT_KEY, value_json: report, locale: SITE_LOCALE, updated_at: new Date().toISOString() },
        { onConflict: "setting_key,locale" }
      );
  } catch (error) {
    console.warn(`[selfcheck] 报告写入失败：${error instanceof Error ? error.message : "未知"}`);
  }
}

/** The last stored run, or null when the cron has never completed one. */
export async function readDefenseReport(): Promise<DefenseReport | null> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("cms_site_settings")
      .select("value_json")
      .eq("setting_key", REPORT_KEY)
      .eq("locale", SITE_LOCALE)
      .maybeSingle();
    const value = data?.value_json as Partial<DefenseReport> | undefined;
    if (!value || !Array.isArray(value.checks) || typeof value.checkedAt !== "string") return null;
    return {
      checks: value.checks as DefenseCheck[],
      worst: (value.worst as CheckState) ?? worstOf(value.checks as DefenseCheck[]),
      checkedAt: value.checkedAt
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Alert history
 * ------------------------------------------------------------------ */

const HISTORY_KEY = "ops.selfcheck.history";
/** Two months of ordinary weeks, and a hard stop on a flapping check. */
const HISTORY_MAX = 50;

export interface DefenseEvent {
  at: string;
  /**
   * `detected` is the run that first saw a check fail -- before any mail, and
   * often before anyone was told. It is recorded because the question an alert
   * raises is「什么时候开始的」, and the mail can only answer「什么时候告诉我的」.
   */
  kind: "detected" | "new" | "reminder" | "recovered";
  labels: string[];
}

/**
 * Why this exists at all.
 *
 * The panel stores one row: the latest run. So an alert would arrive, the
 * reader would open the dashboard, and by then the fault was fixed and
 * everything was green -- nothing to confirm the mail against, nothing to say
 * when it started or how long it lasted. 2026-10-15 is exactly that: 21 video
 * covers had been missing from the mirror for hours, the alert went out at
 * 19:09, and by 19:36 the dashboard showed seven green ticks and no trace.
 *
 * Only transitions are kept, not every run: an hourly check that logged
 * itself would bury the two lines that matter under two hundred that do not.
 */
export async function appendDefenseEvent(event: DefenseEvent): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("cms_site_settings")
      .select("value_json")
      .eq("setting_key", HISTORY_KEY)
      .eq("locale", SITE_LOCALE)
      .maybeSingle();
    const previous = Array.isArray(data?.value_json) ? (data.value_json as DefenseEvent[]) : [];
    const next = [event, ...previous].slice(0, HISTORY_MAX);
    await supabase
      .from("cms_site_settings")
      .upsert(
        { setting_key: HISTORY_KEY, value_json: next, locale: SITE_LOCALE, updated_at: new Date().toISOString() },
        { onConflict: "setting_key,locale" }
      );
  } catch (error) {
    /* A lost history line must never cost the alert it describes. */
    console.warn(`[selfcheck] 事件记录失败：${error instanceof Error ? error.message : "未知"}`);
  }
}

/** Newest first. Empty when nothing has ever gone wrong, which is the good case. */
export async function readDefenseEvents(): Promise<DefenseEvent[]> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("cms_site_settings")
      .select("value_json")
      .eq("setting_key", HISTORY_KEY)
      .eq("locale", SITE_LOCALE)
      .maybeSingle();
    return Array.isArray(data?.value_json) ? (data.value_json as DefenseEvent[]) : [];
  } catch {
    return [];
  }
}
