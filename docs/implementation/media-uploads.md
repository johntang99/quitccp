# Media Uploads

Ported from the pattern already in use on the clinic sites
(`medical-clinic/chinese-medicine`): **Storage holds the bytes, a table holds
the index, and content JSON only ever stores a public URL.**

## Flow

```
ImagePickerModal  ──upload──▶  POST /api/admin/media/upload
                                   │
                                   ├─▶ Supabase Storage  (bucket: media)
                                   │      objectPath = <folder>/<ts>-<safe-name>
                                   │
                                   ├─▶ cms_media_assets  (index row)
                                   │
                                   └─▶ { url }  ──▶ updateField(path, url)
                                                      └─▶ pages/home.json
```

An editor never types a URL unless they want to: they press 选择图片…, either
upload a file or pick one already in the library, and the public URL is written
into the JSON field. Pasting a URL is still supported — that is how the existing
`tuidang.org/wp-content/...` images are referenced.

## Pieces

| file | role |
|---|---|
| `app/api/admin/media/upload/route.ts` | multipart → Storage → index row → `{ url }` |
| `app/api/admin/media/list/route.ts` | library listing + `uploadEnabled` flag |
| `app/api/admin/media/delete/route.ts` | removes the object **and** the index row |
| `lib/admin/media-storage.ts` | storage/table helpers, audited |
| `components/admin/ImagePickerModal.tsx` | library grid, upload, paste-a-URL |

Guards on upload: admin session, write role, MFA policy, multipart only,
`image/*` allow-list (JPEG/PNG/WebP/GIF/AVIF), 5MB cap, and a sanitised
folder/filename so an upload cannot climb out of its prefix.

Reads and writes are audited to `cms_audit_logs` as `media.upload` /
`media.list` / `media.delete`.

## Configuration

`SUPABASE_STORAGE_BUCKET=media` must be set **in every environment**, including
Vercel — it was previously in `.env.example` and the root `.env.local` but
missing from `apps/web/.env.local`, which is the file Next actually loads, so
the value was never read. Without it the upload route returns 501 and the picker
explains why instead of failing on the button press.

The bucket must be **public**, since the site renders the URLs directly.
There is deliberately no local-disk fallback: Vercel's filesystem is read-only,
so a fallback would work in dev and silently fail in production.

## Where the picker appears

Any homepage text field named `image`, `poster` or `backgroundImage`
(`HOME_IMAGE_FIELDS` in `ContentExplorer`) gets a 选择图片… button plus a
thumbnail and a 清除 button.

`hero.gallery[]` and `hero.video` have purpose-built editors (see
`HomeSectionsEditor`), so the picker reaches those too.

Still JSON-only: `news.lead.image`, `news.items[].image`,
`video.items[].image`, `channels.cards[].image`, `voices.items[].image`. Those
need the same per-item row treatment the gallery got.

> **Bug this depended on:** `setAtPath` replaced any array it traversed with
> `{}`, so writing `["hero","gallery","0","src"]` destroyed the whole gallery.
> It now creates an array when the next path segment is a numeric index and
> leaves existing arrays alone. Nothing could edit an array item before this.
