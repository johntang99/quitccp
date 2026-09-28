# QuitCCP Platform Monorepo

## Common commands

```bash
# restart the dev server cleanly
lsof -ti:4020 | xargs kill -9
rm -rf .next
npm run dev

npm install
npm run build

git add .
git commit -m "Update: describe your changes"
git push
```



This repository contains the full implementation for the QuitCCP dynamic platform:

- `apps/web` - Unified Next.js app:
  - Public site routes
  - Admin CMS routes under `/admin/*`
  - Service APIs under `/api/service/*`
- `packages/content-schema` - Shared content schemas and seed structures.
- `supabase/content` - Content database migrations.
- `supabase/service` - Sensitive service database migrations.
- `scripts` - Migration and validation scripts.

## Quick Start

1. Install dependencies:
   - `npm install`
2. Configure local env:
   - `cp .env.example .env.local`
   - Update Supabase keys and any secrets you need.
3. Run app:
   - Unified app: `npm run dev`
4. Run checks:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test`

## Local URLs

- App base URL: `http://localhost:4020`
- Admin login: `http://localhost:4020/admin/login`
- Health check: `http://localhost:4020/api/health`

The web app is configured to run on port `4020` (`apps/web/package.json`).

## Admin Login (Local)

Admin login is backed by the `cms_admin_users` table. On login, the app will auto-seed a default admin user if missing and if seed env vars are set.

Default seed values in `.env.example`:

- `SEED_ADMIN_EMAIL=admin@quitccp.org`
- `SEED_ADMIN_PASSWORD=change-me`
- `SEED_ADMIN_ROLE=super_admin`
- `SEED_ADMIN_MFA_SECRET=JBSWY3DPEHPK3PXP`

Notes:

- The login page pre-fills email from `SEED_ADMIN_EMAIL`.
- MFA is required by default when the user has MFA enabled (seeded admin is MFA-enabled).
- Use an authenticator app with `SEED_ADMIN_MFA_SECRET` to generate the 6-digit code for local login.

## Search Backend (Dual-Read)

- Primary selector:
  - `SEARCH_PRIMARY_BACKEND=pg_trgm` or `SEARCH_PRIMARY_BACKEND=meilisearch`
- Dual-read compare logs:
  - `SEARCH_DUAL_READ=true`
- Meilisearch sync:
  - `npm run search:sync:meili -- --locales zh --batch-size 200`
- Benchmarks:
  - `npm run benchmark:search:generate -- --backend pg_trgm --locale zh --sample-size 80 > artifacts/phase5/query-results-pg.json`
  - `npm run benchmark:search:generate -- --backend meilisearch --locale zh --sample-size 80 > artifacts/phase5/query-results-meili.json`
  - `npm run benchmark:search -- artifacts/phase5/query-results-pg.json`
  - `npm run benchmark:search -- artifacts/phase5/query-results-meili.json`

## Runtime Health

- Readiness endpoint:
  - `GET /api/health`
- Reports:
  - Supabase connectivity
  - Primary search backend readiness (`pg_trgm` or `meilisearch`)

## Design Inputs

The canonical UI/IA design source is under `docs/prototypes`.
