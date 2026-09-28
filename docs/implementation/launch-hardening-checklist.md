# Launch Hardening Checklist

## Security

- [ ] Admin content app enforces MFA for all write actions.
- [ ] Sensitive service APIs under `/api/service/*` are isolated by strict RBAC + MFA + RLS.
- [ ] Read and write audit logs are enabled in both systems.
- [ ] Role permissions validated for viewer/editor/reviewer/admin personas.
- [ ] Secret rotation plan documented and tested.

## Content and Routing

- [ ] All prototype IA routes resolve in `apps/web`.
- [ ] 301 redirect coverage for legacy WordPress URLs validated.
- [ ] 404 page and search fallback behavior confirmed.
- [ ] Deferred items remain deferred (`1.4` placement and service-point map).

## Search

- [ ] `pg_trgm` indexes created in target environment.
- [ ] Benchmark pass meets recall and latency thresholds.
- [ ] Fallback criteria documented and approved.

## Reliability

- [ ] DB backup and restore drill completed.
- [ ] Rollback procedure tested against one release candidate.
- [ ] Health probes and alert channels configured.

## Accessibility and Performance

- [ ] Keyboard navigation and focus states verified.
- [ ] Chinese typography readability validated on mobile.
- [ ] LCP/CLS performance budgets checked on key templates.

## Current Evidence (2026-08-13)

- [x] `npm run preflight` returns `ok: true`.
- [x] Legacy redirect validation and migration evidence captured in `docs/implementation/phase4-migration-verification.md`.
- [x] Search fallback criteria executed; Meilisearch dual-read benchmark evidence captured in `docs/implementation/phase5-search-benchmark.md`.
- [-] Remaining launch gate items are rollback drill, backup/restore drill, and final accessibility/performance sign-off.
