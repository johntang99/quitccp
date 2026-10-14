import { NextResponse } from "next/server";
import { pgTrgmSearchSql } from "@/lib/search";
import { searchPublishedArticlesWithMeta } from "@/lib/search-repository";
import { getAdminSessionUser } from "@/lib/admin/auth";

/**
 * Which backend answered a search, and what it returned. A diagnostic, for the
 * admin dashboard's "check the search is healthy" instructions.
 *
 * ## Why this needs a session
 *
 * It was open to anyone, and it was the cheapest way to hurt this site's
 * database that existed. Everything about it pointed the wrong way:
 *
 *   - no authentication, and no rate limit either
 *   - `limit` came straight from the query string with no ceiling
 *   - `maxDuration = 60`, so one request could hold a database connection for
 *     a full minute
 *   - the work behind it is the body scan, measured at 8.5s for a rare
 *     two-character term against 15,374 articles
 *   - it answers in JSON, so an attacker pays almost nothing per request
 *
 * Postgres here has 60 connections. The arithmetic was not in our favour, and
 * this was a far better target than the article flood of 2026-10-13 ever was:
 * that one needed 35,000 requests a second, this needs about a dozen.
 *
 * Nothing on the site calls it. Its only mention anywhere is the dashboard
 * telling an admin to open it by hand -- and an admin is signed in when they
 * do. So the fix is not a rate limit on a public endpoint nobody uses
 * anonymously; it is to stop it being public.
 */
export const maxDuration = 30;

/** Enough for a diagnostic. The page's own search pages in memory anyway. */
const MAX_LIMIT = 50;

export async function GET(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const locale = searchParams.get("locale") ?? "zh";
  /* Clamped rather than trusted: a signed-in admin is not a threat, but an
     unbounded limit is still a way to make one query cost far more than it
     should, by accident as easily as on purpose. */
  const requested = Number(searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(requested) ? Math.min(Math.max(1, Math.trunc(requested)), MAX_LIMIT) : 20;

  const execution = await searchPublishedArticlesWithMeta(query, { locale, limit });

  return NextResponse.json({
    query,
    locale,
    limit,
    baseline: "dual_read",
    backend: execution.meta.effectiveBackend,
    primaryBackend: execution.meta.primaryBackend,
    dualReadEnabled: execution.meta.dualReadEnabled,
    truncated: execution.meta.truncated,
    /* The query shape. Fine for an admin looking at why a search behaved as it
       did; it was being handed to anyone who asked. */
    sqlTemplate: pgTrgmSearchSql.trim(),
    results: execution.results
  });
}
