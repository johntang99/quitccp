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
first, name as the tie-break) and is editable per row.

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
| 排序 `sort_order` | database | the order of **this admin list**. Not the public tabs — see below. |
| 名称 `name` | database | the card kickers on `/news` and on the virtual listings. **Not** the category page's own title — see below. |
| slug | database | the article filing, and the lookup `/news/<slug>` does. Changing it takes the public page offline — see below. |
| 页面说明 `description` | database | the sentence under the title on `/news/<slug>`. Fully editable, and the only field here that does what it looks like it does. |
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

## Two fields that look editable and are not

For the eight categories that have a public listing page, `name` and `slug` are
**also** hardcoded, in `NEWS_CATEGORIES` in `lib/public-content.ts`. The public
side reads the code, not the database:

```ts
const meta = NEWS_CATEGORIES.find((row) => row.slug === slug);
if (!virtual && !meta) return null;
...
const name = virtual ? virtual.name : meta!.name;
```

Which means:

- **Renaming** a category in the admin changes the card kickers on `/news` and
  on the virtual listings, which read the database — but not the `<h1>` of
  `/news/<slug>`, nor the category tabs, which read the code. The two then
  disagree until the constant is edited too.
- **Changing a slug** takes the listing page offline. The new slug is not in
  `NEWS_CATEGORIES`, so `/news/<new>` 404s; the old slug is still in the code
  but no longer in the database, so `/news/<old>` 404s as well. Verified on
  production: `/news/culture-music`, `/news/culture` and
  `/news/resource-downloads` all return 404 today, for exactly this reason —
  they exist in the database and not in the code.
- **排序** orders this admin page. The public tabs follow the order of the
  `NEWS_CATEGORIES` array, so changing a number here does not move a tab.

This is why the ten other categories in the database — 文化音乐, 资料下载, 待归类
and the rest — have no page: a category only becomes public by being added to
that constant, which is a code change.

If an editor needs a rename or a reorder to show on the site, it is a one-line
edit to `NEWS_CATEGORIES` plus a deploy. 页面说明 is the field that needs
neither.
