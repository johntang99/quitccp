import { AwsClient } from "aws4fetch";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";

/**
 * Turns an hour of raw drain output in R2 into one row of counts.
 *
 * The archive keeps fidelity; this keeps the shape. See
 * `supabase/content/migrations/027_log_hourly.sql` for why both are wanted and
 * why the row carries nothing derived from `proxy.clientIp`.
 *
 * ## What a record looks like
 *
 * Measured against the live drain on 2026-10-15, and worth writing down
 * because two of the field positions are not where you would guess:
 *
 *   - the status code is `proxy.statusCode`, not top-level `statusCode`
 *   - the URL is `proxy.path`; top-level `path` is the *route pattern*
 *     (`videos/[[...slug]]`), which is the more useful thing to group by and
 *     the wrong thing to show when somebody asks what was being requested
 *   - `proxy.userAgent` is an array, not a string
 *   - a line with no `proxy` is not a request at all. Builds emit hundreds in
 *     a minute, so mixing them in would make every deploy look like a traffic
 *     spike. They are counted separately as `other_lines`.
 */

const TOP_N = 10;

export interface RollupResult {
  hour: string;
  batches: number;
  bytes: number;
  lines: number;
  requests: number;
}

interface R2Object {
  key: string;
  size: number;
}

function config() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_LOG_BUCKET?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return {
    bucket,
    endpoint: process.env.R2_ENDPOINT?.trim() || `https://${accountId}.r2.cloudflarestorage.com`,
    aws: new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" })
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** `logs/2026/10/15/09/` -- the layout the Worker writes and R2 expires by. */
export function hourPrefix(date: Date): string {
  return `logs/${date.getUTCFullYear()}/${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())}/${pad(date.getUTCHours())}/`;
}

async function listHour(cfg: NonNullable<ReturnType<typeof config>>, prefix: string): Promise<R2Object[]> {
  const out: R2Object[] = [];
  let token: string | undefined;
  /* Paged rather than capped at the first thousand: during the attack an hour
     held far more than that, and an hour silently truncated to its first
     thousand batches is a chart that under-reports exactly when it matters. */
  do {
    const url =
      `${cfg.endpoint}/${cfg.bucket}?list-type=2&max-keys=1000&prefix=${encodeURIComponent(prefix)}` +
      (token ? `&continuation-token=${encodeURIComponent(token)}` : "");
    const response = await cfg.aws.fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`R2 list ${response.status}`);
    const xml = await response.text();
    for (const [, block] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const key = block.match(/<Key>([^<]+)<\/Key>/)?.[1];
      if (key) out.push({ key, size: Number(block.match(/<Size>(\d+)<\/Size>/)?.[1] ?? 0) });
    }
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml)
      ? xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1]
      : undefined;
  } while (token);
  return out;
}

function topOf(counts: Map<string, number>, key: "path" | "status") {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_N)
    .map(([value, n]) => ({ [key]: value, n }));
}

/**
 * Rolls one UTC hour up and writes the row. Idempotent: it recomputes from the
 * objects present and replaces the row, so running it twice on an hour still
 * being written simply produces a more complete count the second time.
 */
export async function rollupHour(hourStart: Date): Promise<RollupResult | null> {
  const cfg = config();
  if (!cfg) return null;

  const prefix = hourPrefix(hourStart);
  const objects = await listHour(cfg, prefix);
  const hour = new Date(Date.UTC(
    hourStart.getUTCFullYear(), hourStart.getUTCMonth(), hourStart.getUTCDate(), hourStart.getUTCHours()
  )).toISOString();

  if (objects.length === 0) {
    /* No row at all rather than a row of zeroes. An hour with no objects is an
       hour the drain sent nothing for, and a zero row would be indistinguishable
       from an hour with genuinely no traffic -- which never happens, so the
       absence is the more honest record. */
    return { hour, batches: 0, bytes: 0, lines: 0, requests: 0 };
  }

  const counts = {
    requests: 0, s2: 0, s3: 0, s4: 0, s5: 0,
    hit: 0, miss: 0, cacheOther: 0, errors: 0, other: 0, lines: 0
  };
  const paths = new Map<string, number>();
  const statuses = new Map<string, number>();

  /* Fetched a few at a time. One at a time is slow enough to matter on a busy
     hour; all at once opens hundreds of sockets from one function. */
  const CONCURRENCY = 8;
  for (let i = 0; i < objects.length; i += CONCURRENCY) {
    const bodies = await Promise.all(
      objects.slice(i, i + CONCURRENCY).map(async (object) => {
        const response = await cfg.aws.fetch(`${cfg.endpoint}/${cfg.bucket}/${object.key}`, {
          signal: AbortSignal.timeout(20000)
        });
        return response.ok ? response.text() : "";
      })
    );
    for (const body of bodies) {
      for (const line of body.split("\n")) {
        if (!line.trim()) continue;
        counts.lines += 1;
        let record: Record<string, unknown>;
        try {
          record = JSON.parse(line) as Record<string, unknown>;
        } catch {
          /* A truncated line is a line, not a reason to lose the hour. */
          continue;
        }
        if (record.level === "error") counts.errors += 1;

        const proxy = record.proxy as Record<string, unknown> | undefined;
        if (!proxy) {
          counts.other += 1;
          continue;
        }
        counts.requests += 1;

        const status = Number(proxy.statusCode ?? 0);
        if (status >= 500) counts.s5 += 1;
        else if (status >= 400) counts.s4 += 1;
        else if (status >= 300) counts.s3 += 1;
        else if (status >= 200) counts.s2 += 1;
        if (status) statuses.set(String(status), (statuses.get(String(status)) ?? 0) + 1);

        const cache = String(proxy.vercelCache ?? "").toUpperCase();
        if (cache === "HIT") counts.hit += 1;
        else if (cache === "MISS") counts.miss += 1;
        else counts.cacheOther += 1;

        /* The route pattern, not the URL. `/news/<one of 15,374 slugs>` as a
           key would make every hour's top ten a list of ten different articles
           nobody asked about; `news/[slug]` says which part of the site the
           traffic was in, which is the question. */
        const route = String(record.path ?? proxy.path ?? "").split("?")[0];
        if (route) paths.set(route, (paths.get(route) ?? 0) + 1);
      }
    }
  }

  const row = {
    hour,
    requests: counts.requests,
    status_2xx: counts.s2,
    status_3xx: counts.s3,
    status_4xx: counts.s4,
    status_5xx: counts.s5,
    cache_hit: counts.hit,
    cache_miss: counts.miss,
    cache_other: counts.cacheOther,
    errors: counts.errors,
    other_lines: counts.other,
    batches: objects.length,
    bytes: objects.reduce((sum, o) => sum + o.size, 0),
    top_paths: topOf(paths, "path"),
    top_status: topOf(statuses, "status"),
    updated_at: new Date().toISOString()
  };

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("cms_log_hourly").upsert(row, { onConflict: "hour" });
  if (error) throw new Error(`写入 cms_log_hourly 失败：${error.message}`);

  return { hour, batches: row.batches, bytes: row.bytes, lines: counts.lines, requests: counts.requests };
}

export interface LogHourRow {
  hour: string;
  requests: number;
  status_2xx: number;
  status_3xx: number;
  status_4xx: number;
  status_5xx: number;
  cache_hit: number;
  cache_miss: number;
  cache_other: number;
  errors: number;
  other_lines: number;
  batches: number;
  bytes: number;
  top_paths: { path: string; n: number }[];
  top_status: { status: string; n: number }[];
}

/** Most recent first. What the admin page renders. */
export async function recentLogHours(limit = 48): Promise<LogHourRow[]> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("cms_log_hourly")
      .select("*")
      .order("hour", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as LogHourRow[];
  } catch {
    return [];
  }
}
