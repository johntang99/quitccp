import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { formatYi, getSantuiSnapshot } from "@/lib/santui";
import { listArticles } from "@/lib/admin/repository";
import { searchPublishedArticlesWithMeta } from "@/lib/search-repository";
import { meiliConfig } from "@/lib/search-index";
import type { ArticleRecord } from "@/lib/admin/types";
import { SITE_LOCALE } from "@/lib/site-config";

/**
 * Figures for 平台概览.
 *
 * Every count is asked of the database with `head: true` and an exact count, not
 * measured with `rows.length`. The old dashboard did the latter against a
 * page-limited query and so reported 20 articles when there were 15,515 --
 * a readout nobody could act on.
 */
export interface DashboardStats {
  articles: number;
  videos: number;
  materials: number;
  pages: number;
  declarations: number;
  declarationsPending: number;
  audits: number;
}

/**
 * 数一张表有多少行。
 *
 * `byLocale` 默认开着：后台这几个数字是「这个站有多少内容」，不是「数据库里
 * 一共有多少」。原来一处都没有限定，英文站的后台显示的是中文站的 15,372 篇
 * 文章和 861 个视频 —— 看着像内容都在，其实一篇都不是它的。
 *
 * 声明和审计记录不按站算，它们有各自的理由，见调用处。
 */
async function countOf(
  table: string,
  where?: { column: string; value: string },
  byLocale = true
): Promise<number> {
  try {
    const supabase = createSupabaseAdminClient();
    /* locale-ok: byLocale 默认开着，见上面的说明；只有全球登记册传 false。 */
    let query = supabase.from(table).select("id", { count: "exact", head: true });
    if (byLocale) query = query.eq("locale", SITE_LOCALE);
    if (where) query = query.eq(where.column, where.value);
    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  } catch {
    // A missing table must not take the whole page down; -1 renders as 未知.
    return -1;
  }
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [articles, videos, materials, pages, declarations, declarationsPending, audits] =
    await Promise.all([
      countOf("cms_articles"),
      countOf("cms_videos"),
      countOf("cms_materials"),
      countOf("cms_content_entries"),
      /* 声明不按站算：那是全球登记册，表里根本没有 locale 列，
         四个站的首页显示的是同一个总数。 */
      countOf("declarations", undefined, false),
      countOf("declarations", { column: "status", value: "pending" }, false),
      countOf("cms_audit_logs")
    ]);
  return { articles, videos, materials, pages, declarations, declarationsPending, audits };
}

/**
 * The cron interval, in hours, as configured in apps/web/vercel.json
 * ("17 *&#47;6 * * *"). Keep the two in step: the dashboard decides whether the
 * sync is healthy by comparing the snapshot's age against this.
 */
export const SYNC_INTERVAL_HOURS = 6;
/** One missed run plus slack. Past this the job is late, not merely between runs. */
const LATE_AFTER = SYNC_INTERVAL_HOURS * 2 + 2;
/** Several missed runs: something is broken, not slow. */
const STALE_AFTER = 24;

export interface SyncStatus {
  ok: boolean;
  /** null when the job has never run, or the row is unreadable. */
  fetchedAt: string | null;
  ageHours: number | null;
  total: number | null;
  totalDisplay: string;
  /** santui's own "updated at", in its timezone, as published. */
  sourceUpdatedAt: string;
  declarations: number;
  newest: string | null;
  /** 正常 / 延迟 / 停止 / 从未运行 */
  state: "fresh" | "late" | "stale" | "never";
}

/**
 * Is the santui job alive?
 *
 * Vercel Cron runs it every SYNC_INTERVAL_HOURS hours, so a snapshot that is
 * merely a few hours old is healthy, not late -- the window has to allow for a
 * full interval plus a missed run. Nothing else on the site notices when this
 * job dies: the figure simply freezes at whatever it last read, which is why
 * the state is surfaced here.
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  const snap = await getSantuiSnapshot();
  if (!snap) {
    return {
      ok: false, fetchedAt: null, ageHours: null, total: null, totalDisplay: "",
      sourceUpdatedAt: "", declarations: 0, newest: null, state: "never"
    };
  }
  const ageHours = (Date.now() - new Date(snap.fetchedAt).getTime()) / 3_600_000;
  const state =
    ageHours <= LATE_AFTER ? "fresh" : ageHours <= STALE_AFTER ? "late" : "stale";
  const newest = snap.declarations[0]?.at ?? null;
  return {
    ok: state === "fresh",
    fetchedAt: snap.fetchedAt,
    ageHours,
    total: snap.total,
    totalDisplay: formatYi(snap.total),
    sourceUpdatedAt: snap.sourceUpdatedAt,
    declarations: snap.declarations.length,
    newest,
    state
  };
}

/** The handful of articles an editor most likely wants to pick up again. */
export async function getRecentArticles(limit = 6): Promise<ArticleRecord[]> {
  try {
    const res = await listArticles({ page: 1, pageSize: limit }, "system@quitccp.local");
    return res.rows;
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ search */

export type SearchBackendName = "meilisearch" | "substring" | "pg_trgm" | "fallback_ilike";

export interface SearchStatus {
  ok: boolean;
  /** What SEARCH_PRIMARY_BACKEND asks for. */
  configured: SearchBackendName;
  /** What actually answered a probe query just now. */
  effective: SearchBackendName;
  /** Whether a Meilisearch host is configured at all. */
  meiliConfigured: boolean;
  /** Documents in the index, null when there is no index to ask. */
  indexed: number | null;
  /** Rows the index should hold, counted from the database. */
  expected: number;
  /** Probe latency in milliseconds. */
  probeMs: number;
  probeResults: number;
  /**
   * normal   — serving, and the index matches the database
   * drifted  — serving from an index that disagrees with the database
   * fallback — the configured backend failed and something else answered
   * nomeili  — running on substring with no Meilisearch configured (fine)
   * down     — nothing answered
   */
  state: "normal" | "drifted" | "fallback" | "nomeili" | "down";
}

/**
 * Is search healthy, and is it answering from current data?
 *
 * Written because nothing noticed when it was not. Search was broken in
 * production for weeks -- 法轮功 returned nothing while 410 articles carried it
 * in the title -- and the index behind it had been seven weeks stale while
 * reporting success, because a sync that dies partway still looks like a sync
 * that ran. Both failures are silent by nature: search keeps answering, the
 * answers are just wrong.
 *
 * So this runs a real query rather than reading a status flag, and compares the
 * index against the database rather than trusting either on its own.
 */
/**
 * 后台「站内搜索」那一栏用来试搜的词。
 *
 * 它要的是「这个站上一定搜得到东西」的词 —— 搜不到就说明搜索坏了。所以按语言
 * 各给一个：英文站搜「三退」必然零结果，那一栏会一直显示红色，而搜索其实好好的。
 * 一个长期报假故障的指示灯，和没有指示灯是一样的。
 */
const SEARCH_PROBE_TERMS: Record<string, string> = {
  zh: "三退",
  en: "CCP",
  de: "KPCh",
  ja: "中国共産党",
  ko: "중국공산당",
  ro: "PCC"
};
/* 导出：总览页那一栏写的是「试搜『三退』」，词写死在页面上的话，英文站会
   显示一个它根本没搜过的词。 */
export const PROBE_TERM = SEARCH_PROBE_TERMS[SITE_LOCALE] ?? "CCP";

export async function getSearchStatus(): Promise<SearchStatus> {
  const configured = ((process.env.SEARCH_PRIMARY_BACKEND ?? "substring")
    .trim()
    .toLowerCase() || "substring") as SearchBackendName;
  const meiliConfigured = Boolean(process.env.MEILI_HOST?.trim());

  // A term every copy of this archive contains, so an empty result is a fault
  // rather than a quiet corpus.
  const probeStarted = Date.now();
  let effective: SearchBackendName = configured;
  let probeResults = 0;
  try {
    const probe = await searchPublishedArticlesWithMeta(PROBE_TERM, { locale: SITE_LOCALE, limit: 5 });
    effective = probe.meta.effectiveBackend as SearchBackendName;
    probeResults = probe.results.length;
  } catch {
    probeResults = 0;
  }
  const probeMs = Date.now() - probeStarted;

  let indexed: number | null = null;
  if (meiliConfigured) {
    try {
      const { host, key, index } = meiliConfig();
      const headers: Record<string, string> = {};
      if (key) headers.authorization = `Bearer ${key}`;
      const res = await fetch(`${host}/indexes/${encodeURIComponent(index)}/stats`, { headers });
      if (res.ok) indexed = Number((await res.json()).numberOfDocuments ?? 0);
    } catch {
      indexed = null;
    }
  }

  const expected = await countSearchableRows();

  const state: SearchStatus["state"] =
    probeResults === 0
      ? "down"
      : effective !== configured
        ? "fallback"
        : !meiliConfigured
          ? "nomeili"
          : indexed === null || Math.abs(indexed - expected) > Math.max(10, expected * 0.01)
            ? "drifted"
            : "normal";

  return {
    ok: state === "normal" || state === "nomeili",
    configured,
    effective,
    meiliConfigured,
    indexed,
    expected,
    probeMs,
    probeResults,
    state
  };
}

/** What the index ought to contain: every published article, video and material. */
async function countSearchableRows(): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const counts = await Promise.all(
    (
      [
        /* 三张表都按站算。视频这一张曾经是 false（037 之前没有 locale 列），
           于是「数据库条目」在英文站上算进了 861 个中文视频，和索引里的数字
           永远对不上 —— 搜索状态那一栏会长期亮黄灯。一个长期报假故障的
           指示灯，和没有指示灯是一样的。 */
        ["cms_articles", true],
        ["cms_videos", true],
        ["cms_materials", true]
      ] as const
    ).map(async ([table, localeFiltered]) => {
      try {
        /* locale-ok: 三张表的 localeFiltered 现在都是 true，见上面那张表。 */
        let q = supabase.from(table).select("id", { count: "exact", head: true });
        if (localeFiltered) q = q.eq("locale", SITE_LOCALE);
        const { count } = await q;
        return count ?? 0;
      } catch {
        return 0;
      }
    })
  );
  return counts.reduce((a, b) => a + b, 0);
}
