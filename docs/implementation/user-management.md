# 用户管理

The staff-facing manual lives **in the admin**, not here: `/admin/users/guide`, linked
from 用户管理. This file is the developer's note on how that system is put together and
where to change it.

Why the manual is a page and not a markdown file: the Vercel project's root directory is
`apps/web`, so nothing outside it exists at runtime — a document in `docs/` could never be
opened from the screen it describes. Coworkers read what is one click away.

## Where the rules live

`apps/web/src/lib/admin/permissions.ts` is the single source of truth. One table,
`MATRIX`, maps a capability to the roles that hold it; every route and page asks `can()`
rather than testing `user.role` itself.

Three roles are in use — `super_admin`, `content_admin` (管理员), `editor`. The
`cms_admin_users` table also permits `reviewer` and `viewer`; they are legacy values,
deliberately absent from `ROLE_ORDER` and `MATRIX`, so a row holding one is refused
everything rather than inheriting an editor's reach.

### The owner

`OWNER_EMAIL` (default `admin@quitccp.org`, override with `ADMIN_OWNER_EMAIL`) is not a
fourth role. It is one specific super admin account, and the only one that may act on
another super admin's account — rename, change role, deactivate, reset password, delete.

The restriction covers *every* mutation rather than deletion alone, through
`canModifyAccountOfRole()`. Restricting deletion by itself would have been decorative: a
super admin could demote a peer to editor and delete them a second later.

Two functions, easy to confuse:

- `canManageRole(actor, role)` — may this actor *hand out* this role? Used when creating
  an account and when granting a new role.
- `canModifyAccountOfRole(actor, role)` — may this actor act on an *existing* account
  holding this role? Stricter: super admins are peers, and a peer may not touch a peer.

Guards that bind everyone, including the owner, live in the route
(`apps/web/src/app/api/admin/users/route.ts`): nobody deletes their own account, nobody
changes their own role or deactivates themselves, and the last active super admin cannot
be demoted, deactivated or deleted.

## The permission tables are generated

`apps/web/src/lib/admin/permission-matrix.ts` builds both tables shown in 用户管理 and in
the guide by *calling* `can()` / `canManageRole()` / `canModifyAccountOfRole()` for each
principal. Nothing is typed out by hand.

This matters more than it looks. A hand-maintained matrix is wrong the first time somebody
changes a rule and forgets the documentation, and a table that disagrees with the code is
worse than no table — people plan around it. Add a capability to `MATRIX` and give it a
row in `ACTION_ROWS`; the tables update themselves.

`ADMIN_NAV_LINKS` lives in the same module and is what `AdminNav` renders, so a page
hidden from someone in the sidebar is also a page the table marks 拒绝 for them.

## Authentication vs authorisation

Supabase Auth owns credentials. `cms_admin_users` owns roles. They are joined on email —
there is no shared id — so `user-admin-repository.ts` keeps both in step, and the order
matters: `createAdminUser()` makes the Supabase identity *first* and rolls it back if the
role row fails, because the reverse leaves an account that appears in the list and cannot
sign in.

Passwords are never readable. 重设密码 replaces; nothing reveals. Changing your own
password requires the current one even though you are already signed in — a session cookie
proves somebody signed in once, not who is at the keyboard now — and drops every other
session (`signOut({ scope: "others" })`).

MFA is implemented but not enforced: `requireAdminMfa` passes through while
`MFA_REQUIRED` is off. The owner's decision, to be revisited.

## Auditing

Every mutation in 用户管理 writes a `cms_audit_logs` row through `recordAdminAudit()`:
who, when, to whom, what changed. Passwords are never written to it. 三退声明 reads are
audited too, which is what made it safe to let editors work that queue.

## Related

- `docs/implementation/email-templates/README.md` — the password-reset email and the
  Supabase settings it needs.
- Migration `018_admin_user_profile.sql` — `name`, `created_by`, and dropping the
  now-unused password columns' NOT NULL.
