import { notFound } from "next/navigation";
import { TemplateRenderer } from "@/components/templates/TemplateRenderer";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { getRenderableArticlePreview } from "@/lib/public-content";

/**
 * An article as the editor will publish it, drafts included.
 *
 * The 预览 button used to point at the public address and rely on the admin's
 * session cookie being read inside `getRenderableArticle`, which decided there
 * whether to include drafts. That one cookie read is a dynamic API, and it kept
 * all 15,374 article pages out of the cache on its own -- so a flood against any
 * one of them reached Postgres on every request. The 2026-10-13 attack did
 * exactly that, 477 million times.
 *
 * Splitting it costs an address and buys a public route with no dynamic API in
 * it at all. Drafts are now readable only here, behind a session check, which
 * is also a straighter answer to "who can see an unpublished article" than a
 * branch buried in a shared data function.
 */
export const dynamic = "force-dynamic";

export default async function PreviewArticlePage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireAdminSessionUser();
  const { slug } = await params;
  const article = await getRenderableArticlePreview(slug);
  if (!article) notFound();
  return <TemplateRenderer {...article} />;
}
