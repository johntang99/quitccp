# Phase 4 Migration Verification (Dry-Run + Apply Loop)

Date: 2026-08-13

## Scope

- Expanded migration test from 2,800 rows to 10,000 rows.
- Ran repeatable import + redirect load loop against Supabase.
- Verified redirect integrity against migrated article targets.

## Pipeline Used

- Normalize WordPress posts:
  - `WP_BASE_URL="https://www.tuidang.org" npm run migrate:wp -- --per-page 20 --max-posts 10000`
- Build redirect map:
  - `npm run redirects:build -- artifacts/phase4/normalized-10000.json`
- Validate redirect map:
  - `npm run redirects:validate -- artifacts/phase4/redirects-10000.json`
- Import normalized posts:
  - `npm run migrate:import -- artifacts/phase4/normalized-10000.json --apply --batch-size 20`
- Load redirects:
  - `npm run redirects:load -- artifacts/phase4/redirects-10000.json --apply`

## Result Snapshot

- Normalized rows: `10,000`
- Unique legacy IDs: `10,000`
- Unique slugs: `10,000`
- Redirect rows validated: `10,000` (`ok: true`)
- Category distribution:
  - `news`: `7,785`
  - `withdrawal-stories`: `1,181`
  - `red-regime-collapse`: `486`
  - `withdrawal-news`: `548`

## DB Verification (After Apply)

- `cms_articles` (`locale=zh`): `10,000`
- `cms_article_category_map`: `10,000`
- `cms_redirects`: `10,000`
- `cms_articles.legacy_id is null`: `0`
- `cms_articles.legacy_url is null`: `0`

## Idempotency Verification

- Re-ran full apply loop (`import` + `redirect load`) on the same 10k artifacts.
- Row counts remained unchanged:
  - `cms_articles`: `10,000`
  - `cms_article_category_map`: `10,000`
  - `cms_redirects`: `10,000`

## Redirect Validation Evidence

- Sample spot-check (`n=30`) against DB targets:
  - Missing target articles: `0`
  - Destination mismatches: `0`
- Full consistency check (`n=10,000`) by `legacy_url` join logic:
  - Resolved article targets: `10,000`
  - Missing: `0`
  - Mismatch: `0`

## Stability Improvements Applied During Verification

- `scripts/migrate-wp-posts.ts`
  - Added Cloudflare-block fallback path for WordPress API fetch.
  - Added category fetch/remap by WordPress taxonomy IDs.
  - Kept deterministic normalized output ordering.
- `scripts/build-redirect-map.ts`
  - Added dedupe by `legacy_url` and deterministic sort.
- `scripts/validate-redirects.ts`
  - Added stricter checks for legacy path shape and status code validity.
- `scripts/import-normalized-posts.ts`
  - Added `--batch-size` and `--update-existing` flags.
  - Default behavior is idempotent-safe (`ignoreDuplicates`) for repeat runs.
  - Added adaptive timeout-split upsert behavior.
  - Added numeric `legacy_id` based lookup to avoid long URL/query payload issues.

## Artifacts

- `artifacts/phase4/normalized-10000.json`
- `artifacts/phase4/redirects-10000.json`
- `artifacts/phase4/normalized-2800.json`
- `artifacts/phase4/redirects-2800.json`
- `artifacts/phase4/normalized-sample.json`
