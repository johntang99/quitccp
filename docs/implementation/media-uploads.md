# Media Uploads

Ported from the pattern already in use on the clinic sites
(`medical-clinic/chinese-medicine`): **Storage holds the bytes, a table holds
the index, and content JSON only ever stores a public URL.**

## Flow

```
ImagePickerModal  ──upload──▶  browser ▶ Supabase Storage (signed URL)
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

## Uploads never cross a function

The browser uploads **straight to Supabase Storage** using a short-lived signed
URL. Our API only issues the ticket:

```
browser ──[name, type, size]──▶ /uploads/sign ──▶ signed ticket
browser ──────────[bytes]──────────────────────▶ Supabase Storage
browser ──[path]──────────────▶ /uploads/register ──▶ cms_media_assets row
```

This is not an optimisation. A serverless request body is capped around 4.5MB in
production, and the previous uploader read the bytes in the route with its own
5MB limit -- so a 4.6MB image passed our check and then died at the edge, before
the code that would have explained why ever ran. It worked locally, where no
such limit exists. Measured against this project, Storage itself accepts at
least 200MB.

Going direct does not mean going unguarded: session, role, MFA, the type
allow-list and the size cap are all checked before a ticket exists, and the
destination path is built on the server rather than accepted from the client.

**Filenames.** Storage keys must be ASCII -- Supabase rejects anything else with
`Invalid key` -- so 历史重演惊人醒.zip cannot be stored under its own name. The
reader still gets it: downloadable files carry `?download=<original name>`, and
Supabase answers with `content-disposition: ...; filename*=UTF-8''...`. Images
deliberately do **not** carry it, or every `<img>` would try to save itself.

## Pieces

| file | role |
|---|---|
| `app/api/admin/content/uploads/sign/route.ts` | issues a signed upload ticket after the guards |
| `app/api/admin/content/uploads/register/route.ts` | records the finished upload in `cms_media_assets` |
| `lib/admin/upload-policy.ts` | the one place the limits and the allow-list live |
| `lib/admin/upload-client.ts` | browser side: sign → PUT with progress → register |
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
