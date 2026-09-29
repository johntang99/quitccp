# Homepage CMS

The homepage is edited at **`/admin` → 页面内容 → `root/index - 首页`**
(`/admin/content?path=pages/home.json&locale=zh`).

Before this change only five fields were stored (`hero`, `meta`, `title`,
`subtitle`, `streamEntries`); the other nine sections were constants inside
`HomeTemplate.tsx` and could not be edited at all. All eleven sections now live
in `pages/home.json`.

## Structure

Every section is `{ enabled, variant, ...content }`:

- **`enabled`** — unchecking it removes the section from the page entirely.
- **`variant`** — the layout, chosen from a dropdown in the admin.
- the rest is that section's content.

Schema and defaults: `packages/content-schema/src/home-content.ts`.
Payload merge: `apps/web/src/components/templates/home-content.ts`.

## Sections and layout variants

| section | variants (first = current design) |
|---|---|
| 首屏 Hero | 居中大标题 · 左文右图 · 左文右图集 · 左文右视频 · 卡片叠加（Card overlay） |
| 实时登记册 | 左数字右滚动 · 上下堆叠 · 仅数字 · 仅滚动声明 |
| 我们的服务 | 三栏卡片 · 两栏卡片 · 列表 |
| 新闻与报告 | 左主图右列表 · **大图头条（突出）** · 等分网格 |
| 栏目卡片 | 四栏 · 两栏 |
| 视频资源 | 三栏 · 四栏 · 列表 |
| 见证者 | 三栏引语 · 纵向排列 |
| 全球网络 | 左文右城市 · 上下堆叠 |
| 资源馆 | 网格 · 列表 |
| 关于我们 | 三栏 · 纵向排列 |
| 参与我们 | 四栏 · 列表 |

Variant CSS lives at the end of `apps/web/src/app/globals.css`. Default variants
need no rules — they are the prototype design already in `site.css`.

## Hero variants

| variant | layout | fields used |
|---|---|---|
| `centered` (default) | centred headline, copy and CTAs | eyebrow, title, body, actions |
| `photo-split` | copy left, photo right, 1:1 columns | `image`, `imageAlt` |
| `gallery-split` | copy left, gallery right | `gallery[]` — main image + thumbnail strip |
| `video-split` | copy left, click-to-play video right | `video.src`, `video.poster`, `video.caption` |
| `full-bleed` | photo full width at natural brightness, copy in a light card overlaying it | `image`, `imageAlt` |

The three split variants share a 1:1 grid and collapse to a single column below
900px.

**Video is click-to-play, and nothing is requested until the click.** `src`
accepts a direct file (`.mp4`/`.webm`) or an embed URL; a direct file renders as
`<video controls autoplay>`, an embed as an `<iframe>`. Verified: zero network
requests for the video before the click, one after. For a third-party embed that
matters twice — no tracking request on page load, and a blocked host (common for
readers inside mainland China) cannot stall the homepage, because only the
poster renders. With `src` empty the poster shows and the play control is
hidden.

The gallery auto-advances every **5s**, with a 0.45s crossfade. Three things
keep the motion from becoming a nuisance:

- it **pauses while the pointer or keyboard focus is inside the gallery**, so it
  cannot swap the image out from under someone who is looking at it;
- picking a thumbnail **restarts the clock** rather than advancing a moment later;
- **`prefers-reduced-motion` stops it entirely**.

Thumbnails are a `tablist` with proper `aria-selected`, and a visually-hidden
live region announces "第 N 张，共 M 张".

> **Two collisions with `site.css` worth knowing about**, both found by testing:
>
> 1. `.hero-media` was already taken — `site.css` defines it as the absolutely
>    positioned full-bleed backdrop layer. Reusing the name for a grid column
>    made the photo 1200px wide inside a 578px column and hid the copy. The
>    split variants now use `.hero-aside`; `full-bleed` reuses `.hero-media`
>    as intended, since that is exactly what it was built for.
> 2. `site.css` applies `transform: scaleX(-1)` and `brightness(1.24)` to
>    `.hero-media img`. Fine for an abstract texture, wrong for a photograph —
>    signage in the image renders backwards. Both are undone for `full-bleed`.

### full-bleed is a Card overlay

The photo is a band of fixed height (`--hero-photo-h`, 780px desktop / 420px mobile) running
full width at its **natural brightness — no dark cover**; `.hero-scrim` is
hidden entirely. The copy sits in a **translucent** card whose top edge starts at **60% of the
photo height** — 6 parts photo
above the card, 4 alongside — and which then **carries on past the photo's
bottom edge** onto the page background. The card straddles that edge rather
than sitting inside the image.

Measured on the shipped copy: photo 780px, card top at 468px (6.0 : 4.0).

**Card transparency.** `rgba(255,255,255,.74)` with
`backdrop-filter: blur(8px) saturate(1.1)`, so the photograph is still legible
behind the card rather than merely tinting it.

> **The blur mattered more than the opacity.** A first pass used 0.82 with a
> 16px blur and still looked solid white, because 16px dissolves the photo into
> a flat wash — over a light scene there is then nothing left to see through.
> Dropping to 8px keeps recognisable shapes, which is what makes the card read
> as transparent.

Opacity can sit as low as 0.74 only because the text is darkened to `--ink` in
this variant. Measured against the worst realistic case — a near-black photo
behind the card — h1 and body land at **9.11:1** and the eyebrow at **4.82:1**,
all clear of WCAG AA's 4.5. With the original `--ink-soft` body colour, 0.74
would have measured about 3.5:1 and failed.

The eyebrow keeps its visual hierarchy through `opacity: .72` on `--ink` rather
than a lighter colour; `--muted` measured 2.38:1 here and was already under AA
even on a solid white card.

Browsers without `backdrop-filter` get 0.88 via `@supports not`.

Two things this needs that the base hero does not:

- `overflow: visible` — `site.css` clips `.hero`, which would cut the overhang off.
- `background: var(--paper)` — below the photo the page background must show
  through, not the hero's purple gradient.

The ratio lives in one place: `padding-top: calc(var(--hero-photo-h) * 0.6)`.

Because the surface flips from dark to light, every colour the hero sets for a
dark ground is overridden inside the card: eyebrow to `--muted`, `h1` to `--ink`
with the text-shadow removed, body to `--ink-soft`. `btn--line-light` is drawn
for a dark ground and would all but vanish on white, so it takes the
`btn--line` treatment (seal border and text). Below 900px the card stops being
bottom-pinned and centres instead.

## 实时登记册 is layout-only

Its declaration entries are **not** editable in the CMS. They are real
declarations belonging to the santui feed, not editorial copy, so the admin
shows only the layout picker and the surrounding labels (数字, 说明, 滚动区标题).
The sample rows stay in `HomeTemplate.tsx` until the feed at
`santui.tuidang.org/stat/statics` is wired up.

## Editor behaviour

The homepage gets its own panel in `ContentExplorer`: one collapsible block per
section with a 显示 checkbox, a 版式 dropdown, plain-text fields under Chinese
labels, and a JSON textarea for list fields (cards, items, cities).

Invalid JSON in a list field is flagged inline and that field is simply not
applied — the rest of the form still saves. Draft text is held per field while
typing so a half-typed array is not reformatted under the cursor, and drafts are
cleared when switching files.

## Seeding

```
npm run content:seed:home            # fill missing keys only
npx tsx scripts/seed-home-content.ts --force   # overwrite with defaults
```

The seed fills missing keys *within* a section rather than skipping a section
that already exists, so the legacy `hero` (which held only `title`/`body`)
gained `variant`/`eyebrow`/`actions` without losing the words already written.

## Note on the `<a>` wrappers

`.item`, `.lead` and `.vid` are themselves grid containers in `site.css`.
Wrapping their contents in an anchor collapsed those grids the first time; the
anchors now carry `display: contents` so they add no box of their own. Same
pattern already used in `SectionHomeTemplate`. Placeholder thumbs (no image set)
are given explicit dimensions, otherwise the row shrinks to a sliver.

## Still hardcoded

- the 实时登记册 entries (by design, see above)
- the registry count `4.64 亿` is a literal string; the live figure is
  `466,772,019` and there is an XML feed for it — see
  [services-link-out-map.md](./services-link-out-map.md) rows 14-15

## Sections hidden on the homepage

Two sections are `enabled: false` — on the homepage only, and in
`homeContentDefaults` as well so a re-seed does not restore them. Re-tick
「在首页显示」 in the admin to bring either back.

- `资源馆`（工具、指南与公开文档）— the same links live under `/resources`, which
  is untouched and still in the navigation; the homepage row repeated them.
- `全球网络`（一百多个服务点，由志愿者维持运转）— `/about/network` still carries the
  service-point finder and is linked from `/about` and `/services`, so hiding the
  homepage band orphans nothing.

## 曙光 (Dawn) — the merged 实时登记册 + 我们的服务 band

Implements `docs/prototypes/home-quit-ccp-bright-html` ("合并方案 G · 曙光"). The two
sections previously sat apart with a large dead gap between them; the redesign
puts them on one dawn gradient with the white service cards straddling its
lower edge, so the band resolves into the page instead of stopping abruptly.

**Turned on by setting 实时登记册 → 版式 → 「曙光 · 与「我们的服务」合并」.**

> **Coupling worth knowing:** this variant spans three sections. While
> `registry.variant === "dawn"`, the standalone 我们的服务 **and** 见证者 sections
> are suppressed and their content is rendered inside the band instead.
> Switching registry back to any other variant restores all three independently.
> Content still lives under the existing `registry`, `services` and `voices`
> keys, so nothing had to be migrated.

### The fourth card: 见证

A later revision of the mockup takes the card row from three columns to four and
makes the fourth a 见证 card: one statement at a time, with a row of portraits to
switch between them. It renders `voices` — the same eyebrow, heading, lede, items
and 更多见证 link the standalone 见证者 section used, so again nothing moved.

The card appears only when 见证者 is enabled and has at least one item; without it
the row stays the three cards it was, at the roomier padding they were drawn with
(`.dawn-cards--4` carries the tighter values the fourth column needs).

The switcher is the band's only client component,
`components/public/WitnessCard.tsx`. The portraits are real `<button>`s labelled
with the speaker's name and carrying `aria-pressed` — a portrait alone says
nothing about who it selects, so it would be unusable from the keyboard or a
screen reader otherwise.

`voices.lede` was shortened to 「来自曾经身处体制之内的人，陈述被完整保存并公开。」
The previous two-sentence version pushed the card — and with it the whole row —
taller than the service cards beside it.

> **Fixed alongside:** `.dawn-inner` re-declares `padding` and had it at
> `88px 0 96px`, which overrode `.wrap`'s `0 32px` and ran the entire band
> edge-to-edge on any viewport under ~1264px, cards touching the screen. It is
> now `88px 32px 96px`. Any rule that sets `padding` on a `.wrap` element has to
> repeat the side padding.

Component: `components/templates/DawnBand.tsx`. Styling: `.dawn-*` at the end of
`globals.css`, carrying the mockup's values verbatim — gradient stops
(`#3F3592 → #4C40A4 45% → #6A56B6 78% → #A583B4`), gold `#F2D38A`, accent
`#3B3190`, card `#FFFEFA` with `0 30px 70px -30px rgba(40,24,90,.45)`.

New content fields:

| field | purpose |
|---|---|
| `registry.liveLabel` | text beside the pulsing dot, e.g. 「实时登记册 · LIVE」 |
| `registry.feedCount` | how many declaration cards the feed row shows (1–6) |
| `services.cards[].ctaLabel` / `ctaHref` | optional button at the foot of a card; the design puts 我要三退 on card 01 |

The feed is a **continuously moving trail**: 10 records at ~60px/s, rendered
twice so translating the track -50% loops seamlessly (the copy is `aria-hidden`
so screen readers do not hear every declaration twice). It pauses on hover and
focus so a reader can actually read a statement, fades out at both edges via a
mask, and stops entirely under `prefers-reduced-motion`. Cards use a fixed width
plus `margin-right` rather than flex + `gap`, because a gap is not duplicated
across the seam and the loop would visibly jump.

`feedCount` (1–20) sets how many records the trail carries; the row fills by
cycling if fewer declarations are available.

> **⚠ The declarations are placeholders, not real records.** Ten sample entries
> live in `HomeTemplate.tsx` purely so the trail has something to show. On a
> public site they read as genuine declarations by real people, which they are
> not. Wire the santui feed
> (`santui.tuidang.org/index/showpage/type/1`) before launch — see
> [services-link-out-map.md](./services-link-out-map.md) row 15.

The sun glow, rings and grid overlay are `aria-hidden` decoration. The pulsing
dot respects `prefers-reduced-motion`.

## 报刊头版 (Broadsheet) — the merged 新闻与报告 + 专题栏目 band

Implements `docs/prototypes/home-news-section-html` ("新闻方案 J · 报刊头版"). The news list
and the four 栏目卡片 previously read as two unrelated blocks; the redesign sets
them on one newsprint page — masthead rules, a lead story against a numbered
最新发布 column, then the category cards under a rule-flanked band title.

**Turned on by setting 新闻与报告 → 版式 → 「报刊头版 · 与「专题栏目」合并」.**

> **Coupling worth knowing:** like 曙光, this variant spans two sections. While
> `news.variant === "broadsheet"`, the standalone 栏目卡片 section is suppressed
> and its cards are rendered inside the band. Its own 版式 dropdown stops
> mattering — the admin says so inline. Switching news back to any other variant
> restores both sections independently; no content is migrated either way.

Component: `components/templates/BroadsheetBand.tsx`. Styling: `.bsheet-*` at the
end of `globals.css`. The mockup's palette is a warmer, violet-inked cousin of
the site's, so its off-palette values are scoped to `.bsheet` as local custom
properties rather than pushed into `:root`: newsprint card `#FFFEFA`, rules
`#CFC8BA` / `#D9D2C4` / `#E3DCCE` / `#EAE4D8`, muted `#6B6578`, body `#45404F`,
numeral gold `#B8913A`. The accent stays `var(--seal)` so links match the rest of
the page. Type sizes are `clamp()`-ed: the mockup is a 1440px artboard, the site
wraps at 1200px.

New content fields:

| field | purpose |
|---|---|
| `news.listTitle` / `listTitleEn` | the 最新发布 column heading and its latin sub-label |
| `news.listMoreLabel` / `listMoreHref` | the boxed link under that column |
| `news.lead.kicker` | latin kicker printed before the date, e.g. `FEATURE` |
| `channels.heading` | the rule-flanked band title, 「专题栏目」 |
| `channels.cards[].en` | latin category label, e.g. `INVESTIGATIONS` |

`channels.cards[].badge` keeps its existing meaning — "this item is a video" —
and becomes the corner 「▶ 视频」 pill here; the admin edits it as a checkbox.

The masthead dateline is **computed, not edited**: a broadsheet dateline is
today's date, and a stored one would go stale silently. It is formatted in
`America/New_York`, the clock the service centre stamps its own article dates
with — those dates are printed a few centimetres away in the same band. The
homepage revalidates every 5 minutes, so it turns over shortly after midnight.

All hover states (card lift, image zoom, arrow nudge) are CSS, so the band stays
a server component.

### Admin

The five redesigned sections — 实时登记册, 我们的服务, 新闻与报告, 栏目卡片,
视频资源 — no longer edit anything as raw JSON. Every list and nested object has
a purpose-built editor with Chinese labels, an image picker where there is an
image, and add / delete / 上移 / 下移:

| section | structured fields |
|---|---|
| 实时登记册 | `substats[]`, plus `feedCount` as a 1–20 number input |
| 我们的服务 | `cards[]` including each card's nested `links[]` and its CTA |
| 新闻与报告 | `lead` (object) and `items[]` |
| 栏目卡片 | `cards[]`, with the video badge as a checkbox |
| 视频资源 | `featured` (object, with its tag pills one-per-line), `series[]`, `items[]` |
| 见证者 | `items[]`, with the portrait picker |
| 关于我们 | `cells[]`, whose 分段条 rows are label + percent with a running total |
| 参与我们 | `items[]`, with CTA text, the circled glyph and a 主推卡片 flag |
| 全球网络 | `cities` as one name per line |
| 资源馆 | `items[]` |

They are declared in `OBJECT_EDITORS`, `ROW_EDITORS`, `NUMBER_FIELDS` and
`STRING_LIST_FIELDS` in `HomeSectionsEditor.tsx`, keyed `<section>.<field>`
because the field names repeat across sections (`items`, `cards`) with different
shapes. **No section on the homepage falls back to the JSON textarea any more**;
anything added later that is not declared there still will.

**Labelling conventions**, applied across the whole editor:

- Field captions are bold; the value the operator types stays regular. The
  controls need an explicit `font-weight: 400` — they inherit from the `<label>`
  that wraps them.
- Every caption, section name, fieldset legend, variant and `<option>` carries
  its English beside the Chinese: `标题（Title）`, `放映室 Screening（深色影院）`.
  Hints and running totals are prose, not captions, and stay Chinese.
- Fieldsets run 文字 → 按钮与链接 → 图片与视频 → 内容条目. CTAs sit directly under
  the text because on the Hero the media block is long enough to bury them.
- Row editors whose fields are unlabelled once filled (the Hero's buttons, a
  card's links, a split bar) carry a column header instead of a caption per row.

Every section states its own situation inline: the two hidden ones say why they
were turned off (and only while they are off), 视频资源 says which of its fields
disappear when left blank, and the merged variants explain themselves in both
directions.

Both merged variants say so inline, in both directions: 实时登记册 and 新闻与报告
note which sections they have absorbed, and 我们的服务, 见证者 and 栏目卡片 note
that they are being absorbed and that their own 版式 choice has stopped
mattering.

## 放映室 (Screening) — the video section as an auditorium

Implements `docs/prototypes/home-video-section-html` ("视频方案 M · 放映室").
The section was a flat row of three thumbnails; the redesign gives it a dark
auditorium band: series pill nav beside the heading, one large featured poster
with its copy alongside, the latest films underneath, and a footer line.

**Turned on by setting 视频资源 → 版式 → 「放映室（深色影院）」.**

Unlike 曙光 and 报刊头版 this variant does not absorb another section — it only
restyles 视频资源.

Component: `components/templates/ScreeningBand.tsx`. Styling: `.screening-*` at
the end of `globals.css`, carrying the mockup's values — gradient
(`170deg #2E2670 → #251F5C 60% → #211A52`), gold `#F2D38A`, poster radius 12 with
`0 40px 80px -40px rgba(0,0,0,.6)`, 96px play button with a 12px ring.

> **Specificity trap:** `site.css` already styles this band as `#video { background; color }`.
> An id outranks a class, so `.screening` alone could not replace either — the
> base rule is written `#video.screening, .screening`. Any future rule here that
> overrides one of those two properties needs the same treatment.

New content fields:

| field | purpose |
|---|---|
| `video.lede` | intro paragraph under the heading; **blank by default** |
| `video.series[]` | the pill nav — `{ label, href, active }`; `active` gives the filled white pill |
| `video.featured` | poster + copy: `tag`, `title`, `body`, `image`, `href`, `duration`, `meta[]`, and the two buttons |
| `video.latestLabel` | heading of the card row, 「最新上线」 |
| `video.items[].duration` / `badge` | the corner chips; blank hides each |
| `video.footNote` / `footMark` | the two ends of the footer line; **both blank by default** |

### Content

The 视频专题 1/2/3 placeholders are gone. The featured film and the four cards
are now real films with their real links, series, and durations, taken from
`pages/videos-index.json` — so the homepage and `/videos` agree rather than each
carrying its own copy. The eight series pills point at the `/videos/*` pages that
already exist.

Two deliberate departures from that source:

- `四万人的觉醒` does not use its thumbnail from `videos-index.json`: that image is
  already on the card beside it, and two identical thumbs in a row of four read
  as a rendering bug.
- The secondary button is 「查看全部调查影像」 → `/videos/ironclad` rather than the
  mockup's 「阅读文字报告」, which had no destination on this site.

The mockup's intro paragraph and its footer line (「同步发布于 YouTube · GanJingWorld」
/ FREE TO DOWNLOAD & SHARE) are **not shown**: the band is tall enough without
them, and the reuse terms are already stated properly on the `/videos` pages.
The fields remain -- typing text back into 导语, 底部说明 or 底部标记 brings each
element back -- but they default to blank so a re-seed does not restore them.

Thumbnails across the video pages are stand-in photographs from the tuidang.org
media library, not frames from the films themselves. `cms_videos` is still empty;
when it is populated, this section should read from it rather than from
`pages/home.json`.

## 可检验 (Verified) — the merged 关于我们 + 参与我们 band

Implements `docs/prototypes/non-profit-join-html` ("方案 T · 可检验"). The
accountability figures and the four ways to take part were two pale sections at
the foot of the page; the redesign puts them on one dark panel with the
participation cards straddling its lower edge, so the page closes on an action
instead of trailing off.

**Turned on by setting 关于我们 → 版式 → 「可检验 · 与「参与我们」合并」.**

> **Coupling worth knowing:** the third variant that spans two sections. While
> `about.variant === "verified"`, the standalone 参与我们 section is suppressed
> and its cards render inside the band. Switching about back to 三栏 restores
> both. No content moved — it reads the existing `about` and `involve` keys.

Component: `components/templates/VerifiedBand.tsx`. Styling: `.verified-*` at the
end of `globals.css` — panel gradient `160deg #2C2470 → #3A2F8C 55% → #4B3EA3`,
gold `#F2D38A`, gold glow and a dot grid masked in from 40% across. The panel's
height is a **percentage** (70%) rather than the mockup's 700 of 1000px, so the
cards keep straddling its edge as the content reflows; the breakpoints retune it
(76% at ≤1080 where the two halves stack, 62% at ≤860).

Content changes to the existing sections:

| field | change |
|---|---|
| `about.eyebrow` | 「关于我们 · 参与我们」 — the band covers both |
| `about.heading` | 「每一分钱、每一个数字，\n都可以被检验。」 — `\n` is an authored line break |
| `about.moreLabel` | 「阅读年度报告 →」 |
| `about.cells` | reordered so the 84% figure leads; its `heading` became 「上一财年用于项目支出」, the line that labels the bar |
| `involve.lede` | new — the line beside 四种参与方式 |
| `involve.items[]` | new `ctaLabel`, `glyph` (the circled character) and `primary` (gold top rule + filled button) |

Two things the band derives rather than storing:

- **Which typeface a figure takes.** `501(c)(3)` is set in the mono face and
  公开方法 in the serif — that follows from the script, so `isLatin()` decides it
  rather than a field an editor has to remember. A row carrying `bars` overrides
  both and takes the large gold treatment.
- **Whether the lead line shows.** `cell.heading` only prints when the row has a
  bar, because that is the line labelling it; on the other rows `heading` is the
  小标题 the 三栏 variant prints above the value, and the design has no room for it.

`about.heading` was sized down from the mockup's 50px to a 44px cap: the mockup's
column is ~600px and ours is ~530, where the first authored line (11 glyphs) had
been overflowing and wrapping mid-phrase.

> **Adjacency:** 放映室 sits immediately above this band and is also dark, so the
> two read as one block with a seam through them. `.screening + .verified` puts
> 72px of paper between them. It is scoped to that pair on purpose — against a
> light section above, this band needs no extra space.

### Admin

关于我们 and 参与我们 join the sections with no JSON left in the form.
`about.cells` gets an editor whose 分段条 rows are label + percent with a running
total that turns red away from 100%; `involve.items` gets 标题 / 说明 / 链接 /
按钮文字 / 圆形徽标 and a 主推卡片 checkbox. Both sections state the coupling
inline, in both directions.
