import { NextResponse } from "next/server";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { rollupStatsDay } from "@/lib/admin/site-stats-rollup";
import { skipUnlessLocale } from "@/lib/cron-locale";
import { STATS_LOCALES } from "@/lib/site-stats";

/**
 * Rolls page views up into `cms_stats_*`, daily.
 *
 * Yesterday and the day before, every run: Analytics Engine can still be
 * receiving the last minutes of yesterday when the job starts, and a run that
 * failed would otherwise leave a hole. Analytics Engine keeps three months, so
 * a hole not filled within that window is permanent -- `?days=` backfills by
 * hand without a deploy.
 *
 * `?today=1` also rolls the day in progress, for checking by hand that the
 * whole chain works without waiting for midnight UTC.
 */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const DAYS_BACK = 2;

async function authorise(request: Request): Promise<string | null> {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (secret && auth === `Bearer ${secret}`) return null;
  const user = await getAdminSessionUser();
  if (user) return null;
  return secret ? "Unauthorized" : "CRON_SECRET is not configured";
}

export async function GET(request: Request) {
  const denied = await authorise(request);
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });

  const skip = skipUnlessLocale(STATS_LOCALES);
  if (skip) return skip;

  const params = new URL(request.url).searchParams;
  const requested = Number(params.get("days") ?? DAYS_BACK);
  const days = Number.isFinite(requested) ? Math.min(Math.max(1, Math.trunc(requested)), 92) : DAYS_BACK;
  const start = params.get("today") === "1" ? 0 : 1;

  const done = [];
  const failed: { day: string; error: string }[] = [];
  for (let back = start; back < start + days; back++) {
    const day = new Date(Date.now() - back * 86_400_000).toISOString().slice(0, 10);
    try {
      done.push(await rollupStatsDay(day));
    } catch (error) {
      failed.push({ day, error: error instanceof Error ? error.message : "未知错误" });
    }
  }

  return NextResponse.json({ ok: failed.length === 0, days: done, failed, at: new Date().toISOString() });
}
