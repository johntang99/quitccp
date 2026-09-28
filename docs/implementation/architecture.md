# QuitCCP Implementation Architecture

## Applications

- `apps/web`: unified Next.js app containing:
  - public site routes (`/`)
  - admin CMS routes (`/admin/*`)
  - service APIs (`/api/service/*`)

## Data Strategy (Single DB Project)

- Use **one Supabase project** for now, with strict logical isolation:
  - Content domain tables:
    - `cms_pages`, `cms_articles`, `cms_videos`, media metadata, revisions, redirects.
  - Sensitive service tables:
    - `declarations`, `certificates`, verification logs, service audit logs.
- Keep separation by:
  - dedicated app roles (web read role, admin write role, service role),
  - RLS policies and least privilege grants,
  - independent audit trails for content/admin vs service operations.

## Environment Simplification

- One project means one shared Supabase host/project identity in deployment.
- Keep app-specific secrets minimal:
  - unified web/admin/service runtime env in one Next.js deployment.
- This preserves operational simplicity without giving up security boundaries.

## Search Strategy

- Primary baseline: `pg_trgm` on Chinese title/body plain text.
- Ranking function and SQL RPC defined in content migrations.
- Benchmark and fallback policy documented in `docs/implementation/search-baseline.md`.

## Deferred Product Items

- Item `1.4` placement remains deferred.
- Global service-point map remains deferred.
