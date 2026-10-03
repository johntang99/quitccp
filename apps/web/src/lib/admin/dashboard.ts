import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { formatYi, getSantuiSnapshot } from "@/lib/santui";
import { listArticles } from "@/lib/admin/repository";
import type { ArticleRecord } from "@/lib/admin/types";

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

async function countOf(table: string, where?: { column: string; value: string }): Promise<number> {
  try {
    const supabase = createSupabaseAdminClient();
    let query = supabase.from(table).select("id", { count: "exact", head: true });
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
      countOf("declarations"),
      countOf("declarations", { column: "status", value: "pending" }),
      countOf("cms_audit_logs")
    ]);
  return { articles, videos, materials, pages, declarations, declarationsPending, audits };
}

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
 * Is the hourly santui job alive?
 *
 * The schedule is hourly, but GitHub's queue routinely runs a scheduled job
 * half an hour late and may skip one entirely, so an hour of silence is normal
 * and three is not. Nothing else on the site notices when this job dies -- the
 * figure simply freezes -- which is why it is on the dashboard.
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
  const state = ageHours <= 3 ? "fresh" : ageHours <= 24 ? "late" : "stale";
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
