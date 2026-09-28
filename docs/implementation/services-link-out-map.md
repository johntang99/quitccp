# Services: Link-Out Map

Decision (2026-09-28): the new site does **not** implement service transactions.
It links to the existing production services instead.

## The existing services live on three different hosts

This is the thing that shapes everything else — "the existing site" is not one
site:

| host | what lives there | stack |
|---|---|---|
| `santui.tuidang.org` | 三退声明 submission + the public declaration archive + the running counter | custom PHP app, old visual style |
| `service.tuidang.org` | 退党证明 application and verification | WordPress + form plugin |
| `www.tuidang.org` | marketing/hub pages, FAQ (`/docs/<id>/`), contact, donation | WordPress |

A fourth channel exists for certificates: Ganjing World
(`ganjingworld.com/lifestyle/tuidang`), offered alongside 本网办理.

## Mapping table

"Action" = the user is handed off to an external system. "Content" = the page
stays local and only its inline links point outward.

| # | Local route | Local title | Treatment | Target |
|---|---|---|---|---|
| 1 | `/services` | 服务总览 | Content — keep as hub | links to rows below |
| 2 | `/services/declare` | 声明三退 | **Action → replace form with CTA** | `https://santui.tuidang.org` |
| 3 | `/services/cert` | 退党证书 | **Action → replace form with CTA** | `https://service.tuidang.org/cert-apply/` (primary)<br>`https://www.ganjingworld.com/lifestyle/tuidang` (alternate) |
| 4 | `/services/verify` | 查询验证 | **Action → replace form with CTA** | `https://service.tuidang.org/cert-verify/`<br>EN: `.../cert-verify-en/` |
| 5 | `/services/done` | 声明完成 | **Delete** | external site owns its own confirmation |
| 6 | `/services/contact` | 信息变更 | **Action → replace form with CTA** | `https://www.tuidang.org/contact-us/` |
| 7 | `/services/faq` | 三退问答 | Content — keep, link each Q out | `https://www.tuidang.org/faq/` + `/docs/<id>/` |
| 8 | `/services/immigration` | 移民相关政策 | Content — keep, link each item out | `/docs/` 694460, 694462, 694467, 694476, 694464 |
| 9 | `/services/privacy` | 安全与隐私 | Content — keep | `/docs/694445/`, `/docs/694393/`, `/privacy-policy/` |

### Service-adjacent routes outside `/services`

| # | Local route | Treatment | Target |
|---|---|---|---|
| 10 | `/involve` (捐助我们) | Action | `https://www.tuidang.org/donation/` |
| 11 | `/resources/tools` (免翻墙链接) | Action | `https://www.tuidang.org/2022/09/14/686434/` |
| 12 | `/resources/downloads` | Action | `https://www.tuidang.org/td_promo/` |
| 13 | header CTA 我要三退 | Action | `https://santui.tuidang.org` |
| 14 | homepage 实时登记册 counter | Data feed | `https://santui.tuidang.org/stat/statics` (XML) |
| 15 | homepage 最新声明 cards | Data feed | `https://santui.tuidang.org/index/showpage/type/1` |

### Secondary santui endpoints worth linking

| purpose | URL |
|---|---|
| 查询三退处理结果 (by password) | `https://santui.tuidang.org/index/querybyid` |
| 查询审核/处理结果 (options) | `https://santui.tuidang.org/searchoptions` |
| 与退党网站联系 | `https://santui.tuidang.org/contactpage/` |
| 三退数据图示分析 | `https://santui.tuidang.org/stat` |
| 公开颁发退党证明报道 | `https://www.tuidang.org/category/gkbftdzm/` |

Non-web declaration channels advertised on santui (worth surfacing on
`/services/declare`, since they matter to users who cannot reach the site):
email `santui@tuidang.org`, plus hotlines for US, Canada, Taiwan, Hong Kong,
Japan and Korea.

## Implementation status (2026-09-28)

Step 1 (links) is done. All outbound URLs live in
`apps/web/src/lib/external-services.ts` as the single source of truth; the
handoff panel is `components/public/ServiceHandoff.tsx`.

Implemented:

- rows 1-4, 6-9 — all `/services/*` pages now link out
- row 5 — `/services/done` removed (route seed, prototype content, and the
  `cms_pages` row); it now returns a real 404
- rows 10-13 — donation, tools, downloads, header CTAs
- every outbound anchor carries `target="_blank" rel="noopener noreferrer"`,
  verified across all 53 routes
- `PageFromRoute` now calls `notFound()` instead of rendering a "page not found"
  body under HTTP 200, so removed pages leave search indexes properly

Not yet done:

- rows 14-15 — the homepage counter and 最新声明 cards still render hardcoded
  seed values rather than reading the santui feeds
- step 2 — the content revision below

## Conflicts between the prototype copy and the live service

These are content decisions for the client, not engineering choices. Each one is
a place where the prototype states something the live service contradicts.

1. **Cost.** The prototype says the certificate is `免费办理` and warns
   「本中心所有服务一律免费，任何以本中心名义收费…都与我们无关」. The live
   application states a **US$300** 办理/管理费用, non-refundable once issued.
   Shipping the prototype copy alongside a link to a $300 flow would actively
   mislead people. **This copy must change before launch.**
   (三退声明 itself *is* free — the conflict is only about the certificate.)

2. **Anonymity.** The prototype's certificate page inherits the declaration
   page's anonymity framing. The live certificate is **实名** — real name, date
   of birth, place of birth, applied for in person.

3. **Effort.** The live certificate requires a ~1 hour video training course and
   a certification exam, across a 21-step form. The prototype presents it as a
   simple request.

4. **Verification inputs.** The prototype's verify form asks for serial + name.
   The live one requires **certificate number + surname + given name + full date
   of birth**, and only covers certificates issued after **2020-08-18**.

5. **Serial format.** The prototype uses `TD-2026-0071824`. The live format is
   `TD` + 16 digits, e.g. `TD2007280828363373`.

6. **Two different lookup systems.** The live site is explicit that the
   退党证明编号 is *not* the 三退 查询密码. Declaration lookup is
   `santui.tuidang.org/index/querybyid`; certificate verification is
   `service.tuidang.org/cert-verify/`. The prototype collapses these into one
   「查询验证」 page, which will confuse people.

## Consequences

- **Design break at the handoff.** Both santui and service subdomains carry
  their own, much older visual systems. The new site's design ends the moment a
  user clicks through. Interstitial framing ("you are being taken to our service
  system") is worth considering.
- **No local PII.** Linking out means the new site never handles declarations or
  certificates. `declarations`, `certificates` and `verification_queries` stop
  being live tables, and the privacy surface shrinks to nearly nothing — a clear
  win given who submits.
- **Open in a new tab**, and do not use `rel=noopener`-less targets; external
  hosts should not get a `window.opener` handle.
- **Availability.** santui and service are separate deployments with separate
  uptime. A dead link is worse than a form, so the link-out pages should name
  the fallback channels (email, hotlines) inline rather than only on the far
  side.

## `/services` is a pure gateway (2026-09-28)

On `/services` **every** service link goes straight to tuidang.org — no local
hop first. Implemented as a `serviceLink(label, href)` resolver scoped inside
the `services/index` block of `SectionHomeTemplate`, so no other page changed.

Label is matched before href, because four different links on that page all
point at `/services/faq` locally but map to four different pages upstream. The
href map is the fallback for anything the CMS renames.

23 links resolved:

| group | targets |
|---|---|
| hero | santui, cert-apply |
| 第一步 声明退出 | santui, docs/694368, docs/694427, docs/694445 |
| 第二步 办理退党证明 | cert-apply, docs/694467, docs/694366, contact-us |
| 第三方 查询与验证 | cert-verify ×2, cert hub, contact-us |
| 查验 band | cert-verify |
| 证明办理 | cert-apply, faq hub |
| 相关 sidebar | docs/694467, cert-verify, contact-us, faq hub |
| 联系 band | contact-us ×2 |

**Left internal on purpose:** the 3 article cards and 全部相关报导 (articles, per
the brief), the breadcrumb 首页, and the 7-item `/services/*` sub-nav tab bar.
The tab bar is shared chrome rendered by `InteriorTabs` on every `/services/*`
page — redirecting it here only would make the same control behave differently
from page to page, and redirecting it everywhere would change pages outside this
brief. One-line change in the resolver if that is wanted.

**Known oddity:** the 查验 band still renders a 证明编号 text input, but the
button now leaves the site, so anything typed is lost. Either drop the input or
leave it as decoration — the live form needs 编号 + 姓 + 名 + 出生日期 anyway, so
it could never have been a true passthrough.

## Homepage 三退登记与证明 card (2026-09-28)

The four links in the homepage's first service card were `href="#"` placeholders
and now point out:

| link | target |
|---|---|
| 声明退出党、团、队 | santui.tuidang.org |
| 办理退党证明 | service.tuidang.org/cert-apply/ |
| 查询与验证证明 | service.tuidang.org/cert-verify/ |
| 证明与移民申请问答 | docs/694467 |

Scoped by label via `HOMEPAGE_SERVICE_LINKS` in `HomeTemplate`, so only these
four resolve. The other two cards on that row (调查、存档与见证 and
出版、影音与工具) are editorial rather than service entry points and keep their
existing `#` placeholders — they still need real destinations.

## Services sub-nav + verify band (2026-09-28)

**Sub-nav tab bar** now leaves the site. Implemented in `InteriorScaffold` as an
optional `externalHref` on each tab, so it applies wherever the services tab bar
renders — the same control behaves identically on every `/services/*` page
rather than only on the index.

| tab | target |
|---|---|
| 声明三退 | santui.tuidang.org |
| 退党证书 | service.tuidang.org/cert-apply/ |
| 查询验证 | service.tuidang.org/cert-verify/ |
| 移民相关政策 | docs/694460 (USCIS 关于共产党员的移民态度) |
| 三退问答 | www.tuidang.org/faq/ |
| 安全与隐私 | docs/694445 (三退是否安全) |
| 信息变更 | www.tuidang.org/contact-us/ |

Only the `services` section was given `externalHref`; about / involve / news /
videos / resources tab bars are untouched.

> **Consequence:** `/services/immigration` is now orphaned — it has no inbound
> link anywhere outside the tab bar it just lost. The page still resolves and is
> in the sitemap, but nothing navigates to it. Every other `/services/*` page
> stays reachable through the footer and page sidebars. Add it to the footer
> 服务 column if it should stay reachable, or delete it like `/services/done`.

**Verify band** — the 证明编号 input was removed; the button (now 前往查验) links
to cert-verify, with a note naming what the real form requires. A single box
here could never have been a passthrough: the live form needs 编号 + 姓 + 名 +
出生日期. The band copy was updated to match, since it still said 「输入证明上的
编号」 next to a control that no longer existed.

## Copy revised (step 2, done 2026-09-28)

Every 免费 claim across the site was audited against the live service. Claims
about 三退声明 and about resource downloads are **true and were kept**; claims
covering 退党证明 were false and were corrected. Applied to both the code seeds
(`prototype-page-content.ts`, template defaults) and the live
`cms_content_entries` rows.

| location | was | now |
|---|---|---|
| `/services` title | 声明、证明、查验，全部免费。 | 声明、证明、查验。 |
| `/services` body | …全部免费，不收取任何费用。 | …三退声明登记与查询验证免费；退党证明为实名办理，需缴纳办理／管理费用。 |
| `/services` cert card | 免费办理 · 电子版与纸本均可 | 实名办理 · PDF 电子证明 |
| `/services/cert` subtitle | …免费办理，不收取任何费用。 | …实名办理，需完成认证课程与考试，并缴纳办理／管理费用。 |
| `/services/cert` notice | 本中心所有服务一律免费，任何以本中心名义收费…都与我们无关 | 退党证明…需缴纳办理／管理费用；三退声明本身始终免费。请只通过官方渠道办理（本网办理或干净世界），任何其他声称可以代办、加急或包过的…都与我们无关 |
| `/services/cert` steps | 3 人工核对 | 3 认证考试 |
| `/services/cert` process | 提交后由志愿者人工核对，电子版通常数个工作日内签发。 | 需观看认证培训视频（约一小时）并通过认证考试，通过后获得 PDF 电子证明。 |
| `/services/contact` subtitle | …全部免费。 | …由本中心人工核对处理。 |
| `/services/contact` reminder | 全部服务免费。本中心从不以任何名义收取费用… | 办理费用只在官方办理页面支付。我们不会通过私人账户或中介收款，也不会索取银行卡号、验证码或密码。 |
| `/services/faq` | 不收费，本中心所有服务一律免费。 | 三退声明免费。退党证明为实名办理，需缴纳办理／管理费用… |
| `/services/immigration` | 退党证明免费办理… | 退党证明为实名办理的中英文对照文件… |
| `/about` principle | 免费。登记、证明办理与查询验证全部免费… | 收费与免费。三退声明登记与查询验证免费。退党证明…仅通过官方渠道收取。 |
| `/about` stat tile | 0 服务收费 | 0 声明登记收费 |
| `/involve` | 我们的登记与证明服务对所有人免费，并将一直免费。 | 三退声明登记对所有人免费，并将一直免费。 |

### The anti-fraud warnings were the dangerous part

Three separate places told readers that **anyone charging in the center's name
is a fraud**. With the official certificate costing money, that copy would have
pushed people away from the legitimate payment page as if it were a scam —
worse than merely being out of date. All three were reframed around *channel*
rather than *price*: use the official channels (本网办理 / 干净世界), distrust
anyone claiming to 代办/加急/包过, and note that the center never collects through
private accounts or intermediaries.

### Deliberately not stated

The **US$300** figure is not written into the site. The live page frames it as a
捐助办理／管理费用 and amounts change; pages say 「具体金额与流程以官方办理页面说明为准」
instead, so the site cannot go stale or contradict the payment page.

### Kept, because they are true

三退声明 is genuinely free, anonymous and registration-free; 查询验证 is open to
all; resource downloads are free and licence-free. Those claims were left alone.

## What this supersedes

The public intake work in [public-service-intake.md](./public-service-intake.md)
is superseded for `declare` and `verify`. Specifically now unused:

- `app/api/public/declarations/`, `app/api/public/verify/`
- `lib/service/public-intake.ts`, `lib/security/rate-limit.ts`
- `components/public/DeclareForm.tsx`, `components/public/VerifyForm.tsx`
- `app/admin/declarations/`, `app/api/admin/declarations/`,
  `lib/admin/declarations-repository.ts`
- migration `005_public_declaration_intake.sql` (already applied to dev)

Keep or remove is a judgement call: removing is cleaner, keeping costs nothing
at runtime and preserves the option of bringing services in-house later. Nothing
links to any of it once the pages above become link-outs.
