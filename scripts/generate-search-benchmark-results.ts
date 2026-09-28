import { performance } from "node:perf_hooks";
import { createClient } from "@supabase/supabase-js";

interface ArticleSeedRow {
  id: string;
  title: string;
}

interface SearchRpcRow {
  id: string;
}

interface MeiliHit {
  id: string;
}

interface MeiliSearchResponse {
  hits?: MeiliHit[];
}

type BenchmarkBackend = "pg_trgm" | "meilisearch";

interface BenchmarkRun {
  query: string;
  expectedIds: string[];
  returnedIds: string[];
  latencyMs: number;
  timedOut?: boolean;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseSampleSize(argv: string[]): number {
  const index = argv.indexOf("--sample-size");
  if (index < 0) return 80;
  const maybe = Number(argv[index + 1]);
  if (!Number.isFinite(maybe) || maybe <= 0) return 80;
  return Math.floor(maybe);
}

function parseLocale(argv: string[]): string {
  const index = argv.indexOf("--locale");
  if (index < 0) return "zh";
  return (argv[index + 1] ?? "zh").trim() || "zh";
}

function parseBackend(argv: string[]): BenchmarkBackend {
  const index = argv.indexOf("--backend");
  if (index < 0) return "pg_trgm";
  const raw = (argv[index + 1] ?? "pg_trgm").trim().toLowerCase();
  return raw === "meilisearch" ? "meilisearch" : "pg_trgm";
}

function getMeiliConfig() {
  const host = requireEnv("MEILI_HOST");
  const apiKey = process.env.MEILI_MASTER_KEY?.trim() || process.env.MEILI_SEARCH_API_KEY?.trim() || "";
  const index = process.env.MEILI_INDEX_ARTICLES?.trim() || "articles";
  return {
    host,
    apiKey,
    index
  };
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

async function main() {
  const args = process.argv.slice(2);
  const sampleSize = parseSampleSize(args);
  const locale = parseLocale(args);
  const backend = parseBackend(args);
  const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false }
  });

  const seedLimit = Math.max(sampleSize * 6, 500);
  const { data: seedRows, error: seedError } = await supabase
    .from("cms_articles")
    .select("id, title")
    .eq("locale", locale)
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
  const meiliConfig = backend === "meilisearch" ? getMeiliConfig() : null;
  for (const item of chosen) {
    const start = performance.now();
    try {
      if (backend === "pg_trgm") {
        const { data: rpcRows, error } = await supabase.rpc("search_articles_trgm", {
          p_query: item.query,
          p_locale: locale,
          p_limit: 20,
          p_offset: 0
        });
        if (error) throw error;
        const returnedIds = ((rpcRows ?? []) as SearchRpcRow[]).map((row) => String(row.id));
        runs.push({
          query: item.query,
          expectedIds: [item.id],
          returnedIds,
          latencyMs: Math.round((performance.now() - start) * 100) / 100
        });
      } else {
        const url = `${meiliConfig!.host.replace(/\/$/, "")}/indexes/${encodeURIComponent(meiliConfig!.index)}/search`;
        const headers: Record<string, string> = {
          "content-type": "application/json"
        };
        if (meiliConfig!.apiKey) {
          headers.authorization = `Bearer ${meiliConfig!.apiKey}`;
        }
        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({
            q: item.query,
            limit: 20,
            offset: 0,
            filter: [`locale = "${locale}"`, `status = "published"`],
            attributesToRetrieve: ["id"]
          })
        });
        if (!response.ok) {
          throw new Error(`Meili search failed: ${response.status} ${response.statusText}`);
        }
        const payload = (await response.json()) as MeiliSearchResponse;
        const returnedIds = (payload.hits ?? []).map((hit) => String(hit.id));
        runs.push({
          query: item.query,
          expectedIds: [item.id],
          returnedIds,
          latencyMs: Math.round((performance.now() - start) * 100) / 100
        });
      }
    } catch (error) {
      const isTimeout = typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "57014";
      runs.push({
        query: item.query,
        expectedIds: [item.id],
        returnedIds: [],
        latencyMs: Math.round((performance.now() - start) * 100) / 100,
        timedOut: isTimeout
      });
    }
  }

  process.stdout.write(
    JSON.stringify(
      {
        backend,
        locale,
        sampleSize: chosen.length,
        runs
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
