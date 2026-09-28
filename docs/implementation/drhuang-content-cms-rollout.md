# DrHuang-Style Page CMS Rollout Checklist

## Preflight
- Apply DB migration: `supabase/content/migrations/008_content_entries.sql`.
- Verify admin auth works (`/admin/login`) and role has write permission.
- Ensure `MFA_REQUIRED` policy matches environment expectation.

## Seed Prototype Content
- Dry run:
  - `npm run content:seed:prototype -- --locale zh`
- Apply:
  - `npm run content:seed:prototype -- --locale zh --apply`
- Optional overwrite:
  - `npm run content:seed:prototype -- --locale zh --overwrite --apply`

## Functional QA
- Admin explorer:
  - Open `/admin/content`.
  - Confirm file list includes `pages/*` and shared JSON files.
  - Open any page file, edit structured fields, save, refresh, and confirm persistence.
- JSON fallback:
  - Edit raw JSON tab for a page, save, then refresh.
  - Confirm format action and duplicate action work.
- Revision flow:
  - Save a file twice, inspect revision list, restore older revision, verify page output changed.
- Import/export:
  - Run "导入原型页面", then export current locale and verify JSON payload.
- Security:
  - Verify unauthorized API access to `/api/admin/content/*` returns `401`.
  - Verify non-writer role cannot mutate (`403` expected).

## Public Runtime QA
- Verify pages render with `200`:
  - `/`, `/about`, `/services`, `/services/declare`, `/resources`, `/resources/tools`, `/videos`, `/news`.
- Edit `pages/services-index.json` in admin and confirm `/services` reflects changes.
- Edit `pages/resources-index.json` in admin and confirm `/resources` reflects changes.

## Staged Rollout
- Stage 1: `services` + `resources` editable entries enabled.
- Stage 2: `about` + `involve`.
- Stage 3: `videos` + `news index` + root.
- Stage 4: after verification, retire `cms_pages.blocks` fallback path.

## Current Local Verification Snapshot
- `npm run typecheck` passes.
- `npm run build --workspace apps/web` passes.
- Public route smoke test passes on local dev server.
- Seeder currently requires migration `008_content_entries.sql` to be applied in target DB.
