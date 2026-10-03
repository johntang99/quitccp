# User management — implementation plan

Super admin adds users; admins add editors; everyone changes their own password; a
forgotten password is recovered by email. Roles decide who may touch what.

Status: **Phases 1–5 done (2026-10-03); Phase 5 needs SMTP configured before the emails leave the building. Phase 6 on the owner's timing.**

---

## 1. What already exists

More than you might expect — the foundation is sound.

| | state |
|---|---|
| `cms_admin_users` table | exists: email, role, password hash + salt, MFA fields, active flag, lockout counters, last login |
| password hashing | **good** — PBKDF2-SHA512, 210,000 iterations, per-user salt, timing-safe compare |
| login, lockout | exists — 5 failures locks the account for 15 minutes |
| MFA | TOTP, with `generateTotpSecret()` and `verifyTotpCode()` already written |
| audit log | `cms_audit_logs` + a `createAudit()` helper used across the admin |
| roles in code | `super_admin` · `content_admin` · `editor` · `reviewer` · `viewer` |

What does **not** exist: any UI or API for managing users, a `name` column, password
self-service, password reset, and any means of sending email.

---

## 2. Three collisions with the current system

### 2.1 The MFA fallback is a trap, armed but not yet sprung

`app/api/admin/auth/login/route.ts`:

```ts
const secret = user.mfaSecret || process.env.SEED_ADMIN_MFA_SECRET;
```

Every row defaults to `mfa_enabled = true` with `mfa_secret = null`. So in production a
newly created editor has **no secret of their own and falls back to the seed admin's**.
Two consequences, both bad:

- the only way to let a new editor in is to hand them the super admin's TOTP secret;
- equivalently, one shared secret satisfies MFA for **every** account.

**Verified 2026-10-03: MFA is currently off in both environments**, so none of this is
running today. `MFA_REQUIRED=false` locally, and a single real login against production
reached `/admin/dashboard` without a code, which proves it is set there too.
`requireAdminMfa()` returns immediately when MFA is off, so the 60 routes that call it are
unaffected.

That makes the owner's instruction — *do not activate MFA yet* — safe to follow. But note
the shape of the trap: the seed admin's row has `mfa_enabled = true` with
`mfa_secret = NULL`. **The day someone sets `MFA_REQUIRED=true` on the current code, one
of two things happens and neither is acceptable:** either every account authenticates
against a single shared secret, or — if `SEED_ADMIN_MFA_SECRET` is unset, as it is
locally — nobody can log in at all.

So this is not urgent, but it is a precondition. Moving to Supabase Auth deletes the custom
TOTP path entirely and gives each user their own factor, which closes it by construction
rather than by remembering.

### 2.2 Editors can currently change the theme

Writes are gated by `adminCanWrite()`, which returns true for `super_admin`,
`content_admin` **and `editor`**. The theme routes use it, so today an editor can repaint
the site. Your rule C says they must not. Needs a separate capability, not a reuse of the
write flag.

### 2.3 "admin" is called `content_admin` in the database

Your three roles map to `super_admin` / `content_admin` / `editor`. The schema also allows
`reviewer` and `viewer`, which nothing creates and which only two permission checks
mention. Leaving dead roles in a permissions model is how privilege bugs happen, so the
plan hides them from the UI and documents them as unused rather than pretending they are
part of the ladder.

---

## 3. Questions your spec leaves open

These are the rules that decide whether the model is safe. My recommendations, for
confirmation:

| question | recommendation |
|---|---|
| Can an admin edit or deactivate a **super admin**? | **No.** Otherwise "admin" is super admin with extra steps. |
| Can an admin edit another **admin**? | **No** — only super admin manages admins. Admins manage editors only. |
| Can anyone change **their own role**? | **No**, including super admin, to avoid locking out the last one. |
| Can the **last super admin** be deleted or demoted? | **No** — refuse with a clear message. |
| Can an admin **reset an editor's password** directly? | **Yes**, but it is effectively taking over that account, so it is audited and the editor is emailed. |
| Can an editor see the **三退声明** queue? | **Yes — decided by the owner, 2026-10-03.** I had recommended keeping it super-admin-only because those are submissions from people inside mainland China; the decision is to let editors work the queue. Every read already writes an audit row (`access_mode: "read"`), so who looked at what stays answerable. |
| Delete, or deactivate? | **Deactivate** by default (`is_active = false`); real deletion only for super admin. Audit rows reference users. |

---

## 4. The permission model

One module, `lib/admin/permissions.ts`, exporting named capabilities. Routes ask
`can(user, "theme.write")` instead of re-deriving rules — so the matrix below is the only
place the answer lives.

| capability | super_admin | content_admin (管理员) | editor (编辑) |
|---|---|---|---|
| content: articles, videos, materials, pages, media | ✅ | ✅ | ✅ |
| categories | ✅ | ✅ | ✅ |
| theme / 主题与排版 | ✅ | ✅ | ❌ |
| site settings | ✅ | ✅ | ❌ |
| 立即发布 (revalidate) | ✅ | ✅ | ✅ |
| 三退声明 | ✅ | ✅ | ✅ |
| audit log, revisions | ✅ | ✅ | ❌ |
| **add / edit editors** | ✅ | ✅ | ❌ |
| **add / edit admins** | ✅ | ❌ | ❌ |
| **edit super admins** | ✅ | ❌ | ❌ |
| change own password | ✅ | ✅ | ✅ |

---

## 4b. Build it, or hand it to Supabase Auth?

Supabase Auth already does users, password reset email, and TOTP MFA. The question is
whether swapping to it costs less than finishing the custom implementation.

### How contained the swap would be

Much more than it looks:

| | |
|---|---|
| files touching the session cookie / token | **3** — `lib/admin/auth.ts`, the login route, the logout route |
| files calling `getAdminSessionUser()` / `requireAdminSessionUser()` | **67** — all *consumers* of the abstraction |
| middleware | untouched — it only serves the legacy WordPress 301s, narrow matcher |
| audit history | survives — `cms_audit_logs.actor_email` is text, not a foreign key |

So the swap is: reimplement the inside of `auth.ts` to read a Supabase session instead of
our signed cookie, keep the `AdminUser` shape it returns, and rewrite login/logout. The 67
callers do not change. The abstraction is already in the right place.

### What Supabase Auth gives us

- **Password reset by email, with the templates already in the dashboard** — removes the
  need to build a `cms_password_resets` table, token hashing, expiry, single-use handling
  and rate limiting.
- **Per-user TOTP MFA with a real enrolment API** — removes the need to build the QR
  enrolment screen, and closes §2.1 by construction rather than by our own care.
- A maintained implementation of the parts that are dangerous to get subtly wrong.

### What it does *not* give us, and we still own

- **Roles.** Supabase Auth has no role model. They live in `app_metadata` or a profile
  table keyed by the auth user id. The permission matrix in §4 is ours either way.
- **The admin UI.** Supabase's dashboard can manage users, but an *admin* adding an
  *editor* has to happen inside our CMS, so `/admin/users` is built regardless.
- **Production email.** Supabase's own warning: *"You're using the built-in email service.
  This service has rate limits and is not meant to be used for production apps."* So an
  SMTP provider is still required — the difference is that it is configured in Supabase's
  SMTP settings rather than called from our code.

### Recommendation

**Use Supabase Auth.** It replaces the two riskiest pieces of custom security code —
MFA enrolment and password-reset tokens — with implementations someone else maintains, and
the migration is contained to three files because the abstraction already exists.

The cost is honest: more work before anything visible appears, and a botched migration
locks everyone out of the admin. Mitigation: build the new path alongside the old one, keep
the existing login working until the new one is proven, migrate the single existing user
last, and verify sign-in works before deleting anything.

---

## 5. Work, in order

MFA stays **off** throughout; it is Phase 6, on the owner's timing.

### Phase 1 — move authentication to Supabase Auth ✅

Done. Authentication is Supabase's; **authorisation is still `cms_admin_users`**, matched
on email — so roles, `is_active` and the audit trail were not disturbed.

- `lib/supabase/auth-client.ts` — cookie-backed client (`@supabase/ssr`), separate from the
  service-role client. Cookie writes are wrapped: Next 15 forbids them in Server
  Components, and a refresh that cannot be persisted is not an error.
- `getAdminSessionUser()` **reads both sessions** — Supabase first, then the legacy signed
  cookie. No flag day: anyone already signed in keeps working, new sign-ins get Supabase.
  The legacy branch comes out once every account has moved.
- Login tries `signInWithPassword` first and falls back to the PBKDF2 hash, so an
  unmigrated account still works. On a Supabase sign-in the legacy cookie is deliberately
  **not** minted — two sessions would be two things to reason about.
- Logout clears both.
- `scripts/migrate-admin-to-supabase-auth.ts` creates the credential half. Passwords cannot
  be carried across (PBKDF2 is one-way), so the seeded super admin keeps its known password
  from the environment and any other account gets a random one and must use 忘记密码 —
  the script prints which is which.
- The 67 callers of `getAdminSessionUser()` were not touched.

**Verified, not assumed:**

| | |
|---|---|
| sign-in sets a Supabase cookie, no legacy cookie | ✅ |
| wrong password rejected | ✅ `?error=1` |
| writes work on a Supabase-only session | ✅ `revalidate` returned 200 |
| logout clears both cookie families | ✅ |
| signed-out access to `/admin/*` redirects | ✅ |
| a second account (role `editor`) resolves as editor | ✅ via a throwaway account, since removed |
| `is_active = false` refuses both login and pages | ✅ |
| public site unchanged | ✅ 27 page/width combinations, max 0.00% moved |

Confirmed while testing: an editor can currently still reach 主题与排版 and 站点设置.
That is the gap Phase 3 closes, now measured rather than inferred.

### Phase 2 — schema ✅

`018_admin_user_profile.sql`. A new profile table was considered and rejected:
`cms_admin_users` already holds role and `is_active`, already backs the audit trail, and
Phase 1 proved the email join works. A second table would have meant migrating both.

The migration adds `name` and `created_by`, and **drops NOT NULL from `password_hash` /
`password_salt`** — accounts created from the admin UI will never have a PBKDF2 hash,
because Supabase owns passwords now. Existing values stay, serving the legacy sign-in
fallback until every account has moved; both columns can be dropped after that.

### Phase 3 — the permission module ✅

`lib/admin/permissions.ts` holds the matrix; routes and pages ask `can(user, "theme.write")`
rather than re-deriving from `user.role`.

- theme, settings and revalidate moved off `adminCanWrite` onto named capabilities
- the 主题 · 站点设置 · 审计日志 · 修订历史 **pages** refuse directly, not just their APIs
- the sidebar hides what the signed-in user cannot open
- `reviewer` and `viewer` are absent from the matrix, so a row holding one is refused
  everything rather than silently inheriting an editor's reach

**Verified with a real account for every role** — three throwaway accounts, created,
tested and deleted:

| | super_admin | content_admin | editor |
|---|---|---|---|
| content pages | open | open | open |
| 三退声明 | open | open | open |
| 主题与排版 | open | open | **DENIED** |
| 站点设置 | open | open | **DENIED** |
| 审计日志 | open | open | **DENIED** |
| 修订历史 | open | open | **DENIED** |
| `POST` theme API | 200 | 200 | **403** |
| sidebar entries | 12 | 12 | **8** |

And the rule that decides who may create whom, checked directly against the module:

| actor → target | 超级管理员 | 管理员 | 编辑 |
|---|---|---|---|
| **超级管理员** | yes | **yes** | yes |
| **管理员** | no | **no** | yes |
| **编辑** | no | no | no |

So the 角色 dropdown offers 超级管理员 · 管理员 · 编辑 to a super admin, **编辑 only** to an
admin, and nothing to an editor — which is Phase 4's form behaviour, settled before the
form exists. An editor cannot open `/admin/users` at all. A row holding the legacy
`viewer` role is refused even `content.write`.

The page-level gates were added *because* the first test run found 审计日志 reachable by
typing the URL while the sidebar hid it — hiding a link is courtesy, not a gate.

### Phase 4 — user management UI ✅

`/admin/users`, with `lib/admin/user-admin-repository.ts` keeping the two stores in step.
There is no shared id between Supabase Auth and `cms_admin_users` — they join on email — so
every write considers both, and **the Supabase identity is created first**: if it fails the
role row was never written, instead of leaving an account that appears in the list and
cannot sign in. If the role row then fails, the identity is rolled back.

**Verified against a live admin account, every path tried through the API, not just the UI:**

| attempt (as 管理员) | result |
|---|---|
| create an 编辑 | **allowed** |
| deactivate an 编辑 | **allowed** |
| promote an 编辑 → 管理员 | 你没有权限授予这个角色。 |
| promote self → 超级管理员 | 你没有权限修改这个账号。 |
| deactivate the 超级管理员 | 你没有权限修改这个账号。 |
| reset the 超级管理员's password | 你没有权限修改这个账号。 |
| create another 管理员 | 你没有权限创建这个角色。 |

Also checked: a 7-character password is refused **by the server** (tested with the client's
`minLength` stripped), the 角色 dropdown offers 编辑 only to an admin, and every action
writes an audit row carrying before → after on role changes — with **no password in any of
them**.

#### A bug this testing found

The "last super admin" guards compared the *count* of active super admins without checking
whether the **target** was active. With one active super admin and one deactivated one, the
deactivated account could not be demoted or deleted — the count was about a different
person. Fixed by requiring `target.isActive`, and confirmed: demoting a deactivated super
admin while another is active is now allowed.

Worth recording that the guard is otherwise **unreachable**, and deliberately so: only a
super admin may modify a super admin, so if exactly one is active, that one is the actor
and the self-check refuses first. It is a second layer, not the operative one.

### Phase 5 — passwords: self-service and forgotten ✅ *(code done; SMTP still to configure)*

`/admin/account` — every role has it; changing your own password is not a privilege. The
**current password is re-checked** even though the caller is signed in: a session cookie
proves someone signed in once, not that the person at the keyboard owns the account.
Without that, an unattended logged-in browser is a permanent takeover. On success,
`signOut({ scope: "others" })` drops every other session, because if the old password
leaked, changing it has to end what it opened.

Verified:

| | |
|---|---|
| wrong current password | 当前密码不正确。 |
| mismatched confirmation | 两次输入的新密码不一致。 |
| 5-character new password | 密码至少 8 位。 (server-side, with the client's `minLength` stripped) |
| new password same as current | 新密码不能和当前密码相同。 |
| a valid change | saved; **old password then rejected, new one works** |

`/admin/forgot` → emailed link → `/api/admin/auth/callback` → `/admin/reset`. The response
is identical for a real and an invented address, so the form cannot be used to find out who
works here. Supabase owns the token — single-use, short-lived, never stored by us — which
is why this codebase has no reset-token table.

#### The callback takes token_hash, not code

First implementation used `exchangeCodeForSession`, and testing the real flow showed why
that is wrong here: PKCE keeps its verifier in a **cookie in the browser that asked**, and
people read mail in a mail app. Supabase's documented server-side pattern is
`verifyOtp({ type, token_hash })`, which survives the link being opened anywhere. The route
now prefers that and keeps `code` as a same-browser fallback.

**This requires the email template to be edited** — see the setup steps below. Until it is,
Supabase sends its default link and only the fallback applies, so a reset opened in a
different browser will fail.

Verified end to end by generating a real recovery token through the admin API: link →
reset form → saved → dashboard, with the old password rejected and the new one working.

#### Setting up SMTP — what is still to do

Supabase's own warning: *"You're using the built-in email service. This service has rate
limits and is not meant to be used for production apps."* It sends a few messages an hour,
which is fine for a test and not for real use.

1. **Resend** → add and verify the sending domain (DNS records: SPF, DKIM). Unverified mail
   goes to spam. Create an SMTP credential.
2. **Supabase → Authentication → Emails → SMTP Settings** → enable custom SMTP:
   host `smtp.resend.com`, port `465`, user `resend`, password = the API key, sender address
   on the verified domain.
3. **Supabase → Authentication → Emails → Templates → Reset password** — replace the link
   with:

   The body is kept in the repo at
   **`docs/implementation/email-templates/reset-password.html`** — select all, paste into
   the Source tab, set the subject to `重设你的管理后台密码 · 全球退党服务中心`, press
   **Save changes**. That file holds the body and nothing else, so copying all of it is
   always right; the instructions live in `email-templates/README.md` beside it, because a
   comment inside the template is a comment inside the email.

   The link inside it is:

   ```html
   <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">设置新密码</a>
   ```

   It is written for mail clients rather than browsers: tables instead of flex, inline
   styles only, no web fonts and no background images, because Outlook drops most modern
   CSS. The button is a padded table cell, and the raw URL is repeated underneath for
   anyone whose client strips buttons.

   **`.RedirectTo`, not `.SiteURL`.** `.SiteURL` is one fixed address, so every reset link
   would point at production even when the request came from localhost. `.RedirectTo` is
   the `redirectTo` the app passed, so the link comes back to wherever the request started.
   `/api/admin/auth/forgot` deliberately passes it **without a query string**, so the
   template can append `?token_hash=…` without having to guess between `?` and `&`.

   Without this edit the token_hash path never runs, and a link opened in a mail app fails.
4. **Supabase → Authentication → URL Configuration**
   - Site URL: `https://quitccp.vercel.app` (no wildcards permitted; it is the fallback)
   - Redirect URLs: `https://quitccp.vercel.app/**` **and `http://localhost:4020/**`** —
     without the second one, a reset requested from a local dev server is sent to production
     instead, because Supabase ignores a `redirectTo` that is not on the allow list.
5. **Authentication → Sign In / Providers → turn OFF "Allow new users to sign up".**

   Verified 2026-10-03: it is currently **on**, and the anon key is public by design, so
   anyone can create a row in `auth.users`. They cannot reach the CMS — authorisation comes
   from `cms_admin_users`, and a login with no row there is refused (tested: refused at the
   login form, and refused again at `/admin/dashboard`). So this is untidiness, not a
   breach. It still wants closing: those sign-ups send confirmation emails, and the email
   rate limit is **shared across the whole project**, so enough of them would exhaust the
   budget that password resets depend on.
6. **Rate limits** — the defaults are right for a staff CMS of this size and need no change:

   | | default | verdict |
   |---|---|---|
   | sending emails | 30/h | ample for resets among a handful of staff |
   | sign-ups and sign-ins | 30 per 5 min per IP | fine — the app *also* locks an account for 15 minutes after 5 failures |
   | token verifications | 30 per 5 min per IP | covers the reset-link step |
   | token refreshes | 150 per 5 min per IP | untouched |

   The per-account lockout in `cms_admin_users` is the real brute-force defence; these are
   the per-IP ceiling above it.

### Phase 6 — turn MFA on, whenever you decide
Not part of this work. When the time comes: enrolment is per-user through Supabase, and
the switch should refuse to flip while any active user still lacks a factor — otherwise
turning it on locks those people out. That pre-flight check is the whole reason this is a
separate phase rather than a config change.

---

## 6. Guardrails

- Every user-management action writes an audit row: actor, target, before → after.
- A password is never returned, logged, or shown — only set.
- Role changes and deactivations take effect on the next request: sessions carry the role
  in a signed token, and `getAdminSessionUser()` already re-reads the row and rejects the
  session if the role has changed since.
- The `/api/admin/users` routes require MFA, like every other write route.
- Rate-limit the forgot-password form.
