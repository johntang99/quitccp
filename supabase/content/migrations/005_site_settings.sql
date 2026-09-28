create table if not exists cms_site_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  value_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_cms_site_settings_key on cms_site_settings(setting_key);

alter table cms_site_settings enable row level security;
drop policy if exists cms_site_settings_no_access on cms_site_settings;
create policy cms_site_settings_no_access
  on cms_site_settings
  for all
  using (false)
  with check (false);
