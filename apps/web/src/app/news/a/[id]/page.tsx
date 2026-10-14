import { notFound, redirect } from "next/navigation";
import { getArticleSlugByLegacyId } from "@/lib/public-content";
import { isKnownLegacyId } from "@/lib/legacy-redirect-ids";

/**
 * `/news/a/<id>` -- an article by the post id the old site gave it.
 *
 * Stored page content (the homepage cards, the video episode rows) links here
 * rather than to `/news/<title>`, so that retitling an article in the admin
 * cannot break the pages pointing at it. This route only resolves an id to the
 * current slug; the listing and article pages are untouched.
 *
 * This route had no `maxDuration`, so it inherited Vercel's 300-second
 * default -- the exact condition that took the database down on 2026-10-13,
 * where each stuck render held a connection for five minutes. It matters here
 * more than almost anywhere else, because the legacy middleware redirects
 * *into* this route, and the flood is aimed at a legacy URL.
 */
export const maxDuration = 15;

/*
 * Cacheable, so a repeated id is answered without a second database query.
 * The empty array is not a placeholder: a dynamic segment stays dynamic, and
 * keeps `cache-control: no-store`, unless `generateStaticParams` exists at
 * all. Returning nothing from it means "prerender none up front, but let each
 * one be cached once it has been built".
 */
export const revalidate = 3600;
export async function generateStaticParams() {
  return [];
}

export default async function LegacyArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const legacyId = Number(id);

  /*
   * Hardening the middleware alone would have been theatre: this route is the
   * middleware's destination, but nothing stops a request coming straight
   * here, and then every invented id is a database query again.
   *
   * The same shipped set answers "could this id resolve at all?" without
   * asking Postgres. It is a superset of what the query below can match -- it
   * is built from cms_articles.legacy_id as well as the redirect map -- so an
   * id it rejects could never have resolved anyway.
   */
  if (!Number.isInteger(legacyId) || !isKnownLegacyId(legacyId)) notFound();

  const slug = await getArticleSlugByLegacyId(legacyId);
  if (!slug) notFound();
  redirect(`/news/${encodeURIComponent(slug)}`);
}
