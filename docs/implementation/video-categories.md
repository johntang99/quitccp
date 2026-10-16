# Video categories (admin)

`/admin/video-categories` manages the series videos are filed under. Same rule
as the article categories, and most of the reasoning lives in
[article-categories.md](./article-categories.md) rather than being repeated
here: **names, 页面说明 and 排序 belong to the editors; the slug does not.**

## What the page edits

| column | stored in | what it reaches |
|---|---|---|
| 排序 `sort_order` | database | the order of the series chips on every `/videos` page, and of this admin list |
| 名称 `name` | database | the chips, the listing's own title, the kicker on a video's page |
| slug | database | the page's address. Read-only once created. |
| 页面说明 `description` | database | the sentence under the title on `/videos/<slug>` — the whole sentence, including the 「全部节目可自由下载、转载与再制作。」 line that used to be appended in code |
| 视频数 | derived | read-only |

## Why videos needed less work than articles

The public video side already read the database for all of it, so this was only
ever a lockdown, not a rewrite. `getVideoCategory()` takes `name` and
`description` straight off the row, and `listPublicVideoCategories()` orders by
`sort_order`. There was never a `VIDEO_CATEGORIES` constant to disagree with —
the articles had one, which is what made 名称 and 排序 half-dead there until
2026-10-16.

Verified on production the same day: the thirteen chips render in exactly the
database's `sort_order`, names included.

## The slug is read-only

`/videos/<slug>` is the page's address. Changing it moves the page and leaves
nothing behind: the old address stops answering, with no redirect, and every
link, bookmark and search result pointing at it breaks. The two are not
symmetric — renaming a series is free and is what an editor usually wants;
re-addressing it is not.

So the admin shows the slug as plain text in its own column, and
`upsertVideoCategory()` enforces it rather than trusting the form: an update
builds its payload without `slug` at all, so a POST that carries one is ignored.
Verified by posting `slug=hacked-video-slug` against a real session — HTTP 303,
and the stored slug unchanged. Creating a category still takes one, and still
refuses a Chinese-only name without an explicit latin slug, since a new row
needs an address.

## Unlike the articles, there is no whitelist

A video category becomes public by existing in the database. `/news/<slug>` has
a code-level whitelist because eighteen article categories exist and only eight
are meant to be sections of the news; every video category is a series readers
should be able to reach, so adding one in the admin is enough.

Two listing slugs are not categories at all — `archive` (全部视频) and
`featured` (重要影片) are `VIDEO_VIRTUAL_LISTINGS`, defined in code. A category
must not be given either slug.
