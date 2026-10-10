# QuitCCP Platform Monorepo

## Common commands

```bash
# restart the dev server cleanly
lsof -ti:4020 | xargs kill -9
rm -rf .next
npm run dev

npm install

# Verify the production build WITHOUT breaking a running dev server.
# `next dev` and `next build` both write to .next by default, so a plain
# `npm run build` replaces the chunks the dev server is serving and localhost:4020
# starts 500ing with "Cannot find module ./vendor-chunks/...".
# build:check writes to .next-verify instead, so both can run at once.
npm run build:check

# The real deploy build (writes .next). Stop the dev server first.
npm run build

git add .
git commit -m "Update: describe your changes"
git push
```

admin123
admin@quitccp.org

This repository contains the full implementation for the QuitCCP dynamic platform:

- `apps/web` - Unified Next.js app:
  - Public site routes
  - Admin CMS routes under `/admin/*`
  - Service APIs under `/api/service/*`
- `packages/content-schema` - Shared content schemas and seed structures.
- `supabase/content` - Content database migrations.
- `supabase/service` - Sensitive service database migrations.
- `scripts` - Migration and validation scripts.

## Environment variables

Secrets live in the repo-root `.env.local`. `apps/web/next.config.ts` loads that
file into `process.env` at startup, so route handlers see the root values without
anything being duplicated into `apps/web/.env.local`.

There is deliberately **no `apps/web/.env.local`**. One file locally, one set of
project variables on Vercel — nothing to keep in sync and no second file that


Precedence, highest first:

1. real environment variables (Vercel's project settings, or `FOO=bar npm start`)
2. `apps/web/.env.local` — supported if you create one, but not used here
3. the repo-root `.env.local`aaaa


On Vercel the root file does not exist — it is gitignored — so the loader is a
no-op there and the platform's variables are used directly. **Every variable the
app needs at runtime must be set in the Vercel project**: the Supabase URL,
service-role key and anon key, `JWT_SECRET`, `SUPABASE_STORAGE_BUCKET`,
`NEXT_PUBLIC_SITE_URL`, and `OPENAI_API_KEY` for the 摘要 AI 生成 button.

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

