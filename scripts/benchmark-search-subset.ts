import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { createClient } from "@supabase/supabase-js";

interface NormalizedInput {
  rows: Array<{ legacyId: number }>;
}

interface ArticleStatusRow {
  id: string;
  legacy_id: number | null;
  status: string;
}

interface ArticleSeedRow {
  id: string;
  title: string;
}

interface SearchRpcRow {
  id: string;
}

interface BenchmarkRun {
  query: string;
  expectedIds: string[];
  returnedIds: string[];
  latencyMs: number;
  timedOut?: boolean;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function parseArg(argv: string[], name: string): string | undefined {
  const idx = argv.indexOf(name);
  if (idx < 0) return undefined;
  return argv[idx + 1];
}

function parseIntArg(argv: string[], name: string, fallback: number): number {
  const raw = parseArg(argv, name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function buildQueryFromTitle(title: string): string {
  const cleaned = title
    .replace(/[0-9A-Za-z]/g, "")
    .replace(/[，。、“”‘’：；！？《》【】（）()\\[\\]\\-\\s]/g, "")
    .trim();
  if (!cleaned) return "";
  if (cleaned.length <= 6) return cleaned;
  return cleaned.slice(0, 6);
}

function computeRecall(run: BenchmarkRun): number {
  if (!run.expectedIds.length) return 1;
  const returned = new Set(run.returnedIds);
  const hit = run.expectedIds.filter((id) => returned.has(id)).length;
  return hit / run.expectedIds.length;
}

function p95(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * 0.95) - 1;
  return sorted[Math.max(0, idx)];
}

async function updateStatusByIds(
  supabase: ReturnType<typeof createClient>,
  ids: string[],
  status: "published" | "draft",
  chunkSize = 20
) {
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { error } = await supabase.from("cms_articles").update({ status }).in("id", chunk);
    if (error) {
      throw new Error(
        JSON.stringify(
          {
            phase: "status_update",
            status,
            chunkStart: i,
            chunkEnd: i + chunk.length - 1,
            code: (error as { code?: string }).code,
            message: (error as { message?: string }).message
          },
          null,
          2
        )
      );
    }
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const normalizedPath = parseArg(argv, "--normalized");
  if (!normalizedPath) {
    throw new Error("Usage: tsx scripts/benchmark-search-subset.ts --normalized <file> [--sample-size 40]");
  }
  const sampleSize = parseIntArg(argv, "--sample-size", 40);

  const normalized = JSON.parse(readFileSync(normalizedPath, "utf8")) as NormalizedInput;
  const keepLegacyIds = new Set(normalized.rows.map((row) => Number(row.legacyId)).filter((id) => Number.isFinite(id)));

  const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false }
  });

  const { data: statusRows, error: statusError } = await supabase
    .from("cms_articles")
    .select("id, legacy_id, status")
    .eq("locale", "zh");
  if (statusError) throw statusError;

  const rows = (statusRows ?? []) as ArticleStatusRow[];
  const idsToDraft = rows
    .filter((row) => row.status === "published" && !keepLegacyIds.has(Number(row.legacy_id ?? NaN)))
    .map((row) => String(row.id));

  // Restore list tracks rows changed by this script only.
  const idsToRestore = [...idsToDraft];

  try {
    if (idsToDraft.length > 0) {
      // eslint-disable-next-line no-console
      console.error(`[subset-benchmark] drafting ${idsToDraft.length} rows`);
      await updateStatusByIds(supabase, idsToDraft, "draft");
    }

    const seedLimit = Math.max(sampleSize * 6, 500);
    const { data: seedRows, error: seedError } = await supabase
      .from("cms_articles")
      .select("id, title")
      .eq("locale", "zh")
      .eq("status", "published")
      .order("legacy_id", { ascending: true })
      .limit(seedLimit);
    if (seedError) throw seedError;

    const candidates = (seedRows ?? []) as ArticleSeedRow[];
    const chosen: Array<{ id: string; query: string }> = [];
    const seenQueries = new Set<string>();

    for (const row of candidates) {
      const query = buildQueryFromTitle(String(row.title ?? ""));
      if (!query) continue;
      if (seenQueries.has(query)) continue;
      seenQueries.add(query);
      chosen.push({ id: String(row.id), query });
      if (chosen.length >= sampleSize) break;
    }

    const runs: BenchmarkRun[] = [];
    for (const item of chosen) {
      const start = performance.now();
      const { data: rpcRows, error } = await supabase.rpc("search_articles_trgm", {
        p_query: item.query,
        p_locale: "zh",
        p_limit: 20,
        p_offset: 0
      });
      const latencyMs = Math.round((performance.now() - start) * 100) / 100;

      if (error) {
        if ((error as { code?: string }).code === "57014") {
          runs.push({
            query: item.query,
            expectedIds: [item.id],
            returnedIds: [],
            latencyMs,
            timedOut: true
          });
          continue;
        }
        throw error;
      }

      const returnedIds = ((rpcRows ?? []) as SearchRpcRow[]).map((row) => String(row.id));
      runs.push({
        query: item.query,
        expectedIds: [item.id],
        returnedIds,
        latencyMs
      });
    }

    const recalls = runs.map(computeRecall);
    const latencies = runs.map((run) => run.latencyMs);
    const avgRecall = recalls.reduce((sum, val) => sum + val, 0) / Math.max(1, recalls.length);
    const p95Latency = p95(latencies);
    const pass = avgRecall >= 0.72 && p95Latency <= 250;
    const timedOut = runs.filter((run) => run.timedOut).length;

    process.stdout.write(
      JSON.stringify(
        {
          subsetPublishedCount: keepLegacyIds.size,
          totalQueries: runs.length,
          timedOutQueries: timedOut,
          avgRecall,
          p95Latency,
          pass
        },
        null,
        2
      )
    );
  } finally {
    if (idsToRestore.length > 0) {
      // eslint-disable-next-line no-console
      console.error(`[subset-benchmark] restoring ${idsToRestore.length} rows`);
      await updateStatusByIds(supabase, idsToRestore, "published");
    }
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
