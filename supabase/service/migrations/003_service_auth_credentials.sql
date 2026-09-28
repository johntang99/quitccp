alter table service_users
  add column if not exists password_hash text,
  add column if not exists password_salt text,
  add column if not exists is_active boolean not null default true,
  add column if not exists failed_login_attempts integer not null default 0,
  add column if not exists locked_until timestamptz,
  add column if not exists last_login_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'service_users_failed_login_attempts_nonnegative'
  ) then
    alter table service_users
      add constraint service_users_failed_login_attempts_nonnegative
      check (failed_login_attempts >= 0);
  end if;
end
$$;
