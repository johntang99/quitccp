# QuitCCP Implementation Plan (Single DB Project)

This execution plan follows the approved architecture and keeps deployment simple with one Supabase project.

## Phase 0 - Project and DB Setup (Day 1-2)

### Goals

- Establish the engineering baseline.
- Prepare one DB project and apply all schema migrations.

### Tasks

- Confirm monorepo structure is ready:
  - `apps/web`
  - `packages/content-schema`
- Create one Supabase project for both content and service domains.
- Run SQL migrations in this order:
  1. `supabase/content/migrations/001_initial_content_schema.sql`
  2. `supabase/content/migrations/002_search_functions.sql`
  3. `supabase/content/migrations/003_editorial_workflow.sql`
  4. `supabase/service/migrations/001_initial_service_schema.sql`
  5. `supabase/service/migrations/002_rls_policy_baseline.sql`
- Configure environment variables in local and production.

### Exit Criteria

- All migrations applied successfully.
- unified `apps/web` runtime (public + admin + service APIs) can connect to DB.

---

## Phase 1 - Replace Scaffolds With Real DB Data (Day 3-6)

### Goals

- Replace in-memory stores with DB-backed repositories.
- Keep API contracts stable.

### Tasks

- Wire `/api/admin/*` APIs to real tables:
  - pages, articles, media, revisions, audit.
- Wire `/api/service/*` APIs to real tables:
  - declarations, certificates, verify, service audit.
- Add transaction handling for write + revision + audit operations.
- Add query pagination primitives for article listing.

### Exit Criteria

- CRUD and list operations use DB only.
- No critical code path relies on in-memory data.

---

## Phase 2 - CMS Core Hardening (Week 2)

### Goals

- Make admin workflows production-safe.

### Tasks

- Finalize role and permission matrix:
  - `super_admin`, `content_admin`, `editor`, `reviewer`, `viewer`.
- Enforce MFA for write operations.
- Enforce review workflow for article publishing.
- Strengthen revision restore flow with validation and audit detail.
- Add content settings editor (header/footer/nav/SEO).

### Exit Criteria

- Role restrictions verified end-to-end.
- Revision rollback and audit logs validated.

---

## Phase 3 - Article System at Scale (Week 2-3)

### Goals

- Support ~2,800 legacy posts and future growth.

### Tasks

- Complete article admin capabilities:
  - pagination,
  - search/filter/sort,
  - bulk actions,
  - draft/review/publish lifecycle.
- Improve category/tag management and mapping tables.
- Add route-level query optimization and relevant indexes.

### Exit Criteria

- Article module remains responsive on large datasets.
- Editorial workflow usable by real editors.

---

## Phase 4 - WordPress Migration and Redirects (Week 3-4)

### Goals

- Safely migrate historical content and preserve legacy links.

### Tasks

- Use migration pipeline scripts:
  - `scripts/migrate-wp-posts.ts`
  - `scripts/build-redirect-map.ts`
  - `scripts/validate-redirects.ts`
- Map old taxonomies to the new IA structure.
- Store `legacy_id` and `legacy_url` for traceability.
- Load 301 redirects into `cms_redirects`.
- Run repeated dry-runs until idempotent.

### Exit Criteria

- Migration is repeatable and deterministic.
- Redirect validation passes with no critical misses.

---

## Phase 5 - Chinese Search Baseline (`pg_trgm`) (Week 4)

### Goals

- Deliver Chinese content search without additional infrastructure first.

### Tasks

- Verify trigram indexes are present for title/body.
- Tune ranking weights in `search_articles_trgm`.
- Run benchmark harness:
  - `scripts/benchmark-search.ts`
- Validate thresholds from `docs/implementation/search-baseline.md`:
  - recall >= `0.72`
  - p95 latency <= `250ms`

### Exit Criteria

- Baseline passes benchmark targets, or fallback is formally triggered.

---

## Phase 6 - Frontend Parity and UX Completion (Week 4-5)

### Goals

- Reach functional parity with prototype IA and templates.

### Tasks

- Finish dynamic rendering for all core sections.
- Finalize 7 template implementations with CMS-fed data.
- Confirm mobile drawer navigation behavior.
- Complete search results UX and 404 flow.
- Keep deferred business items unchanged:
  - section `1.4` placement deferred,
  - global service map deferred.

### Exit Criteria

- All required IA routes resolve and render correctly.
- Navigation/search/404 are production-ready.

---

## Phase 7 - Security, QA, and Launch Readiness (Week 5-6)

### Goals

- Ensure reliability, security, and release confidence.

### Tasks

- Execute hardening checklist:
  - `docs/implementation/launch-hardening-checklist.md`
- Execute rollback drill:
  - `docs/implementation/rollback-drill.md`
- Validate:
  - accessibility,
  - performance budgets,
  - audit completeness,
  - backup/restore process.
- Run preflight:
  - `npm run preflight`

### Exit Criteria

- Launch checklist completed.
- Rollback and backup/restore drills pass.

---

## Ongoing Progress Tracking

Track each phase with:

- Status: `Not Started` / `In Progress` / `Blocked` / `Done`
- Owner
- Start date and ETA
- Risks and mitigation
- Exit criteria evidence

Recommended cadence:

- Daily technical progress update
- Twice-weekly architecture/security review
- Weekly migration/search quality review

---

## Current Status Snapshot (2026-08-13)

- Phase 0: `Done`
- Phase 1: `Done`
- Phase 2: `Done`
- Phase 3: `Done`
- Phase 4: `Done` (10k dry-run/apply loop validated, idempotent)
- Phase 5: `Done` (fallback triggered; Meilisearch dual-read implemented and benchmarked)
- Phase 6: `Done` (core sections dynamic, templates/rendering wired to CMS + site settings)
- Phase 7: `In Progress` (preflight passing; rollback drill + final launch checks pending)
