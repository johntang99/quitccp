-- Admin user profiles, for the user-management screens.
--
-- Authentication moved to Supabase Auth in Phase 1; this table stays the record
-- of *authorisation* -- who someone is to this CMS, not how they prove it. So it
-- gains the fields the admin UI needs, and gives up the ones Supabase now owns.

-- Shown in the user list and the audit trail, so an editor is a person rather
-- than an email address. Nullable: existing rows predate it.
alter table cms_admin_users add column if not exists name text;

-- Who created the account, kept as text to match cms_audit_logs.actor_email --
-- deliberately not a foreign key, so deleting an account never rewrites history.
alter table cms_admin_users add column if not exists created_by text;

-- Passwords now live in Supabase Auth. Accounts created from the admin UI will
-- never have a PBKDF2 hash, so these can no longer be required. Existing values
-- stay put: they still serve the legacy sign-in fallback until every account has
-- moved, after which both columns can be dropped.
alter table cms_admin_users alter column password_hash drop not null;
alter table cms_admin_users alter column password_salt drop not null;

-- The list screen sorts by name, then email.
create index if not exists idx_cms_admin_users_name on cms_admin_users(name);
