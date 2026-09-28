# Public Service Intake

Covers the anonymous submission and verification path added for `/services/declare`
and `/services/verify`.

## Why this is separate from `/api/service/*`

`/api/service/*` is a **staff** API. Every route there requires a service-user
bearer token, an MFA-passed claim, and a write role, and it audits under the
staff member's email. A member of the public has none of those, so the existing
routes could never have served the public forms — before this change the forms
were static markup and nothing ever reached the service APIs.

The public path is therefore its own surface:

| | staff | public |
|---|---|---|
| routes | `/api/service/*` | `/api/public/*` |
| auth | bearer token + MFA + role | none, by design |
| repository | `lib/service/repository.ts` | `lib/service/public-intake.ts` |
| audit actor | staff email | `public:anonymous` |

`public-intake.ts` is deliberately narrow: it can create a declaration and
confirm a certificate serial. It has no read path that returns statement text,
aliases, or regions.

## Privacy constraints

Submitters may be inside mainland China, so the intake path is built to hold as
little as possible about who they are:

- **No raw IP is stored or logged anywhere.** The address is reduced to a
  salted, truncated hash (`clientFingerprint`) used only for rate limiting. Set
  `INTAKE_HASH_SALT` in production; without it a per-process random salt is used,
  which makes the hash useless across restarts.
- The fingerprint is written to the **audit detail**, never onto the declaration
  row, so a declaration carries nothing linking it to a network origin.
- **No CAPTCHA and no third-party scripts.** Every extra origin is another thing
  that can be blocked by the GFW or used to observe the submitter. Abuse control
  is a rate limit plus a honeypot and a dwell-time check instead.
- Verification returns only what the page promises a receiving institution will
  see: whether we issued the serial, when, and its status. An issue date is
  returned **only** on a confirmed match, so the endpoint cannot be used as an
  oracle to enumerate valid serials.
- Public submissions land as `status = 'pending_review'`. The public site reads
  only `published` rows, so nothing a stranger submits is displayed until a
  human has looked at it.

## Rate limiting

`lib/security/rate-limit.ts` is a fixed-window limiter **held in process
memory**.

> **Limitation:** the window is per Node instance, so N instances allow N x the
> limit. This is adequate for a single deployment and stops one client hammering
> the endpoints. Move it to a shared store before scaling out.

Current limits: declarations 5 per 10 min, verification 20 per 5 min.

## Migration

`supabase/service/migrations/005_public_declaration_intake.sql` — **applied to
the development project on 2026-09-27**, still to run in production.

There is no database connection string in the repo; migrations here are run by
hand in the Supabase SQL editor, so this one must be run the same way in each
environment. Until it is, both public endpoints return 500.

It is additive only (no drops, no alters of existing columns):

- `declarations`: adds `region`, `wants_certificate`, `source`, `status`,
  `sequence_number`, plus status/source check constraints and indexes.
- `certificates`: adds `holder_name`, which the verify form cross-checks against.
- `verification_queries`: adds `result` and an index. The table already existed
  but nothing wrote to it; the public verify path now does.
- Adds `declaration_sequence` and the `next_declaration_sequence()` RPC
  (PostgREST cannot call `nextval()` directly).

> **Confirm before running in production:** `declaration_sequence` starts at
> `464375382`, continuing from the number currently shown on the homepage. Check
> this against the true high-water mark in the legacy registry first — starting
> it too low would issue duplicate declaration numbers. (In the development
> project the counter has already advanced past that start value through
> testing; sequences do not roll back.)

## Staff queue (`/admin/declarations`)

The other half of the loop. Public submissions land as `pending_review` and are
processed here.

**Access is `super_admin` only** (`canAccessDeclarations`). Declarations are
service-domain data, not content, so the content roles — editor, reviewer,
viewer — cannot reach the queue or its APIs. This is deliberately the narrowest
default: widening it is a one-line change, a leak is not recoverable. The
longer-term answer is a dedicated service-operator admin role rather than
reusing the content role ladder.

Operations, all in `lib/admin/declarations-repository.ts`:

| action | effect |
|---|---|
| 通过并公开 | `pending_review` → `published`; the public site can display it |
| 拒绝 | → `rejected`; can never receive a certificate |
| 退回待审 | → `pending_review` |
| 签发证明 | issues a certificate with a generated `TD-<year>-<7 digits>` serial |
| 作废 | revokes a certificate; public verify immediately reports `revoked` |

Guard rails enforced server-side, not just in the UI:

- A certificate can only be issued for a `published` declaration. Rejected is an
  outright no, and `pending_review` means nobody has read the statement yet —
  certifying unvetted text is the failure mode this queue exists to prevent.
- A declaration cannot hold two active certificates; the existing one must be
  revoked first.
- The serial's random tail means one serial cannot be guessed from a
  neighbouring one.

Statement text is collapsed behind a `<details>` toggle so a page of the queue
cannot leak many statements at once to a passing screen or a screenshot.

**Audit.** Everything writes to `service_audit_logs`, never `cms_audit_logs`,
keeping the two domains' trails independent as the architecture note requires.
Reads are audited too — listing the queue records the filters and the number of
records returned, but never the statements themselves, which would copy the
sensitive payload into a second table.

> **KNOWN LIMITATION:** `declarations.status` conflates "vetted" with "displayed
> publicly". Someone who wants a certificate but not public display has no
> representable state. Splitting these into two columns is the real fix.

## Still not wired

These remain static markup and still need the same treatment:

- `/services/cert` — certificate application
- `/services/contact` — information change / contact
- `/involve/volunteer` — volunteer sign-up

The public site also does not yet render `published` declarations anywhere — the
homepage "Latest Updates" cards are still hardcoded seed content.
