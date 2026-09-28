# Rollback Drill Procedure

## Goal

Verify we can safely roll back one production deployment while preserving content and audit integrity.

## Preconditions

- Snapshot backups for content DB and service DB available.
- Current and previous deploy artifacts accessible.
- Maintenance contact list ready.

## Drill Steps

1. Deploy release candidate to staging.
2. Create test content in CMS (page + article) and one declaration in service backend.
3. Trigger rollback to previous build.
4. Verify:
   - public routes still resolve,
   - data writes from rollback window are either preserved or reconciled from logs,
   - audit logs capture rollback event and operator identity.
5. Restore latest build and replay safe writes if needed.

## Pass Criteria

- Rollback completes within 15 minutes.
- No sensitive data leakage.
- No orphaned redirects or broken top-level routes.
