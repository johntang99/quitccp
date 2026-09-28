-- Public (anonymous) declaration intake.
--
-- Context: /api/service/* is a staff API guarded by a service-user bearer token
-- plus MFA. Members of the public have no such account, so anonymous submissions
-- need their own columns and their own audit actor. This migration is additive
-- only; it does not alter or drop anything that already exists.

-- ---------------------------------------------------------------------------
-- declarations
-- ---------------------------------------------------------------------------

-- Region is optional by design: the intake form asks only for province/country
-- and the page copy promises it can be left blank.
alter table declarations add column if not exists region text;

-- Whether the submitter asked for a 退党证明 at intake time. A certificate row
-- is only created once staff issue it, so this is a request flag, not a status.
alter table declarations add column if not exists wants_certificate boolean not null default false;

-- 'public' rows arrive unauthenticated and are held for review before they are
-- displayed anywhere. 'staff' preserves the behaviour of existing service-API
-- writes, which are already trusted at the point of insert.
alter table declarations add column if not exists source text not null default 'staff';

alter table declarations add column if not exists status text not null default 'published';

-- Public-facing declaration number (the "No. 464,375,381" on the site). Assigned
-- at insert so the submitter gets a receipt they can quote back to us.
--
-- NOTE: the start value below continues from the number currently displayed on
-- the homepage. Confirm the true high-water mark against the legacy registry
-- before this runs in production -- restarting it low would issue duplicates.
create sequence if not exists declaration_sequence start with 464375382;

alter table declarations add column if not exists sequence_number bigint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'declarations_status_check'
  ) then
    alter table declarations
      add constraint declarations_status_check
      check (status in ('pending_review', 'published', 'rejected'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'declarations_source_check'
  ) then
    alter table declarations
      add constraint declarations_source_check
      check (source in ('public', 'staff', 'legacy'));
  end if;
end $$;

-- PostgREST cannot call nextval() directly, so the intake path goes through
-- this wrapper. security definer keeps the sequence itself ungranted.
create or replace function next_declaration_sequence()
returns bigint
language sql
security definer
set search_path = public
as $$
  select nextval('declaration_sequence');
$$;

create unique index if not exists idx_declarations_sequence
  on declarations(sequence_number)
  where sequence_number is not null;

create index if not exists idx_declarations_status_created
  on declarations(status, created_at desc);

-- ---------------------------------------------------------------------------
-- certificates
-- ---------------------------------------------------------------------------

-- The public verify form cross-checks the serial against the name printed on
-- the certificate, so the name has to live with the certificate rather than
-- being read back off the declaration (which stays private).
alter table certificates add column if not exists holder_name text;

-- ---------------------------------------------------------------------------
-- verification_queries
-- ---------------------------------------------------------------------------

-- Table already exists but nothing wrote to it. Record the outcome so repeated
-- misses against the same serial are visible as a probing pattern.
alter table verification_queries add column if not exists result text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'verification_queries_result_check'
  ) then
    alter table verification_queries
      add constraint verification_queries_result_check
      check (result is null or result in ('valid', 'not_found', 'revoked', 'name_mismatch'));
  end if;
end $$;

create index if not exists idx_verification_queries_serial_created
  on verification_queries(certificate_serial, created_at desc);

-- query_origin deliberately stores a salted hash, never a raw IP address. Many
-- submitters are inside mainland China; a raw address in this table would be
-- the single most dangerous column in the system.
comment on column verification_queries.query_origin is
  'Salted hash of the requester origin. Never store a raw IP address here.';
