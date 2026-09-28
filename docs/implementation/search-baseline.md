# Chinese Search Baseline (`pg_trgm`)

## Baseline Query

Use trigram similarity on:

- `cms_articles.title`
- `cms_articles.body_plain`
- tag aggregate (`cms_article_tags`)

The canonical SQL function lives in:

- `supabase/content/migrations/002_search_functions.sql`

## Acceptance Targets

- Recall >= `0.72`
- P95 latency <= `250ms`
- Published-content only

## Benchmark Harness

- Script: `scripts/benchmark-search.ts`
- Input: sampled Chinese query fixtures and expected article IDs.
- Output includes pass/fail and fallback recommendation.

## Escalation Rule

If either recall or latency target fails for two consecutive benchmark runs on production-like datasets:

1. Enable dedicated index service (Meilisearch or Typesense).
2. Keep Postgres as source of truth.
3. Run dual-read comparison for 7 days before cutover.
