# Theme system — step 2 plan

How the site gets one editable theme that actually controls colours, fonts, sizes and
spacing — without a rebuild that scrambles the layout.

Status: **all four phases shipped.** See [what actually shipped](#appendix-b-what-shipped)
for the measured outcome and the places the plan was changed on contact with the code.

---

## 1. Why this is not just "write a theme.json"

The obvious version of this task — copy the `:root{}` block into a JSON file, read it in
the layout — takes about an hour and would **appear** to work while doing almost nothing.
Step 1 showed why.

Two problems sit underneath the styling:

**The token block is not where the styling is.** Production CSS is 4,431 lines across two
files, and only ~40 of those lines are tokens. The rest hardcode their values:

| | distinct values today | what a theme needs |
|---|---|---|
| `font-size` | 64 | 7 |
| `line-height` | 36 | 3 |
| `letter-spacing` | 40 | a capped scale |
| declarations under 12px | 44 | 0 |
| `var(--mono)` on text | 73 rules | digits and Latin only |
| line length in `ch` | 15 rules | `em` (see §6) |

**Entire sections bypass CSS altogether.** The news and videos pages are styled with
inline React `style={{...}}` objects — 636 of them across 32 public component files:

| inline property | occurrences |
|---|---|
| `color` | 530 |
| `gap` | 292 |
| `background` | 254 |
| `fontSize` | 233 |
| `padding` | 216 |
| `margin` | 166 |
| `fontFamily` | 112 |
| `fontWeight` | 71 |
| `lineHeight` | 71 |
| `borderRadius` | 39 |
| `letterSpacing` | 12 |

Plus **36 distinct hex colours** written directly into TSX.

In step 1 this was not theoretical: `newsTokens.ts` and `VideoParts.tsx` hardcoded
`'Noto Serif SC', 'Songti SC', serif` as TypeScript strings, so the new webfont reached
every page **except** news and videos until those four constants were redirected. A
`theme.json` shipped today would have the same blind spot — the admin would change colours
everywhere except the pages editors look at most.

So the work is not "add a theme file". It is **"route the site through tokens, then add a
theme file"**, and the sequencing below exists to keep the site looking identical while
that happens.

---

## 2. The token contract

What `theme.json` controls, modelled on the Dr Huang clinic site
(`content/<site>/theme.json`) but adapted to this site's actual needs — Chinese
typography, the purple/gold identity, and a dark-band treatment the clinic has no
equivalent for.

```jsonc
{
  "colors": {
    "ink":     { "DEFAULT": "#191C1A", "soft": "#4C524D", "muted": "#8B8679" },
    "paper":   { "DEFAULT": "#F4F3EF", "card": "#FFFFFF" },
    "rule":    { "DEFAULT": "#DEDACF", "dark": "rgba(255,255,255,.14)" },
    "seal":    { "DEFAULT": "#4A3C96", "deep": "#382B7A" },
    "plum":    { "deep": "#231A52", "mid": "#3B2E7E", "menu": "#2C2168" },
    "gold":    { "DEFAULT": "#D6AC4E", "light": "#F0D48C" },
    "lavender":{ "DEFAULT": "#A79FD0", "light": "#C3BDE2" }
  },
  "gradients": {
    "hero":  "linear-gradient(168deg,#463792 0%,#3A2C7C 52%,#312566 100%)",
    "band":  "linear-gradient(200deg,#382B7A 0%,#271D5C 62%,#1F1750 100%)",
    "band2": "linear-gradient(150deg,#372B75 0%,#251C5A 56%,#2B2066 100%)",
    "gold":  "linear-gradient(180deg,#F0D48C 0%,#D2A748 100%)"
  },
  "typography": {
    "fonts": { "heading": "serif-sc", "body": "system-sc", "mono": "plex-mono" },
    "size":  {
      "display": "clamp(30px,4vw,48px)", "h2": "clamp(26px,3vw,36px)",
      "h3": "clamp(20px,2vw,24px)", "item": "18px",
      "body": "17px", "small": "14px", "label": "13px"
    },
    "lineHeight": { "heading": 1.3, "item": 1.5, "body": 1.8 },
    "tracking":   { "heading": "0.01em", "body": "0.02em", "label": "0.08em" },
    "measure":    { "body": "38em", "lede": "32em" }
  },
  "shape":   { "radius": "10px", "shadow": "0 14px 30px -24px rgba(26,23,38,0.3)" },
  "spacing": { "density": "comfortable", "wrap": "1200px" }
}
```

Three deliberate differences from the clinic:

- **`fonts` holds role names, not font stacks.** `next/font` resolves families at build
  time, so an editor cannot type an arbitrary font name and have it load. The admin offers
  a fixed menu (`serif-sc`, `system-sc`, `serif-tc`, `system-tc`, `plex-mono`) and the
  build maps those to real faces. This is a real limitation, not an oversight.
- **`gradients` is first-class.** The clinic has flat colours; this site's identity is
  carried by the three purple gradients, and an editor changing `seal` without them would
  get an incoherent page.
- **`measure` is in `em`, not `ch`.** See §6.

---

## 3. Phase 0 — lift the tokens into the app, change nothing visually

The goal of this phase is a **zero-pixel diff**. If any page moves, the phase is wrong.

1. Move `docs/prototypes/site.css` into the app as `apps/web/src/app/styles/base.css`.
   Production currently imports its stylesheet out of the mockups folder
   (`globals.css:1`), which means a designer editing a prototype edits the live site.
   The prototypes keep their own copy.
2. Extract the `:root{}` block into `apps/web/src/data/theme.json`, **with today's exact
   values**. No rounding, no "while we're here" improvements.
3. Add `apps/web/src/lib/public-theme.ts` following the existing
   [`public-settings.ts`](../../apps/web/src/lib/public-settings.ts) pattern: read
   `cms_site_settings` where `setting_key = 'site.theme'`, fall back to `theme.json`,
   swallow errors and fall back rather than throw.
4. The root layout emits the resolved tokens as an inline `<style>:root{…}</style>`,
   exactly as the clinic layout does.

**No migration is needed.** `cms_site_settings` already exists
(`005_site_settings.sql`) with a `setting_key` / `value_json` shape and read-write helpers
in `repository.ts`. The theme is one more row.

**Acceptance:** screenshot diff ≈ 0% on all 12 page × width combinations; `build:check`
passes; no horizontal overflow.

---

## 4. Phase 1 — route the site through the tokens

This is the bulk of the work and the only phase that can break the layout, so it is done
in slices, each independently verifiable and revertible.

Order is by risk, worst first, so surprises surface while there is appetite to deal with
them:

| slice | surface | why this order |
|---|---|---|
| 1 | `news/*` (9 files) | biggest inline-style concentration; already bit us once |
| 2 | `videos/*` (6 files) | same pattern, its own `SERIF` constant |
| 3 | `templates/*` + article body | the pages readers spend longest on |
| 4 | homepage sections | most visible, but mostly already CSS-driven |
| 5 | resources / culture / materials | newest code, cleanest already |

For each slice: convert inline values to tokens → screenshot at 1440/834/390 → pixel-diff
against the slice's own baseline → explain every diff above ~2% or revert it.

Two conversions need judgement rather than find-and-replace:

- **The 36 hardcoded hex values** must be matched to real tokens, not nearest-neighbour'd.
  Several are near-duplicates of existing tokens (`#F2F0E9` vs `--paper:#F4F3EF`) and a
  few are genuinely distinct. Each gets a decision: map to a token, or promote to one.
- **Layout properties stay inline.** `gap`, `grid-template-columns`, `flex` and one-off
  `padding` are not theme concerns. Only `fontSize` / `fontFamily` / `fontWeight` /
  `lineHeight` / `letterSpacing` / `color` / `background` / `borderRadius` move. That
  roughly halves the 636 blocks to the ~1,100 individual declarations that matter.

---

## 5. Phase 2 — the admin editor

Lands at `/admin/settings` as a Theme tab (the route already exists).

- **Preset picker**, modelled on the clinic's `ThemePresetsTab.tsx`: swatch cards, click to
  apply into editor state, explicit save. Seeded with the current look plus two or three
  alternates.
- **Field editor** for colours (native colour inputs), the size ladder, line-heights and
  tracking.
- **Font role menus**, limited to the build-time families (§2).
- **Live preview** in an iframe — Chinese typography cannot be judged from numbers, and a
  17px body at 1.8 line-height is a decision you make by looking.
- **Writes to `cms_site_settings`** under `site.theme`. Because `theme.json` remains the
  fallback, deleting the row is a complete revert to the shipped defaults — the escape
  hatch if an editor makes the site unreadable.

Access follows the existing admin auth and MFA. No new surface.

---

## 6. Phase 3 — apply Ingrid's values, one dial at a time

Only now do the numbers change. Each item is a separate change with its own screenshot
pass, because each one reflows text.

Adopted as defects:

1. Heading line-height 1.3 (h3 1.4), instead of inheriting body 1.75 — fixes the gap that
   makes a two-line 欄目標題 read as two paragraphs.
2. One body line-height, 1.8, replacing the current 1.8 / 1.85 / 1.95 mix.
3. 13px floor — removes the 44 declarations currently under 12px.
4. `var(--mono)` restricted to digits and Latin. 73 rules currently set Chinese in IBM Plex
   Mono, a Latin monospace with no Chinese glyphs, so those characters silently fall back
   to a system face. Most visible on the homepage eyebrow `成立于 2005 · 总部纽约 …`.
   Note `newsTokens.ts` uses **JetBrains** Mono while `site.css` uses **IBM Plex** Mono —
   two different fonts for one role; this collapses them.
5. Letter-spacing capped at 0.1em — removes the 0.3em on 专题栏目.
6. `tabular-nums` on the 4.64 亿 counter, plus a source and 更新于 date line. We now have
   the hourly santui sync, so that date can be real rather than decorative.
7. **`em` instead of `ch` for line length.** `ch` is the width of the "0" glyph, so the
   measure changes whenever the body font changes — step 1 demonstrated this by moving the
   article column 52px. For Chinese, where Han glyphs are 1em wide, `38em` means
   "38 characters per line" and `62ch` means nothing in particular.

Adopted as editable defaults, not law:

8. The 7-size ladder (48/36/24/18/17/14/13). Her 17px body is larger than today's 16px —
   defensible for Chinese, but it reflows every page, so it ships as a token set to the
   current value and gets raised in the admin while watching.

Not adopted:

- Removing the `01 · 登记` card numbers — editorial preference, and the numbering earns its
  place on the services grid.
- Her rewritten sample copy — that is Ingrid's own editing work, not theme configuration.

Component-level, not theme (tracked separately):

- `white-space: nowrap` on proper nouns, so 《民族团结法》 stops breaking across lines.
- `text-wrap: balance` on headings, `pretty` on paragraphs.
- A `zh-Hant` edition with its own `<html lang>` — a larger piece of work, out of scope here.

---

## 7. Guardrails

- **The screenshot harness built in step 1** runs before and after every slice: 4 pages ×
  3 widths, recording resolved font, weight, size, line-height, tracking, page height and
  horizontal overflow, plus a pixel diff.
- **`npm run build:check`**, never plain `npm run build` — the latter kills the running dev
  server.
- **Every phase is independently revertible.** Phase 0 is a pure refactor; phase 1 is
  per-slice; phase 3 is per-dial; and deleting the `site.theme` row reverts the whole
  admin layer.
- **No phase changes content.** No article bodies, no category assignments, no uploads.

## 8. What the theme deliberately will not control

To keep the editor honest about its own reach: page structure and section order (that is
the homepage CMS), which components appear on a page, image assets, and the admin's own
styling. A theme that claims to control layout variants it cannot actually change is worse
than one with a smaller, truthful scope.

## 9. Open decisions

| question | needs deciding by |
|---|---|
| Do we want the serif at weight 600 back? It doubles the font payload (1,017 KB → 1,885 KB) for 46 list-title rules that currently resolve to 700. | before phase 3 |
| Preset names and how many ship (the clinic has 6). | phase 2 |
| Whether the 繁體 edition is in scope this quarter — it affects the font role menu. | before phase 2 |

---

## Appendix: what step 1 changed

| | before | after |
|---|---|---|
| Chinese webfonts loaded | 0 | Noto Serif SC 700, self-hosted |
| `font-weight: 900` | 90 declarations | 0 |
| Hardcoded font stacks | 7 | 0 |
| Font bytes, first page | 0 | 1,017 KB |
| Font bytes, pages after | 0 | ~65 KB |

Body text now uses the reader's own CJK face (PingFang SC / Microsoft YaHei) rather than a
webfont: serving 4,400 characters of Chinese prose from Noto Serif SC cost ~2.8 MB in
unicode-range slices, and the OS faces were never the broken part. The webfont is for
headings, where Windows was synthesising bold from SimSun.

Files: `fonts.ts` (new), `layout.tsx`, `globals.css`, `site.css`, `newsTokens.ts`,
`VideoParts.tsx`, plus 13 components for inline weights.


---

## Appendix B: what shipped

All four phases were implemented and verified in a real browser (Playwright, 9 pages ×
3 widths = 27 combinations, re-run after every phase).

### Measured outcome against Ingrid's acceptance checklist

| her check | before | after |
|---|---|---|
| CSS 裏搜不到 `font-weight: 900` | 90 declarations | **0** |
| 中文不再使用 IBM Plex Mono | 30 classes | **0** (verified in-browser, not by grep) |
| 沒有小於 12px 的字號 | 44 CSS + 36 inline | **0** |
| 中文字距都不超過 0.1em | 9 over | **0** |
| 所有 h1–h3 的行距在 1.25–1.4 | inherited body 1.75 | **1.3 / 1.4 via tokens** |
| 內文只有一個行距 | 1.8 / 1.85 / 1.95 / 2.05 | **one token** |
| 開發者工具能看到 Noto 字體載入 | 0 webfonts | **Noto Serif SC 700, self-hosted** |
| 標題不拆開專有名詞 | 《民族团结法》 split | **held on one line at 1440/834/390** |
| 統計數字有來源和更新日期 | none | **来源…· 更新于 \<date\> from the santui sync** |

Also: 298 hardcoded colours (71 in components, 227 in CSS) now resolve through the theme,
and the two competing monospace fonts (IBM Plex / JetBrains) were collapsed into one role.

### Where the plan changed on contact with the code

- **`ch` → `em` conversion was not a straight swap.** 15 rules, converted with a per-value
  table rather than a ratio, because `62ch` and `56ch` had been picked by eye against a
  font that was never actually loading.
- **The 13px floor caused one regression the plan did not predict**: date stamps in the
  narrow 最新发布 sidebar started wrapping (`09-` / `29`). Fixed by marking the 14 date
  spans `nowrap` — a date is one token and should never break.
- **Serif ships at weight 700 only.** Adding 600 doubled the font payload (1,017 KB →
  1,885 KB) for 46 list-title rules. CSS font matching resolves 600 to 700 with no
  synthetic bold, so nothing looks wrong.
- **Body text moved off the webfont entirely** to the reader's own CJK face. Serving
  4,400 characters of Chinese prose from Noto Serif SC cost ~2.8 MB of unicode-range
  slices; the OS faces (PingFang SC / Microsoft YaHei) were never the broken part.
- **Body size stayed at 16px**, not Ingrid's 17px, exactly as §6 item 8 planned: it ships
  as a token at today's value for an editor to raise in the admin while watching.

### Admin

`/admin/theme` — preset picker (紫金 / 墨蓝 / 墨金), 35 colour fields, the size ladder,
line-heights, tracking, measure, shape and spacing, with a live same-origin preview that
tracks every keystroke. Writes `site.theme` to `cms_site_settings`; **「恢复默认」 deletes
the row** rather than writing defaults into it, so reverting is total. Round-trip verified:
preview → save → public site → reset.
