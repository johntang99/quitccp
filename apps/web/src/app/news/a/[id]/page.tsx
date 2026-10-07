import { notFound, redirect } from "next/navigation";
import { getArticleSlugByLegacyId } from "@/lib/public-content";

/**
 * `/news/a/<id>` -- an article by the post id the old site gave it.
 *
 * Stored page content (the homepage cards, the video episode rows) links here
 * rather than to `/news/<title>`, so that retitling an article in the admin
 * cannot break the pages pointing at it. This route only resolves an id to the
 * current slug; the listing and article pages are untouched.
 */
export default async function LegacyArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const slug = await getArticleSlugByLegacyId(Number(id));
  if (!slug) notFound();
  redirect(`/news/${encodeURIComponent(slug)}`);
}
