# Email templates

Supabase sends these; the dashboard is the only place they run, so they are kept here as
well — a template that lives only in a dashboard is a change nobody can review and nobody
can restore after someone edits it.

**Each `.html` file contains only the body that gets pasted.** No wrapper, no instruction
comment: select all, copy, paste into the Source tab. Anything a maintainer needs to know
belongs in this file instead, because a comment inside the template is a comment inside
the email.

## reset-password.html

| | |
|---|---|
| where | Supabase → Authentication → Emails → Templates → **Reset password** |
| subject | `重设你的管理后台密码 · 全球退党服务中心` |
| body | paste `reset-password.html` whole into **Source** |

Then press **Save changes** — the editor does not save on its own.

### The link

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">设置新密码</a>
```

`{{ .RedirectTo }}`, **not** `{{ .SiteURL }}`. SiteURL is one fixed address, so every reset
link would point at production even when the request came from a local dev server.
RedirectTo carries what the app passed, so the link returns to wherever the request
started — which is why `http://localhost:4020/**` has to be in the Redirect URLs allow
list for local testing to work.

`/api/admin/auth/forgot` passes `redirectTo` with **no query string**, so the template can
append `?token_hash=…` without having to choose between `?` and `&`.

### Why the markup looks dated

Written for mail clients, not browsers: tables rather than flex, inline styles only, no web
fonts, no background images. Outlook drops most modern CSS, so the button is a padded table
cell rather than a styled `<a>`, and the raw URL is repeated beneath it for clients that
strip buttons entirely.

### Caveat

The template needs `{{ .RedirectTo }}` to be populated, which happens when the app passes
it — the 忘记密码 form always does. A reset triggered from the **Supabase dashboard**
("Send password recovery" on a user row) passes nothing, so that link would be malformed.
Use the app's own form; it also writes the audit row.
