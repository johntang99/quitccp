import { NextResponse } from "next/server";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { syncSearchIndex } from "@/lib/search-index";

/**
 * Keeps the search index in step with the database.
 *
 * Content is already pushed into the index when an editor saves it, so this is
 * the repair pass rather than the main path: it catches whatever the save-time
 * hook missed because Meilisearch was briefly unreachable, or because a row was
 * changed by something other than the admin UI.
 *
 * Two modes:
 *   - incremental (default): rows whose updated_at falls inside the lookback
 *     window. Cheap, and what the hourly schedule runs.
 *   - full (?mode=full): every row. Expensive, so it runs weekly; it is also the
 *     only pass that notices rows deleted straight from the database.
 *
 * The lookback is deliberately wider than the hour between runs. A window exactly
 * the size of the gap loses anything written while the previous run was in
 * flight, and re-indexing a document that has not changed costs nothing.
 */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const LOOKBACK_HOURS = 3;

async function authorise(request: Request): Promise<string | null> {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (secret && auth === `Bearer ${secret}`) return null;
  // An admin session is also accepted, so the dashboard can trigger a run.
  const user = await getAdminSessionUser();
  if (user) return null;
  return secret ? "Unauthorized" : "CRON_SECRET is not configured";
}

export async function GET(request: Request) {
  const denied = await authorise(request);
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });

  if (!process.env.MEILI_HOST) {
    // Not an error: the site runs on the substring backend until a Meilisearch
    // host exists, and a cron that fails loudly for that reason is just noise.
    return NextResponse.json({ ok: true, skipped: "MEILI_HOST is not set" });
  }

  const url = new URL(request.url);
  const full = url.searchParams.get("mode") === "full";
  const since = full
    ? undefined
    : new Date(Date.now() - LOOKBACK_HOURS * 3600 * 1000).toISOString();

  const startedAt = Date.now();
  try {
    const result = await syncSearchIndex({
      locales: ["zh"],
      // A full pass moves 16,000 documents inside one 300s function, so it takes
      // larger batches; the incremental pass usually has a handful.
      batchSize: full ? 400 : 200,
      since,
      reset: false
    });
    return NextResponse.json({
      ok: true,
      mode: full ? "full" : "incremental",
      since: since ?? null,
      indexed: result.total,
      removed: result.removed,
      byType: result.byType,
      index: result.index,
      elapsedMs: Date.now() - startedAt
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error("[cron:search] sync failed", message);
    return NextResponse.json(
      { ok: false, mode: full ? "full" : "incremental", error: message.slice(0, 400) },
      { status: 500 }
    );
  }
}
