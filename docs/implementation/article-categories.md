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
