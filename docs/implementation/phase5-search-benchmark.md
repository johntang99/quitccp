# Phase 5 Search Baseline Checkpoint

Date: 2026-08-13

## What Was Executed

- Dataset context: `10,000` migrated published articles in `cms_articles`.
- Live benchmark input generated from real article titles:
  - `artifacts/phase5/query-results-80.json`
- Benchmark scoring:
  - `tsx scripts/benchmark-search.ts artifacts/phase5/query-results-80.json`

## Current Benchmark Result

### Post-SQL Run 1

- Result file: `artifacts/phase5/query-results-80-after-sql-run1.json`
- `totalQueries`: `80`
- `avgRecall`: `0`
- `p95Latency`: `8349.28ms`
- `pass`: `false`
- Timeout profile: `80/80` runs timed out (~`8200.4ms` avg latency)

### Post-SQL Run 2

- Result file: `artifacts/phase5/query-results-80-after-sql-run2.json`
- `totalQueries`: `80`
- `avgRecall`: `0`
- `p95Latency`: `8363.92ms`
- `pass`: `false`
- Timeout profile: `80/80` runs timed out (~`8200.12ms` avg latency)
- Recommendation from harness: `Evaluate Meilisearch/Typesense`

### 2,800-Article Control Check

- Method: loaded an isolated benchmark locale with exactly 2,800 rows, then ran same harness.
- Result file: `artifacts/phase5/query-results-80-locale-2800.json`
- `totalQueries`: `80`
- `avgRecall`: `0.35`
- `p95Latency`: `6010.78ms`
- `pass`: `false`

## Interpretation

- Baseline `search_articles_trgm` does not meet Phase 5 targets on 10k dataset:
  - required recall >= `0.72`
  - required p95 latency <= `250ms`
- Two consecutive post-SQL benchmark runs failed with identical timeout behavior.
- Formal Phase 5 verdict: **FAIL** for `pg_trgm` baseline in current DB shape.

## Changes Prepared to Address This

- Added DB migration draft:
  - `supabase/content/migrations/007_search_function_optimized.sql`
- This migration rewrites `search_articles_trgm` to:
  - preselect top title/body candidates separately,
  - union reduced candidate sets,
  - rank with tuned weights (`title 0.65`, `body 0.35`),
  - avoid expensive tag joins in hot path.

## App-Level Safety Added

- Search endpoint and page are now wired to DB search:
  - `apps/web/src/app/api/search/route.ts`
  - `apps/web/src/app/search/page.tsx`
  - `apps/web/src/lib/search-repository.ts`
- If `search_articles_trgm` errors/timeouts, code falls back to a title `ILIKE` query so search remains available while DB tuning is being finalized.

## Meilisearch Dual-Read Implemented and Tested

- Added backend switch + dual-read compare path in:
  - `apps/web/src/lib/search-repository.ts`
  - `apps/web/src/app/api/search/route.ts`
- Added admin sync endpoint (authenticated + MFA):
  - `apps/web/src/app/api/admin/content/search/sync/route.ts`
  - Trigger form in `apps/web/src/app/admin/settings/page.tsx`
- Added Meilisearch sync and benchmark tooling:
  - `scripts/sync-meilisearch.ts`
  - `scripts/generate-search-benchmark-results.ts` (`--backend meilisearch`)
- Added scripts:
  - `npm run search:sync:meili`
  - `npm run benchmark:search:generate -- --backend meilisearch ...`

Local validation performed by agent:

1. Started local Meilisearch (`getmeili/meilisearch:v1.10`, port `7700`).
2. Synced `10,000` zh articles from Supabase to `articles` index.
3. Ran benchmark (`80` live Chinese queries) on Meilisearch backend:
   - Result file: `artifacts/phase5/query-results-80-meili.json`
   - `avgRecall`: `0.975`
   - `p95Latency`: `9.07ms`
   - `pass`: `true`
4. Ran repository smoke test with dual-read enabled:
   - effective backend: `meilisearch`
   - secondary compare log emitted against `pg_trgm`
5. End-to-end runtime smoke check after dev server restart:
   - Admin login: `POST /api/admin/auth/login` -> `303 /admin/dashboard`
   - Authenticated sync trigger: `POST /api/admin/content/search/sync` -> `303 /admin/settings?searchSync=ok&indexed=10000&index=articles`
   - Public search API probe: `GET /api/search?q=退党证明&locale=zh&limit=3`
     - response metadata: `backend=meilisearch`, `primaryBackend=meilisearch`, `dualReadEnabled=true`

## Operations Reference

1. Configure env:
   - `SEARCH_PRIMARY_BACKEND=meilisearch`
   - `SEARCH_DUAL_READ=true`
   - `MEILI_HOST=...`
   - `MEILI_MASTER_KEY=...` (or `MEILI_SEARCH_API_KEY`)
   - `MEILI_INDEX_ARTICLES=articles`
2. Index sync options:
   - CLI: `npm run search:sync:meili -- --locales zh --batch-size 200`
   - Admin UI: `/admin/settings` -> “搜索索引（Meilisearch）” -> submit sync form
3. Benchmark comparison:
   - pg path: `tsx scripts/generate-search-benchmark-results.ts --backend pg_trgm --locale zh --sample-size 80`
   - meili path: `tsx scripts/generate-search-benchmark-results.ts --backend meilisearch --locale zh --sample-size 80`
   - score: `tsx scripts/benchmark-search.ts <result-file>`
4. Dual-read monitor signal:
   - Check server logs for `[search-dual-read]` lines to compare top IDs and detect drift.

## Next Step

1. Keep `SEARCH_PRIMARY_BACKEND=meilisearch` and `SEARCH_DUAL_READ=true` in staging/production-like env.
2. Run 7-day dual-read verification and monitor mismatch samples + latency.
3. After verification, keep Meilisearch primary and retain Postgres fallback for resilience.
