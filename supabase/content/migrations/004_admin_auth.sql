create table if not exists cms_admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null check (role in ('super_admin','content_admin','editor','reviewer','viewer')),
  password_hash text not null,
  password_salt text not null,
  mfa_enabled boolean not null default true,
  mfa_secret text,
  is_active boolean not null default true,
  failed_login_attempts integer not null default 0 check (failed_login_attempts >= 0),
  locked_until timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cms_admin_users_email on cms_admin_users(email);
create index if not exists idx_cms_admin_users_role on cms_admin_users(role);

alter table cms_admin_users enable row level security;
drop policy if exists cms_admin_users_no_access on cms_admin_users;
create policy cms_admin_users_no_access
  on cms_admin_users
  for all
  using (false)
  with check (false);
