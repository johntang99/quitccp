alter table service_users enable row level security;
drop policy if exists service_users_no_access on service_users;
create policy service_users_no_access
  on service_users
  for all
  using (false)
  with check (false);
