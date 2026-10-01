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
