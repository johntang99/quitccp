-- Placeholder RLS baseline; adapt to your auth provider claims mapping.
alter table declarations enable row level security;
alter table certificates enable row level security;
alter table verification_queries enable row level security;
alter table service_audit_logs enable row level security;

create policy declarations_read_for_authenticated
  on declarations
  for select
  using (true);

create policy declarations_write_for_service_admin_editor
  on declarations
  for insert
  with check (true);

create policy certificates_read_for_authenticated
  on certificates
  for select
  using (true);

create policy certificates_write_for_service_admin_editor
  on certificates
  for insert
  with check (true);

create policy verification_queries_insert_for_authenticated
  on verification_queries
  for insert
  with check (true);

create policy service_audit_insert_for_system
  on service_audit_logs
  for insert
  with check (true);
