import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
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
      label: "媒体镜像开关",
      state: "bad",
      value: "未开启",
      remedy:
        "图片和视频正在直接走 Supabase，R2 镜像没有生效。到 Vercel → Settings → " +
        "Environment Variables 确认 NEXT_PUBLIC_MEDIA_MIRROR_HOST = media.tdinfo.org " +
        "还在、且 Production 环境勾着。注意它是编译时写进代码的，补上之后必须重新部署一次才生效。"
    };
  }
  return {
    key: "mirror_switch",
    label: "媒体镜像开关",
    state: "ok",
    value: rule.to.replace(/^\/\//, "").replace(/\/$/, "")
  };
}

/* ------------------------------------------------------------------ *
 * 2. The newest uploads really are on the mirror
 * ------------------------------------------------------------------ */

/**
 * Checks the three most recent uploads answer on the mirror.
 *
 * The newest rows and not a count, because a count compares two numbers that
 * drift for honest reasons and says nothing about when the drift started. What
 * can actually break is the copy-on-upload step, and the newest rows are
 * exactly where that shows first.
 *
 * It asks Cloudflare rather than Vercel, so the attack challenge is not in the
 * way: `media.tdinfo.org` is the mirror's own custom domain.
 */
async function checkRecentMirrored(): Promise<DefenseCheck> {
  const key = "mirror_recent";
  const label = "最近上传已进镜像";
  const rule = mirrorRewrite();
  if (!rule) return { key, label, state: "unknown", value: "镜像未开启" };

  let rows: { name: string | null; storage_path: string | null }[];
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("cms_media_assets")
      .select("name, storage_path")
      .order("created_at", { ascending: false })
      .limit(3);
    if (error) throw new Error(error.message);
    rows = data ?? [];
  } catch (error) {
    return {
      key,
      label,
      state: "unknown",
      value: "读不到媒体表",
      remedy: `查 cms_media_assets 失败：${error instanceof Error ? error.message : "未知错误"}`
    };
  }

  /* `storage_path` holds a full public URL, not a path -- the column predates
     the name. Only rows that look like one can be rewritten. */
  const candidates = rows.filter((r) => (r.storage_path ?? "").includes(rule.from));
  if (candidates.length === 0) {
    return { key, label, state: "unknown", value: "没有可检查的新上传" };
  }

  const results = await Promise.all(
    candidates.map(async (row) => {
      const url = rewriteMediaUrl(row.storage_path as string, rule);
      const response = await probe(url, { method: "HEAD" });
      return { name: row.name ?? "(未命名)", ok: response !== null && response.status === 200, status: response?.status ?? 0 };
    })
  );

  const missing = results.filter((r) => !r.ok);
  if (missing.length === 0) {
    return { key, label, state: "ok", value: `最近 ${results.length} 个都在` };
  }
  return {
    key,
    label,
    state: "bad",
    value: `${missing.length}/${results.length} 不在镜像上`,
    remedy:
      `这些最近上传的文件在 ${rule.to.replace(/^\/\//, "").replace(/\/$/, "")} 上取不到：` +
      missing.map((m) => `${m.name}（HTTP ${m.status || "连不上"}）`).join("、") +
      "。说明上传时的「复制进 R2」这一步失败了。先到 Vercel → Logs 搜 mirrorUpload 看报的是什么；" +
      "再确认 R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET 四个变量都还在。" +
      "读者那一侧暂时不受影响：取不到镜像会自动回退到 Supabase。" +
      "补齐历史文件可以跑 scripts 里的增量同步。"
  };
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
  const label = "搜索 5 秒上限";
  try {
    const supabase = createSupabaseAdminClient();
    const started = Date.now();
    const { error } = await supabase.rpc("search_articles_body", {
      p_t1: ["%zzqqxxjjselfcheck%"],
      p_t2: null,
      p_t3: null,
      p_t4: null,
      p_locale: "zh",
      p_limit: 1
    });
    const ms = Date.now() - started;
    if (error) {
      return {
        key,
        label,
        state: "bad",
        value: "调不动",
        remedy:
          `search_articles_body 调用失败：${error.message}。正文搜索会退回没有时限的写法，` +
          "一次慢查询就能占住一个数据库连接（一共只有 60 个）。" +
          "请重新执行 supabase/content/migrations/026_search_body_timeout.sql，" +
          "并确认结尾的 grant execute ... to service_role 也跑到了。"
      };
    }
    return { key, label, state: "ok", value: `${ms} ms` };
  } catch (error) {
    return {
      key,
      label,
      state: "unknown",
      value: "测不到",
      remedy: error instanceof Error ? error.message : "未知错误"
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
  const label = "日志存档";

  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_LOG_BUCKET?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return { key, label, state: "unknown", value: "未配置" };
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
        value: `${recent.length} 批 / ${size}${mins === null ? "" : `（最近 ${mins} 分钟前）`}`
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
        value: "还没有数据",
        remedy:
          "日志桶是空的，说明 Vercel 那边的 Log Drain 还没建起来。" +
          "开通步骤见 workers/vercel-log-drain/README.md —— 建桶、设签名密钥、部署 Worker、" +
          "在 Vercel 的 Team Settings → Drains 里指向它。"
      };
    }
    return {
      key,
      label,
      state: "bad",
      value: "近 3 小时无新日志",
      remedy:
        "日志存档以前收到过数据，但最近 3 小时一批都没有 —— 这中间出了什么问题，而且不会报错，" +
        "网站照常提供服务。按顺序查：Vercel → Team Settings → Drains，看这条 drain 是不是被停用或删了；" +
        "Cloudflare → Workers → vercel-log-drain，看它的日志里有没有 403（签名密钥两边对不上）或 500。" +
        "在修好之前这段时间的日志是补不回来的，Vercel 自己只留一天。"
    };
  } catch (error) {
    return {
      key,
      label,
      state: "unknown",
      value: "读不到",
      remedy: `列举 R2 日志桶失败：${error instanceof Error ? error.message : "未知错误"}`
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
  const cacheLabel = "文章页走 CDN 缓存";
  const freshKey = "page_fresh";
  const freshLabel = "页面内容是最新的";
  const htmlKey = "page_media_r2";
  const htmlLabel = "页面图片指向镜像";

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
    "这三项需要真的取一次渲染好的页面，而我们自己的防火墙会挑战一切非浏览器请求 —— " +
    "不是故障，是防火墙在干活。要让它们测得到，到 Vercel → 项目 → Firewall 新建一条规则，" +
    "放在那条 Challenge 规则**上面**（规则自上而下匹配，Allow 命中后不再往下走）：" +
    "If 请求头 x-quitccp-probe equals <一串随机字符串> → Then Allow。" +
    "再把同一串字符串配成环境变量 PROBE_BYPASS_SECRET。" +
    "这个请求头只决定防火墙要不要挑战这个请求，它能访问到的就是每个读者本来就能拿到的公开页面。" +
    "详见 docs/implementation/selfcheck-and-alerts.md。";

  let article: { slug: string; title: string } | null = null;
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("cms_articles")
      .select("slug, title")
      .eq("status", "published")
      .eq("locale", "zh")
      .order("updated_at", { ascending: false })
      .limit(1);
    const row = data?.[0];
    if (row?.slug && row?.title) article = { slug: row.slug, title: row.title };
  } catch {
    return blocked("读不到文章");
  }
  if (!article) return blocked("没有已发布文章");

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
    if (!response) return blocked("连不上");
    if (wasChallenged(response)) return blocked("被挑战页挡住", bypassRemedy);
    cacheHeader = response.headers.get("x-vercel-cache") ?? "";
    html = await response.text();
    if (CACHED.test(cacheHeader)) break;
  }

  const checks: DefenseCheck[] = [];

  /* --- 1. still served from the edge cache --- */
  if (!cacheHeader) {
    checks.push({ key: cacheKey, label: cacheLabel, state: "unknown", value: "没有缓存头" });
  } else if (CACHED.test(cacheHeader)) {
    checks.push({ key: cacheKey, label: cacheLabel, state: "ok", value: cacheHeader });
  } else {
    checks.push({
      key: cacheKey,
      label: cacheLabel,
      state: "bad",
      value: cacheHeader,
      remedy:
        `文章页连续 ${CACHE_ATTEMPTS} 次都是 ${cacheHeader}，说明它又变成每次请求都重新渲染了 —— ` +
        "洪水会直接打到数据库，这正是 10-13 那晚的情形。" +
        "通常是某个组件里新加了 cookies()、headers() 或 noStore()，让整棵树退出了静态渲染。" +
        "查最近改过的 layout，和 /news/[slug] 这条路径上用到的组件。"
    });
  }

  /* --- 2. the cached copy is the current one ---
     Cached and stale looks identical to cached and correct from outside, so
     this compares the page against the row it was rendered from. The title is
     the right field to compare: it is on every article, it is what an editor
     most often changes, and it appears in the HTML verbatim. */
  const titleInPage = htmlContainsText(html, article.title);
  if (titleInPage) {
    checks.push({ key: freshKey, label: freshLabel, state: "ok", value: "与数据库一致" });
  } else {
    checks.push({
      key: freshKey,
      label: freshLabel,
      state: "bad",
      value: "页面是旧的",
      remedy:
        `最近改过的那篇文章（${article.slug}）在数据库里的标题是「${article.title}」，` +
        "但线上页面里没有这个标题 —— 保存之后清缓存那一步没生效，" +
        "编辑的改动不会出现在网站上，而且不会报任何错。" +
        "先在后台随便保存一次那篇文章，看页面是否更新；" +
        "不行的话查 /api/admin/content/articles 的 revalidatePath 调用，" +
        "以及 next.config.ts 里这条路径的配置。"
    });
  }

  /* --- 3. the images a visitor gets come from the mirror ---
     Counting both hosts rather than just looking for the mirror: a page with no
     images at all would otherwise pass, and the number that matters is how many
     requests still land on unprotected Supabase Storage. */
  const rule = mirrorRewrite();
  if (!rule) {
    checks.push({ key: htmlKey, label: htmlLabel, state: "unknown", value: "镜像未开启" });
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
        value: `${onSupabase} 处仍指向 Supabase`,
        remedy:
          "渲染出来的页面里还有直接指向 Supabase 的图片地址，这些请求绕过 R2，" +
          "打在没有任何防护的 Storage 上。多半是新加的代码直接用了 getPublicUrl()，" +
          "没有经过 rewriteMediaUrl()。参考 docs/implementation/media-on-r2.md 里的清单。"
      });
    } else if (onMirror === 0) {
      checks.push({ key: htmlKey, label: htmlLabel, state: "unknown", value: "这篇没有图" });
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
          value: `${onMirror} 处是镜像，但取不到`,
          remedy:
            `页面里的图片地址都指向镜像了，但抽查的那一个返回 HTTP ${served || "连不上"}。` +
            "读者那一侧不会看到坏图 —— 浏览器会自动退回 Supabase —— 但图片少了 R2 的缓存和限速保护。" +
            `地址：${first?.[0] ?? ""}。` +
            "注意 Cloudflare 会把 R2 的 404 缓存 4 小时，所以补上文件之后要到 Cloudflare 后台清一次缓存才看得到。"
        });
      } else {
        checks.push({ key: htmlKey, label: htmlLabel, state: "ok", value: `${onMirror} 处全是镜像` });
      }
    }
  }

  return checks;
}

/* ------------------------------------------------------------------ */

/** Every check, run together. Never throws: a failed probe is a check result. */
export async function getDefenseStatus(): Promise<DefenseReport> {
  const [recent, search, archive, rendered] = await Promise.all([
    checkRecentMirrored(),
    checkSearchBound(),
    checkLogArchive(),
    checkRenderedPage()
  ]);
  const checks = [checkMirrorSwitch(), recent, search, ...rendered, archive];
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
        { setting_key: REPORT_KEY, value_json: report, updated_at: new Date().toISOString() },
        { onConflict: "setting_key" }
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
