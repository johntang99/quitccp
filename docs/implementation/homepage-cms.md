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
| 首屏 Hero | 居中大标题 · 左文右图 · 左文右图集 · 左文右视频 · 通栏大图＋文字卡片 |
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

The gallery deliberately does **not** auto-advance. Motion in the hero competes
with the headline and takes the page away from anyone who needs time to read.
Thumbnails are a `tablist` with proper `aria-selected`.

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

### full-bleed is an overlay card

The photo is a band of fixed height (`--hero-photo-h`, 620px desktop) running
full width at its **natural brightness — no dark cover**; `.hero-scrim` is
hidden entirely. The copy sits in a light card (`--card` on `--rule`, soft
shadow) whose top edge starts at **60% of the photo height** — 6 parts photo
above the card, 4 alongside — and which then **carries on past the photo's
bottom edge** onto the page background. The card straddles that edge rather
than sitting inside the image.

Measured on the shipped copy: photo 620px, card top at 372px (6.0 : 4.0), 248px
of card over the photo and 228px below it.

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
