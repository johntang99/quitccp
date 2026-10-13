import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { getConfiguredPrimaryBackend } from "@/lib/search-repository";

/**
 * Liveness for the two things a page needs: the database, and whichever search
 * backend is actually configured.
 *
 * ## Why this route reads its backend from `search-repository`
 *
 * It used to resolve `SEARCH_PRIMARY_BACKEND` itself, with
 *
 *     return raw === "meilisearch" ? "meilisearch" : "pg_trgm";
 *
 * so every value that was not the literal `meilisearch` -- `substring`, which
 * is what this deployment sets -- came out as `pg_trgm`. `search-repository`
 * had already been fixed to treat an unrecognised value as `substring`; this
 * copy was not, so the health check and the site disagreed about which backend
 * was in use, and the health check exercised one the site never calls.
 *
 * That mattered because `search_articles_trgm` is not a cheap probe. `pg_trgm`
 * builds no usable index for a query under three characters, so the function
 * falls back to a sequential scan that computes `similarity()` against
 * `body_plain` for all 15,374 articles: measured at 2.3-11.1s per call, and
 * returning almost nothing, since trigram similarity does not work on Chinese.
 * Whatever polls this route was handing the database a multi-second table scan
 * on every request.
 *
 * A health check has to stay cheaper than the thing it is checking.
 */

type HealthStatus = "ok" | "error" | "skipped";

interface HealthItem {
  status: HealthStatus;
  detail?: string;
}

async function checkSupabase(): Promise<HealthItem> {
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("cms_articles")
      .select("id", { head: true, count: "exact" })
      .eq("locale", "zh")
      .limit(1);
    if (error) {
      return { status: "error", detail: `supabase query failed: ${error.message}` };
    }
    return { status: "ok" };
  } catch (error) {
    return { status: "error", detail: error instanceof Error ? error.message : "unknown supabase error" };
  }
}

async function checkMeilisearch(): Promise<HealthItem> {
  const host = process.env.MEILI_HOST?.trim();
  if (!host) return { status: "error", detail: "MEILI_HOST not set" };

  try {
    const response = await fetch(`${host.replace(/\/$/, "")}/health`);
    if (!response.ok) {
      return { status: "error", detail: `meili health failed: ${response.status} ${response.statusText}` };
    }
    return { status: "ok" };
  } catch (error) {
    return { status: "error", detail: error instanceof Error ? error.message : "unknown meili error" };
  }
}

/**
 * The substring backend's own query shape, bounded.
 *
 * `title` is indexed and short, so this answers in milliseconds -- unlike the
 * trigram scan it replaces, which reads every article body.
 */
async function checkSubstringSearch(): Promise<HealthItem> {
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("cms_articles")
      .select("id")
      .eq("locale", "zh")
      .eq("status", "published")
      .ilike("title", "%退党%")
      .limit(1);
    if (error) {
      return { status: "error", detail: `substring search failed: ${error.message}` };
    }
    return { status: "ok" };
  } catch (error) {
    return { status: "error", detail: error instanceof Error ? error.message : "unknown substring search error" };
  }
}

/**
 * Only reached when `pg_trgm` is the configured backend, which is a deliberate
 * choice rather than a fallback. `p_limit: 1` keeps the cost to what the
 * backend genuinely charges; it is still the most expensive check here.
 */
async function checkPgSearch(): Promise<HealthItem> {
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.rpc("search_articles_trgm", {
      p_query: "退党",
      p_locale: "zh",
      p_limit: 1,
      p_offset: 0
    });
    if (error) {
      return { status: "error", detail: `pg search rpc failed: ${error.message}` };
    }
    return { status: "ok" };
  } catch (error) {
    return { status: "error", detail: error instanceof Error ? error.message : "unknown pg search error" };
  }
}

export async function GET() {
  const primarySearch = getConfiguredPrimaryBackend();
  const searchCheck =
    primarySearch === "meilisearch"
      ? checkMeilisearch()
      : primarySearch === "pg_trgm"
        ? checkPgSearch()
        : checkSubstringSearch();

  const [supabase, search] = await Promise.all([checkSupabase(), searchCheck]);

  const ok = supabase.status === "ok" && search.status === "ok";
  return NextResponse.json(
    {
      ok,
      environment: process.env.NODE_ENV ?? "unknown",
      primarySearch,
      checks: {
        supabase,
        search
      },
      timestamp: new Date().toISOString()
    },
    { status: ok ? 200 : 503 }
  );
}
