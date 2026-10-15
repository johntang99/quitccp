import { NextResponse } from "next/server";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { rollupHour } from "@/lib/admin/log-rollup";

/**
 * Rolls the log archive up into `cms_log_hourly`, hourly.
 *
 * It does the last three hours on every run, not just the one that finished.
 * Three because each is wrong in its own way for a while: the current hour is
 * still being written, the one before it may still be receiving late batches
 * when the job starts, and a run that failed or was skipped would otherwise
 * leave a permanent hole -- the raw objects expire after 14 days, so a gap
 * that is not filled within the fortnight can never be filled.
 *
 * Rolling an hour up again is free of consequence: it recomputes from whatever
 * objects are there and replaces the row.
 */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** The current hour plus the two behind it. */
const HOURS_BACK = 3;

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

  /* `?hours=` so a hole can be backfilled by hand without a deploy -- the only
     window in which that is possible is the 14 days R2 keeps the raw objects. */
  const requested = Number(new URL(request.url).searchParams.get("hours") ?? HOURS_BACK);
  const hours = Number.isFinite(requested) ? Math.min(Math.max(1, Math.trunc(requested)), 336) : HOURS_BACK;

  const now = Date.now();
  const done = [];
  const failed: { hour: string; error: string }[] = [];
  for (let back = 0; back < hours; back++) {
    const at = new Date(now - back * 3_600_000);
    try {
      const result = await rollupHour(at);
      if (result) done.push(result);
    } catch (error) {
      /* One bad hour must not take the rest with it, least of all on a
         backfill where the later hours are the ones about to expire. */
      failed.push({ hour: at.toISOString(), error: error instanceof Error ? error.message : "未知错误" });
    }
  }

  return NextResponse.json({
    ok: failed.length === 0,
    rolled: done.length,
    hours: done,
    failed,
    at: new Date().toISOString()
  });
}
