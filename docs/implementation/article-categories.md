# Article categories (admin)

`/admin/categories` manages the categories articles are filed under.

## Chinese names, latin slugs

The name is free text and is meant to be Chinese — it is what editors and
readers see. The slug stays latin because it appears in URLs: a CJK slug is
percent-encoded into something unreadable and awkward to paste or share.

`toSlug()` keeps CJK characters, so auto-generating a slug from a Chinese name
would have produced exactly that. `resolveCategorySlug()` therefore refuses it:
a name with no latin characters must be given a slug explicitly, and the admin
shows the reason in its error banner rather than silently creating a bad URL.

Current categories, renamed from the English placeholders the WordPress import
left behind:

| slug | name | source |
|---|---|---|
| `withdrawal-news` | 三退要闻 | `docs/prototypes/news/...` — "含原「三退要闻」…全部内容" |
| `withdrawal-stories` | 退党纪实故事 | same sentence — "…「退党纪实故事」全部内容" |
| `red-regime-collapse` | 红朝败象 | inferred from the import's `hcbx` taxonomy key (红朝败象); **worth confirming** |
| `news` | 新闻 | generic; holds no articles |

## Ordering

Categories used to list alphabetically by name, which says nothing useful once
the names are Chinese — codepoint order is neither pinyin nor stroke order, let
alone editorial importance. `sort_order` carries the intended order (lower
first, name as the tie-break) and is editable per row. Since migration `031` it
orders the public news tabs too, not just this admin list.

> **Requires `supabase/content/migrations/009_category_sort_order.sql`.**
> That migration has to be run by hand against the content database, like every
> other migration in this project.
>
> Until it is, the admin keeps working and simply ignores the order: every row
> reads 0, the list stays alphabetical, and a saved order is dropped silently.
> `isMissingSortOrder()` in `lib/admin/repository.ts` detects the missing column
> and retries without it, on both the read and the write. The moment the column
> exists, ordering starts working with no further code change.

## What the page edits

Each row is one category. Five columns, two buttons:

| column | stored in | what it reaches |
|---|---|---|
| 排序 `sort_order` | database | the order of the public news tabs, and of this admin list. |
| 名称 `name` | database | everywhere readers see the category: the tabs, the listing's own title, the card kickers. |
| slug | database | the page's address. Read-only once created — see below. |
| 页面说明 `description` | database | the sentence under the title on `/news/<slug>`. |
| 文章数 | derived | read-only. |

`description` is new; it needs
`supabase/content/migrations/030_article_category_description.sql`. Nothing was
seeded: the eight listings start empty on purpose, so the sentence under each
title is whatever an editor writes rather than something a migration invented.
Left empty, the page falls back to the eyebrow it always had — `SLUG · N 篇`,
which is a URL and a count, not an introduction.

更新 and 删除 sit in one row, same width, and are handled by
`components/admin/CategoryRowActions.tsx`, shared with the video categories.
更新 shows that it is working; 删除 asks first, because a category cannot be
restored. A delete is refused while articles are still mapped to the category —
move them first.

## What a save reaches, and when

Saving a row calls `revalidateNews()`, which marks sixteen addresses stale: `/`,
`/news`, and each of the twelve `/news/<listing>` pages. Nothing is rendered at
save time; the next reader of each page gets a freshly generated one.

Measured on production, 2026-10-16, by saving a category and watching the CDN:

```
/                       PRERENDER → REVALIDATED
/news                   PRERENDER → REVALIDATED
/news/withdrawal-news   HIT       → REVALIDATED
/news/archive           HIT       → REVALIDATED
/news/latest            HIT       → REVALIDATED
```

So an edited 页面说明 is visible on the next page load. Two things lag, both by
design and both documented where they live:

- `/news/<slug>/chunk/N`, the infinite scroll's chunks, sit in the CDN's
  time-based cache, which `revalidatePath` cannot reach. They age out on their
  own within 30 seconds. See the comment in that route.
- Article pages (`/news/<article-slug>`) are not in the list. They carry the
  category name in their breadcrumb, so a rename reaches them only when their
  own 300s window expires.

## The slug is the one field an editor cannot change

Names, 页面说明 and 排序 are the editors'. The slug is not, and the admin shows
it as plain text in its own column rather than an input.

It is the category page's address. Changing it took that page offline twice
over: the new slug is not in `NEWS_CATEGORIES`, so `/news/<new>` 404s, and the
old slug no longer matched a database row, so `/news/<old>` 404s as well —
along with every inbound link and every search result pointing at it. The admin
offered the field anyway, right next to the name, with no hint that the two
behaved nothing alike.

`upsertCategoryRecord()` enforces it rather than trusting the form: an update
builds its payload without `slug` at all, so a POST that carries one is ignored.
Verified by posting `slug=hacked-slug` against a real session — HTTP 303, and
the stored slug unchanged. Creating a category still takes one, since a new row
needs an address.

## What the public side reads, and from where

| | source |
|---|---|
| tab names, listing `<h1>`, card kickers | database — `getNewsCategoryTabs()` and the category row |
| tab order | database `sort_order`, ascending, name as tie-break |
| which categories are public at all | `NEWS_CATEGORIES` in `lib/public-content.ts` — a slug whitelist |
| the English eyebrow (`WITHDRAWAL NEWS`) | `NEWS_CATEGORIES`; nothing in the admin edits it |
| the names in `NEWS_CATEGORIES` | **fallback only**, used when the database cannot be read |

The whitelist stays a code change on purpose: `/news/<slug>` is an address the
site commits to, and eighteen categories exist in the database while only eight
are meant to be sections of the news. This is why 文化音乐, 资料下载, 待归类 and
the rest have no page — `/news/culture-music` is a 404 today, and adding it
means adding a line to that array.

Proved rather than assumed: with the constant's name for `famous-quitccp`
replaced by a placeholder locally, the page still rendered 名人退党 27 times and
the placeholder zero times.

One consequence of making names editable: the homepage's channel columns are
configured by category *name*, in the homepage settings. `getNewsBand()` matches
an asked-for name against both the editors' current names and the constant's, so
a rename does not silently empty a homepage column.

> **Requires `supabase/content/migrations/031_news_category_order.sql`.**
> `sort_order` held leftovers from the WordPress import (1, 3, 4, 5, 10, 12, 25,
> 30), which would have reshuffled the tab bar the moment the code above
> shipped. The migration numbers the eight public categories 1..8 in exactly the
> order the site showed before, so the deploy moved nothing, and pushes the ten
> non-public categories to 100+ so the admin list does not interleave them.
