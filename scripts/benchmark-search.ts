/**
 * pg_trgm benchmark harness (offline scaffold).
 *
 * Expected input:
 *   query_results.json
 *   {
 *     "runs": [
 *       { "query": "退党证明", "expectedIds": ["a1","a8"], "returnedIds": ["a8","a2","a1"], "latencyMs": 121 }
 *     ]
 *   }
 */

import { readFileSync } from "node:fs";

interface QueryRun {
  query: string;
  expectedIds: string[];
  returnedIds: string[];
  latencyMs: number;
}

interface InputFile {
  runs: QueryRun[];
}

function computeRecall(run: QueryRun): number {
  if (!run.expectedIds.length) return 1;
  const set = new Set(run.returnedIds);
  const hit = run.expectedIds.filter((id) => set.has(id)).length;
  return hit / run.expectedIds.length;
}

function p95(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * 0.95) - 1;
  return sorted[Math.max(0, idx)];
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) throw new Error("Missing benchmark result file");
  const parsed = JSON.parse(readFileSync(inputPath, "utf8")) as InputFile;
  const recalls = parsed.runs.map(computeRecall);
  const latencies = parsed.runs.map((run) => run.latencyMs);
  const avgRecall = recalls.reduce((sum, val) => sum + val, 0) / Math.max(1, recalls.length);
  const p95Latency = p95(latencies);
  const pass = avgRecall >= 0.72 && p95Latency <= 250;

  process.stdout.write(
    JSON.stringify(
      {
        totalQueries: parsed.runs.length,
        avgRecall,
        p95Latency,
        pass,
        fallbackRecommendation: pass ? "pg_trgm acceptable" : "Evaluate Meilisearch/Typesense"
      },
      null,
      2
    )
  );
}

main();
