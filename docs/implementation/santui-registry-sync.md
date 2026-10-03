# Santui Registry Sync

The homepage 实时登记册 band — the 4.66 亿 figure and the ten scrolling
declarations — is filled from **santui.tuidang.org**, not typed by an editor.

**A scheduled browser scrapes santui hourly and writes a snapshot to Supabase;
the site reads the snapshot.** The page never calls santui.

## Why it is not a plain fetch

santui.tuidang.org sits behind a **Cloudflare managed challenge**. Every plain
HTTP client — `curl`, `undici`, `fetch()` in a route handler — gets a 403
"Just a moment…" interstitial on *every* path, `/stat/statics` included. Only a
real browser that runs the challenge script gets through.

```
curl https://santui.tuidang.org/stat/statics      ->  403  "Just a moment..."
curl https://santui.tuidang.org/index/showpage/…  ->  403  "Just a moment..."
chromium (Playwright)                             ->  200  ✓
```

So fetching at request time from a Vercel route is impossible. A scheduled job
runs the browser instead. That is the better shape regardless:

- the homepage never waits on a third party;
- santui being slow, blocked or down cannot take the band with it;
- the figure moves a few tens of thousands a day against 466 million, so hourly
  is already finer-grained than the data.

## Flow

```
GitHub Actions (hourly, :17)
      │
      ├─▶ chromium ──▶ santui /stat/statics            (count, as XML)
      │           └──▶ santui /index/showpage/type/2   (精彩推荐 declarations)
      │
      └─▶ cms_content_entries  path = "feeds/santui.json"
                    │
                    ▼
            lib/santui.ts  ──▶  HomeTemplate  ──▶  DawnBand
```

## Sources

| source | what it gives | why this one |
|---|---|---|
| `/stat/statics` | `<TOTAL>466,912,443</TOTAL>`, `<LASTUPDATE>` | santui publishes this itself as 统计数据 XML — the publisher's own machine-readable figure, rather than scraping their rendered page |
| `/index/showpage/type/2` | 精彩推荐, 15 declarations per page | `type/1` is 最新声明 and `type/3` is 声援和评论; **2** is the curated set |

Declarations are parsed **through the DOM**, matching on the 声明人 / 时间 /
来自 labels and taking each one's next element. The markup nests unclosed
`<span>`s and pads everything with `&nbsp;`, which no regex survives.

## Pieces

| file | role |
|---|---|
| `scripts/sync-santui.ts` | the scraper; `npm run sync:santui` |
| `.github/workflows/sync-santui.yml` | hourly schedule + manual trigger |
| `apps/web/src/lib/santui.ts` | reads the snapshot, formats the figure |
| `apps/web/src/components/templates/HomeTemplate.tsx` | injects count + feed |

## The stored snapshot

`cms_content_entries`, `path = "feeds/santui.json"`, `locale = "zh"` — the same
table the homepage CMS content lives in, so **no migration was needed**.

```json
{
  "total": 466912443,
  "totalDisplay": "466,912,443",
  "sourceUpdatedAt": "2026-10-02 01:59:55",
  "fetchedAt": "2026-10-01T18:00:42.730Z",
  "declarations": [
    {
      "id": "34433563",
      "name": "刘树才",
      "from": "河北",
      "people": "1",
      "at": "2026-10-01",
      "text": "我叫刘树才，早年参加过国共战争…",
      "href": "https://santui.tuidang.org/index/showpost/id/34433563"
    }
  ]
}
```

## The count is truncated, never rounded

466,911,794 is shown as **4.66 亿**, not 4.67.

A registry count is a floor: every declaration behind it is a real one, and
rounding up would claim declarations nobody made. santui presents the figure the
same way. See `formatYi()` in `lib/santui.ts` — do not "fix" it to `toFixed()`.

## Failure behaviour

Degradation is deliberate at every step:

1. **Snapshot present** → live count and real declarations.
2. **No snapshot / unreachable Supabase** → the figures stored in the homepage
   CMS, and `streamEntries` in `HomeTemplate.tsx`.
3. Those `streamEntries` are **placeholders that read as real people and are
   not**. A deployment showing them is misconfigured, not merely stale.

The sync writes nothing unless *both* sources parse, so a half-failed run leaves
the last good snapshot in place rather than blanking the band.

## Running it

```bash
npm run sync:santui              # fetch and store
npm run sync:santui -- --dry-run # fetch and print, write nothing
```

Needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (read from the repo-root
`.env.local`), and a browser: `npx playwright install chromium`.

## GitHub Actions

**Schedule:** `cron: "17 * * * *"` — every hour at :17. Plus `workflow_dispatch`
for manual runs.

**Secrets** — repository secrets (Settings → Secrets and variables → Actions):

| name | value |
|---|---|
| `SUPABASE_URL` | same as `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | same as `.env.local` |

Repository secrets, **not** environment secrets. Environment secrets are only
visible to a job that names that environment, and naming one would file a bogus
deployment record on every hourly run.

**Run it by hand:** Actions → *Sync santui registry* → Run workflow.

### Two settings that are load-bearing

- **`node-version: 22`.** On Node 20, `createClient()` throws *"Node.js detected
  but native WebSocket not found"* — supabase-js builds a realtime client that
  needs a global `WebSocket`. The scrape succeeds and the write fails.
- **`timeout-minutes: 10`.** The Supabase client keeps a realtime heartbeat
  alive, so the process can sit idle after the work is done. The script now
  exits explicitly, and this cap means a stuck run cannot hold the hourly
  schedule for GitHub's default six hours.

### Scheduled runs only fire from the default branch

GitHub only honours `schedule:` on the default branch. Changes to this workflow
have no effect on the hourly run until they are on `main`.

## Vercel

**Nothing to configure.** The site reads the snapshot through the Supabase
credentials it already needs for everything else. No new environment variable,
no cron, no function.

`playwright` is a **devDependency** and is imported lazily, inside
`scripts/sync-santui.ts` only — it never enters the web bundle. The npm package
declares no install hooks, so a Vercel build does not download a browser.

## If santui changes

The scrape is the fragile part, by nature. Symptoms and where to look:

| symptom | cause | fix |
|---|---|---|
| `Cloudflare challenge did not clear` | harder challenge, or the runner's IP is being treated differently | run the sync from a machine whose IP clears it, or ask tuidang to allowlist |
| `No <TOTAL> in /stat/statics` | the XML changed shape | update `readTotal()` |
| `No declarations parsed from 精彩推荐` | the 精彩推荐 markup or labels changed | update the DOM script in `readDeclarations()` |

The site keeps serving the last good snapshot throughout, so a broken scrape
shows stale numbers rather than an empty band. **The real fix is upstream**: the
two sites belong to the same organisation, so a small JSON endpoint on santui
would replace this whole job with a plain `fetch()`.


## 声明 cards: what is captured and shown

Each 精彩推荐 row carries six fields. The card shows five of them:

| source field | stored as | on the card |
|---|---|---|
| 标题 (the link text) | `title` | **yes** — gold line above the attribution |
| 声明人 | `name` | yes |
| 人数 | `people` | **yes** — rendered as `4人` |
| 来自 | `from` | yes |
| 时间 | `at` | date only; the time of day is dropped |
| ID | `id` | yes, as `No. 34,438,344` |
| （全文） | `href` | stored, not linked — the card is deliberately not clickable |

**标题 is written by the declarant, so it varies**: 退党团队, 退团队, 三退声明,
自愿退出中共党、团、队组织, 退出中共共青团和少先队组织. It is the only field that says
*which* organisations were quit, which the old hardcoded "退" could not. Rows without one
fall back to 三退声明.

### Card layout

The statement shows **three lines**, clamped. Declarations run to hundreds of characters,
so three lines is a window, not the whole text — the marquee needs every card the same
height (191px) to loop without jumping.

标题 and attribution share one row: `标题 · 声明人 · 人数 · 来自`. The row never wraps,
for the same height reason, so a long line elides instead. How the space is divided:

- **标题 keeps its full width, capped at 60% of the row.** Most are three or four
  characters and must never be clipped; the occasional thirteen-character one
  (退出中共共青团和少先队组织) is capped so it cannot starve the name beside it.
- **声明人 takes what is left and elides its tail**, so 来自 is what disappears first.

At 1440px, 2 of 20 cards elide; at 390px (where cards narrow to 280px), 8 of 20 do. The
alternative would be moving 来自 up to the ID/date row, which buys about three characters
— not enough for the longest entries, and it crowds a row that is already tight on a phone.

**人数 only appears when a statement speaks for more than one person.** "1人" is noise.

## Knowing if the sync has stopped

Two things worth being aware of:

- **GitHub disables scheduled workflows in a repository with no commit activity for 60
  days.** If development pauses, this job stops silently and nothing says so.
- A failed run is only visible in the Actions tab; there is no alert.

There is no staleness guard in the app: `getSantuiSnapshot()` accepts any snapshot with a
positive total, so a dead sync keeps showing the last figure indefinitely. The 更新于 date
under the headline figure is currently the only visible signal — if it stops advancing,
the sync has stopped.


## Where the schedule runs (and why it moved off GitHub Actions)

**The source needs a real browser.** Every path on santui.tuidang.org answers plain HTTP
with `403` and a Cloudflare challenge — `/`, `/stat/statics` and the 精彩推荐 page alike.
That rules out anything that can only make HTTP requests, including **Supabase `pg_cron` +
`pg_net`**, a plain Vercel route, and a free-plan Cloudflare Worker.

**GitHub Actions was missing runs.** On 2026-10-03 the last sync was 00:32 UTC with three
hourly runs skipped. GitHub also disables scheduled workflows after 60 days with no
commits, which would stop this silently once the project goes quiet.

**The data does not need hourly.** Measured rate: ~9,800 declarations/day against 466
million. The homepage figure (4.66 亿) changes roughly three times a year; the twelve
rotating 声明 are the only part that moves day to day.

So: **Vercel Cron every six hours**, driving a hosted browser over a WebSocket.

```
vercel.json  crons: [{ path: "/api/cron/santui", schedule: "17 */6 * * *" }]
       │
       ▼
/api/cron/santui   playwright-core, no browser binaries (~13MB)
       │  chromium.connectOverCDP(BROWSER_WS_ENDPOINT)
       ▼
hosted browser (Browserbase / Browserless)
       │
       ▼
lib/santui-scrape.ts  ── shared with scripts/sync-santui.ts
       ▼
cms_content_entries['feeds/santui.json'] → revalidatePath("/", "layout")
```

### Required environment variables

| name | what |
|---|---|
| `BROWSER_WS_ENDPOINT` | the vendor's WebSocket URL, including its token |
| `BROWSER_WS_MODE` | `cdp` (default) or `playwright` — Browserbase and Browserless v2 are CDP |
| `CRON_SECRET` | Vercel sends it as `Authorization: Bearer …`; the route rejects callers without it |

The route also accepts an **admin session**, so a run can be triggered by hand while
signed in to the CMS.

### vercel.json lives in apps/web

Vercel reads `vercel.json` from the project's Root Directory, and this project's is
**`apps/web`** (Settings → Build and Deployment → Root Directory). So the cron config is
`apps/web/vercel.json`. A copy at the repo root would be silently ignored — there was one
briefly, and it has been removed.

### The scrape itself is shared, not duplicated

`apps/web/src/lib/santui-scrape.ts` holds the Cloudflare wait, the `<TOTAL>` read and the
精彩推荐 DOM parsing. It imports no browser — the caller passes in an open page — so the
same code serves the local script and the serverless route, and the two cannot drift.

### GitHub Actions is kept as the manual fallback

The workflow still exists with `workflow_dispatch` only, no schedule. It runs the same
script against a real browser on a real runner, so it is the recovery path if the
hosted-browser vendor is unavailable.

### The vendor: Browserless

`wss://production-sfo.browserless.io/chromium?token=…` with `BROWSER_WS_MODE=cdp`. It was
chosen over Browserbase for two reasons, both found by reading their docs rather than
assuming:

- **Browserbase has no static connect URL.** It requires an SDK call to create a session
  first, then connects to the URL that returns — which would mean extra code and two more
  secrets. Browserless publishes a static URL, so it drops straight into one env var.
- **Its free tier fits.** Browserless gives 1,000 units/month free, where a unit is up to
  30 seconds of browser time. A run takes ~3–5s, so **1 unit per run**: 120 units/month at
  six-hourly, or 720 if it were hourly — both inside the free allowance. Browserbase's free
  tier is 1 browser hour with a **one-minute minimum per session**, so the same six-hourly
  schedule would bill 2 hours and need the $20/month plan.

### Verified in production, 2026-10-03

The run triggered from Vercel's Cron Jobs page returned `200`, and the snapshot it wrote
carries `updated_by: cron:santui` — the route's own signature, which the local script and
the GitHub workflow never write. So the whole chain is proven, not inferred:

| step | evidence |
|---|---|
| Vercel Cron fires | `GET 200 /api/cron/santui` in the project logs |
| the secret works | an unauthenticated `GET` returns `401` |
| Browserless connects | run succeeded from the serverless function |
| **Cloudflare cleared from a datacenter IP** | real data returned, no challenge |
| Supabase written | `updated_by: cron:santui` |
| 标题 captured | **12/12** |
| homepage revalidated | production rendered the new titles immediately |

Four local runs through Browserless took **2.9–4.9s** each, every one returning 12/12
titles and never seeing a challenge. The route allows `maxDuration = 300` (the Vercel Pro
ceiling), which is far more than a run needs.

### How it is monitored

The admin dashboard (`/admin/dashboard`) carries a 登记册同步 panel: the figure, the exact
total, how many 声明 are in rotation, how long ago the last sync ran, and a状态 badge.

`SYNC_INTERVAL_HOURS` in `lib/admin/dashboard.ts` **must match the cron in
`apps/web/vercel.json`** — the badge thresholds derive from it:

| badge | when |
|---|---|
| 正常运行 | age ≤ one interval × 2 + 2h (14h at six-hourly) |
| 有延迟 | age ≤ 24h |
| 疑似停止 | older |

The window has to allow a full interval plus one missed run, or a healthy job reads as
late. When the badge is not 正常运行 the panel prints an ordered checklist: the Vercel
cron, the Browserless unit balance, the three env vars, and the GitHub workflow as the
manual fallback.

**Nothing on the public site notices when this job dies** — the figure simply freezes at
whatever it last read, with no error. That panel is the only signal.
