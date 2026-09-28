create table if not exists cms_content_entries (
  id uuid primary key default gen_random_uuid(),
  locale text not null default 'zh',
  path text not null,
  data jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (locale, path)
);

create table if not exists cms_content_revisions (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references cms_content_entries(id) on delete cascade,
  locale text not null default 'zh',
  path text not null,
  data jsonb not null,
  created_by text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_cms_content_entries_locale_path on cms_content_entries(locale, path);
create index if not exists idx_cms_content_entries_updated_at on cms_content_entries(updated_at desc);
create index if not exists idx_cms_content_revisions_entry_created_at on cms_content_revisions(entry_id, created_at desc);
create index if not exists idx_cms_content_revisions_locale_path on cms_content_revisions(locale, path, created_at desc);

alter table cms_content_entries enable row level security;
drop policy if exists cms_content_entries_no_access on cms_content_entries;
create policy cms_content_entries_no_access
  on cms_content_entries
  for all
  using (false)
  with check (false);

alter table cms_content_revisions enable row level security;
drop policy if exists cms_content_revisions_no_access on cms_content_revisions;
create policy cms_content_revisions_no_access
  on cms_content_revisions
  for all
  using (false)
  with check (false);
