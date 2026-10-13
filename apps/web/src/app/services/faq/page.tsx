import { FaqIndexPage } from "@/components/public/FaqPages";
import { PageFromRoute } from "@/components/PageFromRoute";
import { getPublicFaq } from "@/lib/public-content";

/**
 * 三退问答's card index, the one address under /services that reads the query
 * string -- its search box posts `?q=`.
 *
 * Reading that marks a route dynamic, and while this lived in the catch-all it
 * kept every page under /services out of the cache: each was rendered, with its
 * database queries, on every request. A static segment wins over a catch-all,
 * so this file takes /services/faq and the deeper FAQ addresses -- a category,
 * a single answer, the legacy `/d/<id>` -- stay with the catch-all, which no
 * longer needs the query string at all.
 *
 * The body is the branch it replaces, unchanged.
 */
export const dynamic = "force-dynamic";

export default async function ServicesFaqPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q : "";
  const groups = await getPublicFaq(q);
  // Before migration 023 there is nothing to show; fall through to the stored
  // page so the tab is never a dead end.
  if (groups.length > 0 || q) return <FaqIndexPage groups={groups} q={q} />;
  return <PageFromRoute section="services" slug="faq" />;
}
