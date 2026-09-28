# Sensitive Service Database Migrations

This database stores declaration/certificate/verification records and service audit logs.

It is intentionally isolated from the content CMS database.

## Migration Order

1. `001_initial_service_schema.sql`
2. `002_rls_policy_baseline.sql`
