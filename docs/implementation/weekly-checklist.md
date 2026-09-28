# QuitCCP Weekly Checklist (Execution)

Use this as the compact companion to `implementation-phases.md`.

Status legend: `[ ]` not started, `[-]` in progress, `[x]` done, `[!]` blocked.

## Week 1 - Foundation + DB Ready

- [x] Create one Supabase project (single-DB strategy).
- [x] Run all SQL migrations in required order.
- [x] Configure env vars for unified `apps/web` runtime (`/`, `/admin`, `/api/service`).
- [x] Verify public routes, admin routes, and service APIs can connect to DB.
- [x] Confirm CI baseline (`typecheck`, `test`, `preflight`) passes.

## Week 2 - CMS Core + Auth Hardening

- [x] Replace in-memory stores with DB-backed repositories.
- [x] Enforce RBAC + MFA for write endpoints.
- [x] Complete page/article revision restore validation.
- [x] Add/verify audit logging on read + write actions.
- [x] Smoke test content editor workflows with real data.

## Week 3 - Article Scale + Editorial Workflow

- [x] Finalize article list pagination/filter/sort performance.
- [x] Validate draft/review/publish/archive transitions.
- [x] Validate bulk operations + audit traces.
- [x] Finish category/tag management behavior.
- [x] Confirm archive/article public routes render DB content.

## Week 4 - WP Migration + Redirect Safety

- [x] Dry-run WordPress import (`migrate-wp-posts.ts`).
- [x] Validate taxonomy remap to new IA.
- [x] Generate redirect map (`build-redirect-map.ts`).
- [x] Validate redirect integrity (`validate-redirects.ts`).
- [x] Repeat import until deterministic/idempotent.

## Week 5 - Chinese Search + Frontend Completion

- [x] Validate `pg_trgm` indexes and search SQL behavior.
- [x] Run benchmark harness and compare against thresholds.
- [x] Finalize mobile nav, search results UX, and 404 behavior.
- [x] Confirm all required IA routes are dynamic and correct.
- [x] Keep deferred items unchanged (`1.4`, global map).

## Week 6 - QA + Launch Readiness

- [-] Execute launch hardening checklist.
- [ ] Run rollback drill and backup/restore drill.
- [-] Complete accessibility and performance checks.
- [ ] Validate observability/alerts and incident path.
- [ ] Final go/no-go review with evidence links.

---

## Daily Tracking Block (copy each day)

**Date:**  
**Focus week:**  
**Today’s top 3 tasks:**  
1.  
2.  
3.  

**Progress:**  
- Done:  
- In progress:  
- Blocked:  

**Risks / decisions needed:**  
-  

**Next action tomorrow:**  
-  
