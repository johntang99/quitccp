# 站内搜索

How the search box works, what it covers, what it cannot do, and what to check
when it misbehaves. Written 2026-10-04, against the code in production.

---

## The short answer to "do we index the content?"

**Partly, and not the way most people mean it.**

Production does **not** use a search engine. There is no Meilisearch instance
reachable from Vercel, so search queries the database directly on every request.

What *is* indexed are two Postgres trigram indexes per table — on the short
columns only:

| table | column | indexed | why |
|---|---|---|---|
| `cms_articles` | `title` | ✅ | migration 020 |
| `cms_articles` | `summary` | ✅ | migration 020 |
| `cms_articles` | `body_plain` | ❌ | **dropped by 021 — it stopped editors saving** |
| `cms_videos` | `title`, `description` | ✅ | migration 020 |
| `cms_materials` | — | ❌ | 21 rows; an index costs more to maintain than the scan it saves |

So titles and summaries are indexed; **article bodies are searched by sequential
scan**. That is a deliberate choice, explained under *Why the body index was
removed*.

A Meilisearch index does exist on the developer machine (16,281 documents) and
all the code to use it is finished and tested — but production has never used it.
See *Meilisearch* below.

---

## What is searchable

Three content types, in one merged result list:

- **文章** `cms_articles` — title, summary, body
- **视频** `cms_videos` — title, description, speaker, body
- **资料** `cms_materials` — title, summary, body

**Deliberately not searchable: 三退声明 and 退党证明.** The `declarations` and
`certificates` tables appear in neither backend. Those lookups live on
santui.tuidang.org and service.tuidang.org, and the results page links to both.
This matters beyond tidiness: it means nobody's declaration can be found through
this box, and it is why the zero-result log (below) is not a record of personal
searches.

---

## How a query is answered

### 1. The query is split into terms

Split on whitespace, half-width and full-width (`　`, what a Chinese IME
produces). Every term must appear. Capped at six terms.

Before this, `法轮功 迫害` was one literal substring, space included, and matched
essentially nothing — it returned 0 while 94 articles carried both words in
their title.

### 2. Each term expands to every form it could take

Two expansions, composed:

**繁簡 conversion** (`lib/zh-variants.ts`) — a generated table of 2,972
traditional→simplified and 2,630 simplified→traditional character pairs. Readers
in Taiwan, Hong Kong and much of the diaspora type traditional; this archive is
written almost entirely in simplified, and before this:

```
退黨    found 3      where 退党 found 1,667
法輪功  found 2      where 法轮功 found 410
共產黨  found 0      where 共产党 found 510
聲明    found 0      where 声明 found 183
```

The direction that matters — traditional query → simplified content — is
many-to-one and therefore unambiguous: 發 and 髮 both become 发, so there is
nothing to guess. Tested 20/20 on the hard cases (頭髮, 乾淨, 幹部, 麵條, 皇后).

The reverse direction picks one form and is occasionally wrong (头发 → 頭發),
but it exists only to reach the handful of traditionally-titled pieces.

**What it does not handle:** cross-strait *vocabulary*. 软件/軟體, 网络/網路,
视频/影片 are different words, not different characters, and no character table
bridges them. Rare here, where the vocabulary is political and shared.

**Synonyms** (`lib/search-synonyms.ts`) — measured before adding, because a
synonym list is a precision/recall trade:

```
三退    → 退党   1,573 articles a reader was missing
中共    → 共产党    535
三退    → 退团    165
ENDCCP → 打倒中共恶魔 145
活摘    → 强摘      25
```

Kept short on purpose. A merely topical pair — 迫害 and 酷刑, say — would bury
what someone asked for under what they did not.

### 3. Three tiers, best first

For each content type, in order, stopping once the page is full:

1. **title** — almost always what someone wanted, and indexed
2. **summary** — indexed
3. **body** — not indexed, the expensive one

They are **separate queries, not one `OR`**, because the database orders by date
*before* results can be ranked. With one combined query, thirty recent summary
matches fill the page and older title matches never appear — which is exactly
what 大纪元 did: 44 articles carried it in the title and none was the top result.

The three content types run in parallel; one failing does not take the others
down.

### 4. Ranking and deduplication

Score is `title match = 100`, `summary = 10`, `body = 1`, then newest first
within a band, then articles before videos on a tie.

**Deduplicated by title.** Much of this material exists as both an article and a
video under the same name — 15 of 30 slots on a search for 活摘器官 were the
same pieces twice.

---

## Performance, measured

Against 15,515 published articles (~120MB of body text):

| field | term | chars | time |
|---|---|---|---|
| title | 活摘器官 | 4 | 593ms |
| title | 疫情 | 2 | 288ms |
| summary | 活摘器官 | 4 | 413ms |
| body | 活摘器官 | 4 | 527ms |
| body | 法轮功 | 3 | 877ms |
| body | 疫情 | 2 | **2,130ms** |
| body | 香港 | 2 | **1,984ms** |

Typical end-to-end searches land at **0.5–1.0s**, because the title tier usually
fills the page and the body scan never runs.

The worst case is a rare combination of two short terms, where every tier runs
and finds little: `中共 冰岛` takes about **7 seconds** and returns 13 results.

**There is no time limit.** A budget was added and then removed on the owner's
instruction: finding the result matters more than finding it quickly. `中共 冰岛`
returned 0 under a 2.5s budget and returns its 13 results without one.
`maxDuration` is 60s on the search page and API so Vercel does not cut a long
scan off before the database does.

If the *database* ends a scan itself, the page says **「这次搜索用时过长，已经
停下」** rather than 没有匹配结果 — a search that stopped looking is not the same
as a subject the archive does not cover.

### Why the body index was removed

Migration 020 put a GIN trigram index on `body_plain`. It worked — a body search
for 活摘器官 went from 2,374ms to 598ms — and then it broke writing.

GIN indexes queue new entries in a pending list and make some unlucky writer
flush the lot. Once that list is large the flush cannot finish inside the 8s
statement timeout, and every writer after it inherits the same doomed flush. A
bulk content update tipped it over and **every write to `cms_articles` began
failing**, including one touching nothing but `updated_at`. Reads were fine, so
the site looked healthy while editing was dead.

Confirmed by elimination: `cms_materials` (no index) wrote in 515ms,
`cms_videos` (same index, small columns) in 259ms, `cms_articles` failed at 8.2s.

Migration 021 drops it. Title and summary indexes stay — small columns, and the
videos table demonstrates they are safe.

**Do not re-add an index on `body_plain` without solving the pending-list
problem first** (`fastupdate = off`, or a scheduled `gin_clean_pending_list()`).

---

## The results page

`/search?q=…&page=&sort=&type=`

- **20 per page**, pager elides the middle. Out-of-range and malformed values
  clamp rather than erroring: `page=999`, `page=-5`, `page=abc` all land
  somewhere real.
- **Type tabs with counts**, shown even at zero so an empty category reads as
  empty rather than as a tab leading nowhere.
- **Sort**: 按相关度 (default) or 最新优先.
- **Each result** shows `type · date`, the title, and an excerpt.
- **Matched words are marked** — *every form that matched*, not only what was
  typed. Searching 退黨 marks 退党; searching 三退 marks 退党 where the synonym is
  what matched. Without that, a result containing none of the typed characters
  looks like a mistake.
- Highlighting splits text into React nodes rather than building an HTML string.
  Titles are editor-supplied; assembling markup from them by hand is how a search
  page becomes an injection point.
- Fetches 200 and pages in memory. Past ten pages someone is narrowing down, not
  reading, so the header says the ceiling was reached.

---

## Zero-result log

`cms_search_misses`, migration 022. Shown in **Dashboard → 站内搜索 → 读者搜了
却没找到的词**, each phrase linking back to the search.

Narrow by design, because readers include people with family inside China:

- only searches returning **nothing** are written
- **no IP, no user agent, no session, no account, no per-search timestamp** —
  one row per distinct phrase with a counter. A frequency table, not a log
- single characters and phrases over 120 characters are ignored
- rows not seen in **60 days** are deleted by the weekly cron

Recording runs inside `after()`, so it happens once the reader already has their
page, and every function in `lib/search-misses.ts` swallows its own errors. A
missing table is a silent no-op.

A frequent miss means one of two things: the archive lacks that material, or it
uses different words than readers do — and the second is a line in the synonym
table.

---

## Meilisearch

Built, tested, and **not in use**.

The code is complete: a single index holding all three content types with a
`type` field, save-time indexing on eight write paths, an hourly incremental
cron, a weekly full pass that sweeps orphans, and dashboard health reporting.
Locally it answers in **12–36ms** against substring's 500–900ms, and handles
multi-word natively.

What is missing is a Meilisearch that Vercel can reach. The developer machine
runs one at `127.0.0.1:7700`, which to a serverless function is itself.

**To turn it on**, set in Vercel → Production:

```
MEILI_HOST            https://… a reachable instance
MEILI_SEARCH_API_KEY  a search-only key
MEILI_MASTER_KEY      admin key, used by the sync only
MEILI_INDEX_ARTICLES  articles
```

Redeploy, press 重建搜索索引 in 站点设置, confirm the dashboard shows index and
database counts matching, **then** set `SEARCH_PRIMARY_BACKEND=meilisearch` and
redeploy again. Substring remains the automatic fallback, so an outage degrades
instead of breaking.

Meilisearch the software is free (MIT). Meilisearch **Cloud** starts at $20/month
and is not required — any reachable host works.

### Why it is not on

Production works without it. Substring gives 繁簡, synonyms, multi-word, all
three content types, and content searchable the instant it is published — with
nothing to sync and nothing to go stale. Meilisearch buys roughly 30× speed and
better ranking. That is a refinement, not a fix.

It is also worth remembering how Meilisearch failed here before: the index sat
**seven weeks stale** while every sync reported success, because the sync
paginated with `OFFSET` and died of a statement timeout around row 7,500 every
time it ran. Search kept answering; the answers were just old. The pagination is
fixed and the freshness machinery is built, but a second copy of the data is a
second thing that can quietly disagree with the first.

---

## Backends, in order

`searchPublishedArticlesWithMeta` tries them in sequence:

1. `SEARCH_PRIMARY_BACKEND` — `substring` (current) or `meilisearch`
2. the other of those two
3. `fallback_ilike` — title only, last resort

An unrecognised value falls through to `substring`, not `pg_trgm`. **`pg_trgm`
is retained but must not be made primary**: trigram similarity scores
three-character windows built for Latin words, and against this corpus it
returned **0 results for 法轮功** while 410 published articles carried it in the
title. That is not a tuning problem; it is what trigrams mean for Chinese.

`SEARCH_DUAL_READ` runs a second backend for comparison logging. It should be
`false` in production.

---

## When something looks wrong

Start at **Dashboard → 站内搜索**. It runs a real query rather than reading a
flag, and compares the index against the database rather than trusting either
alone — both of this project's search failures were silent.

| badge | meaning | what to do |
|---|---|---|
| 正常 / 正常（数据库直查） | serving correctly | — |
| 已降级到备用后端 | the configured backend is unreachable | check the Meilisearch host |
| 索引与数据库不一致 | index and database counts disagree | 站点设置 → 重建搜索索引 |
| 搜不到结果 | a term the whole archive contains returned nothing | check Supabase, then `SEARCH_PRIMARY_BACKEND`, then `/api/search?q=三退` |

`/api/search?q=…` returns `backend`, `primaryBackend` and `dualReadEnabled`,
which is the quickest way to see which path answered.

---

## Files

| path | what |
|---|---|
| `lib/search-repository.ts` | backend selection and fallback chain |
| `lib/search-substring.ts` | the production backend: tiers, terms, ranking |
| `lib/zh-variants.ts` | generated 繁簡 table — do not edit by hand |
| `scripts/generate-zh-variants.mjs` | regenerates it (needs the `opencc-js` dev dependency) |
| `lib/search-synonyms.ts` | synonym groups — **edit here to add one** |
| `lib/search-misses.ts` | zero-result log |
| `lib/search-index.ts` | Meilisearch documents, sync, save-time indexing |
| `app/search/page.tsx` | the results page |
| `app/api/cron/search/route.ts` | hourly incremental, weekly full |
| `components/public/SearchHighlight.tsx` | marking matched words |

| migration | what |
|---|---|
| `020_search_trgm_indexes.sql` | trigram indexes |
| `021_drop_body_trgm_index.sql` | removes the body index — read before re-adding |
| `022_search_misses.sql` | zero-result table |

---

## Known limits

- **Two-character terms cannot use a trigram index.** 中共, 香港, 疫情, 三退 are
  among the most natural things to type. Postgres needs three characters.
  `pg_bigm` would fix this if Supabase offers it — unverified.
- **Cross-strait vocabulary** is not bridged (软件/軟體). Synonyms can cover
  specific cases.
- **No typo tolerance** and no English stemming (protest/protests).
- **Results cap at 200** before paging.
- **Cross-field matching is absent**: all terms must appear in the same field.
  Measured and deliberately not built — a `search_blob` column would cost ~120MB
  of duplicated text plus a large index to return 0.2–4% more results, because an
  article's body almost always already repeats the words in its title.
