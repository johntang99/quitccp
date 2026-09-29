# 文章管理 — 设计稿 / Article management design

Static mockups for the article-management redesign. **Design only — nothing here
is implemented.** Open `index.html` for the design notes and the open questions;
the other five pages are the screens.

| file | tab | what it is |
|---|---|---|
| `index.html` | 设计说明 | decisions taken, fields the database still needs, questions for you |
| `new.html` | A · 新建文章 | the full article form + markdown editor |
| `update.html` | B · 查找与修改 | search, filters, results table, bulk actions, delete confirmation |
| `latest.html` | C · 最新 100 篇 | the same table without the search step |
| `status.html` | D · 文章统计 | totals, per-category counts, 30-day trend, data-quality gaps |
| `edit.html` | (from B/C) | the same form in edit mode — status bar, revisions, concurrent-edit warning |

## Viewing

Open the files directly, or serve the folder:

    python3 -m http.server 4099 --directory docs/prototypes/admin-articles

## Why this exists

`/admin/articles` today can only list, review and delete. There is **no create
or edit screen at all** — the write endpoint exists but nothing uses it. So this
is not a restyle of an existing feature; it is the missing half of it.
