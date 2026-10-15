import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { mirrorRewrite, rewriteMediaUrl } from "@/lib/media-mirror";

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
 * and need no HTTP to ourselves at all. The two that genuinely require a
 * rendered page are attempted anyway and degrade to `unknown` when the
 * challenge answers -- "could not measure", never "broken". See
 * PROBE_BYPASS_HEADER for how to let them through.
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
 * 4. The firewall is still challenging
 * ------------------------------------------------------------------ */

/**
 * One request to our own front door, expecting to be turned away.
 *
 * This is the probe the challenge made possible rather than the one it broke:
 * while the attack rule is on, a plain server-side request is answered by the
 * firewall with 429 and `x-vercel-mitigated: challenge`. Getting the page
 * instead means the rule is no longer in front of it.
 *
 * It reports `warn`, never `bad`, and the cron does not mail about `warn` --
 * because turning the challenge off is a decision somebody will make on
 * purpose once the attack is over, and an alert that fires on an intended
 * change teaches people to ignore alerts.
 */
async function checkChallengeActive(): Promise<DefenseCheck> {
  const key = "firewall_challenge";
  const label = "防火墙挑战";
  /* Deliberately without the bypass header: the question is what an ordinary
     non-browser request gets. */
  let response: Response | null = null;
  try {
    response = await fetch(publicOrigin() + "/", {
      method: "GET",
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      headers: { "user-agent": UA }
    });
  } catch {
    return { key, label, state: "unknown", value: "连不上" };
  }

  if (wasChallenged(response)) {
    return { key, label, state: "ok", value: "生效中" };
  }
  return {
    key,
    label,
    state: "warn",
    value: `未挑战（HTTP ${response.status}）`,
    remedy:
      "非浏览器请求可以直接拿到页面，说明攻击期的 Challenge 规则已经不在首页前面了。" +
      "如果是攻击结束后你主动关的，这条可以忽略；否则到 Vercel → Firewall 看规则是否被停用或挪了顺序。"
  };
}

/* ------------------------------------------------------------------ *
 * 5 & 6. The two that need a rendered page
 * ------------------------------------------------------------------ */

/**
 * Fetches one published article page and reads two things off the same
 * response: whether the CDN served it from cache, and whether the HTML it
 * emitted points at the mirror.
 *
 * One fetch for both because they are the same question asked twice -- "is
 * what we built still what visitors get" -- and because both regress the same
 * silent way. A `cookies()` call added anywhere in the tree makes the page
 * dynamic again, and then every request in a flood reaches the database; a lost
 * environment variable sends every image back to Supabase. Neither logs
 * anything. Nothing else here would notice either one.
 *
 * Returns both checks as `unknown` when the firewall answers, which is what
 * happens until the Allow rule for PROBE_BYPASS_HEADER exists.
 */
async function checkRenderedPage(): Promise<DefenseCheck[]> {
  const cacheKey = "page_cached";
  const cacheLabel = "文章页走 CDN 缓存";
  const htmlKey = "page_media_r2";
  const htmlLabel = "页面图片指向镜像";

  const blocked = (why: string): DefenseCheck[] => [
    { key: cacheKey, label: cacheLabel, state: "unknown", value: why },
    { key: htmlKey, label: htmlLabel, state: "unknown", value: why }
  ];

  let slug: string | null = null;
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("cms_articles")
      .select("slug")
      .eq("status", "published")
      .eq("locale", "zh")
      .order("published_at", { ascending: false })
      .limit(1);
    slug = data?.[0]?.slug ?? null;
  } catch {
    return blocked("读不到文章");
  }
  if (!slug) return blocked("没有已发布文章");

  const url = `${publicOrigin()}/news/${slug}`;
  let response = await probe(url);
  if (!response) return blocked("连不上");
  if (wasChallenged(response)) return blocked("被挑战页挡住");

  /* A cold cache is a MISS once and a HIT after, which is not a fault. Only a
     second MISS means the page is being rendered per request. */
  let cacheHeader = response.headers.get("x-vercel-cache") ?? "";
  let html = await response.text();
  if (/^(MISS|BYPASS)$/i.test(cacheHeader)) {
    const again = await probe(url);
    if (again && !wasChallenged(again)) {
      cacheHeader = again.headers.get("x-vercel-cache") ?? cacheHeader;
      html = await again.text();
    }
  }

  const checks: DefenseCheck[] = [];

  if (!cacheHeader) {
    checks.push({ key: cacheKey, label: cacheLabel, state: "unknown", value: "没有缓存头" });
  } else if (/^(HIT|STALE|PRERENDER|REVALIDATED)$/i.test(cacheHeader)) {
    checks.push({ key: cacheKey, label: cacheLabel, state: "ok", value: cacheHeader });
  } else {
    checks.push({
      key: cacheKey,
      label: cacheLabel,
      state: "bad",
      value: cacheHeader,
      remedy:
        `文章页连续两次都是 ${cacheHeader}，说明它又变成每次请求都重新渲染了 —— ` +
        "洪水会直接打到数据库，这正是 10-13 那晚的情形。" +
        "通常是某个组件里新加了 cookies()、headers() 或 noStore()，让整棵树退出了静态渲染。" +
        "查最近改过的 layout 和 /news/[slug] 用到的组件。"
    });
  }

  const rule = mirrorRewrite();
  if (!rule) {
    checks.push({ key: htmlKey, label: htmlLabel, state: "unknown", value: "镜像未开启" });
  } else {
    const mirrorHost = rule.to.replace(/^\/\//, "").replace(/\/$/, "");
    const onMirror = html.split(mirrorHost).length - 1;
    const onSupabase = html.split(rule.from).length - 1;
    if (onMirror === 0 && onSupabase === 0) {
      checks.push({ key: htmlKey, label: htmlLabel, state: "unknown", value: "这篇没有图" });
    } else if (onSupabase === 0) {
      checks.push({ key: htmlKey, label: htmlLabel, state: "ok", value: `${onMirror} 处全是镜像` });
    } else {
      checks.push({
        key: htmlKey,
        label: htmlLabel,
        state: "bad",
        value: `${onSupabase} 处仍指向 Supabase`,
        remedy:
          "渲染出来的页面里还有直接指向 Supabase 的图片地址，这些请求绕过了 R2，" +
          "打在没有任何防护的 Storage 上。多半是新加的代码直接用了 getPublicUrl()，" +
          "没有经过 rewriteMediaUrl()。参考 docs/implementation/media-on-r2.md 里的清单。"
      });
    }
  }

  return checks;
}

/* ------------------------------------------------------------------ */

/** Every check, run together. Never throws: a failed probe is a check result. */
export async function getDefenseStatus(): Promise<DefenseReport> {
  const [recent, search, challenge, rendered] = await Promise.all([
    checkRecentMirrored(),
    checkSearchBound(),
    checkChallengeActive(),
    checkRenderedPage()
  ]);
  const checks = [checkMirrorSwitch(), recent, search, challenge, ...rendered];
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
