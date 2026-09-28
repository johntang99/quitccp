create extension if not exists pg_trgm;

create table if not exists cms_pages (
  id uuid primary key default gen_random_uuid(),
  section text not null,
  slug text not null,
  locale text not null default 'zh',
  title text not null,
  template_kind text not null,
  status text not null default 'draft',
  blocks jsonb not null default '[]'::jsonb,
  seo jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(section, slug, locale)
);

create table if not exists cms_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  locale text not null default 'zh',
  title text not null,
  summary text not null default '',
  body_markdown text not null default '',
  body_plain text not null default '',
  section text not null default 'news',
  status text not null default 'draft',
  editorial_status text not null default 'draft',
  legacy_url text,
  legacy_id bigint,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(slug, locale)
);

create table if not exists cms_article_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null
);

create table if not exists cms_article_tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null
);

create table if not exists cms_article_category_map (
  article_id uuid not null references cms_articles(id) on delete cascade,
  category_id uuid not null references cms_article_categories(id) on delete cascade,
  primary key(article_id, category_id)
);

create table if not exists cms_article_tag_map (
  article_id uuid not null references cms_articles(id) on delete cascade,
  tag_id uuid not null references cms_article_tags(id) on delete cascade,
  primary key(article_id, tag_id)
);

create table if not exists cms_media_assets (
  id uuid primary key default gen_random_uuid(),
  asset_type text not null,
  name text not null,
  storage_path text not null,
  mime_type text,
  byte_size bigint,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists cms_videos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  duration_seconds integer,
  cover_asset_id uuid references cms_media_assets(id) on delete set null,
  platform_ids jsonb not null default '{}'::jsonb,
  download_asset_id uuid references cms_media_assets(id) on delete set null,
  status text not null default 'draft',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists cms_revisions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  payload jsonb not null,
  actor_email text not null,
  created_at timestamptz not null default now()
);

create table if not exists cms_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_email text not null,
  action text not null,
  target_type text not null,
  target_id text not null,
  access_mode text not null check (access_mode in ('read','write')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists cms_redirects (
  id uuid primary key default gen_random_uuid(),
  legacy_url text not null unique,
  destination_url text not null,
  status_code integer not null default 301,
  created_at timestamptz not null default now()
);

create index if not exists idx_cms_articles_title_trgm on cms_articles using gin (title gin_trgm_ops);
create index if not exists idx_cms_articles_body_plain_trgm on cms_articles using gin (body_plain gin_trgm_ops);
create index if not exists idx_cms_articles_status_locale on cms_articles(status, locale);
create index if not exists idx_cms_pages_section_slug_locale on cms_pages(section, slug, locale);
