create table if not exists service_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null check (role in ('service_admin','service_editor','service_viewer')),
  mfa_secret text,
  mfa_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists declarations (
  id uuid primary key default gen_random_uuid(),
  alias text not null,
  organization_scopes text[] not null,
  statement text not null,
  risk_level text not null default 'high',
  created_at timestamptz not null default now()
);

create table if not exists certificates (
  id uuid primary key default gen_random_uuid(),
  declaration_id uuid not null references declarations(id) on delete cascade,
  serial_number text not null unique,
  status text not null check (status in ('pending','issued','revoked')),
  issued_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists verification_queries (
  id uuid primary key default gen_random_uuid(),
  certificate_serial text not null,
  query_origin text,
  created_at timestamptz not null default now()
);

create table if not exists service_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_email text not null,
  action text not null,
  target_type text not null,
  target_id text not null,
  access_mode text not null check (access_mode in ('read','write')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_service_audit_created on service_audit_logs(created_at desc);
