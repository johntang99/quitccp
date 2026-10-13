import { notFound, redirect } from "next/navigation";
import { PageFromRoute } from "@/components/PageFromRoute";
import { FaqCategoryPage, FaqIndexPage, FaqItemPage } from "@/components/public/FaqPages";
import {
  getPublicFaq,
  getPublicFaqCategory,
  getPublicFaqItem,
  getPublicFaqSlugByLegacyId
} from "@/lib/public-content";

/**
 * A content page renders in about a second. Without this it inherits Vercel's
 * 300-second ceiling, and on 2026-10-13 that ceiling is what turned a flood
 * into an outage: ~500 req/s against one article saturated Postgres, every
 * request then blocked on a query it would never get, and each one held its
 * database connection for the full five minutes. The connections never came
 * back fast enough to drain, Postgres stopped accepting new ones, and the
 * whole project went dark -- 86,000 FUNCTION_INVOCATION_TIMEOUTs in 12 hours.
 *
 * Fifteen seconds is far more than this page needs and far less than it takes
 * to exhaust the database. Under load the site now gets slow and sheds
 * requests instead of holding them until something breaks.
 */
export const maxDuration = 15;


export const revalidate = 300;

/**
 * Empty on purpose: a dynamic segment with no `generateStaticParams` is treated
 * as fully dynamic and answers `no-store`, whatever `revalidate` says. Measured
 * on /news/[slug].
 */
export async function generateStaticParams() {
  return [];
}

export default async function ServicesPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const resolved = await params;
  const segments = resolved.slug ?? [];

  /*
   * The FAQ is three pages, not one: the card index, a category listing, and a
   * single answer. It sits under /services/faq rather than in its own section
   * because that is the address the service tab bar and every inbound link
   * already use.
   */
  if (segments[0] === "faq") {
    /* `/services/faq` itself has moved to services/faq/page.tsx: its search box
       reads the query string, and reading it kept this whole section out of the
       cache. A static segment wins over this catch-all, so that address never
       arrives here. What remains are the deeper FAQ pages, none of which take a
       parameter. */

    /*
     * `/services/faq/d/<id>` -- a stable address keyed on the old doc id.
     * Every FAQ link elsewhere on the site uses this form, so rewording a
     * question (which rewrites its slug) cannot break them. It also gives the
     * cutover a target for inbound /docs/<id>/ links from the old domain.
     */
    if (segments[1] === "d" && segments[2]) {
      const slug = await getPublicFaqSlugByLegacyId(Number(segments[2]));
      if (!slug) notFound();
      redirect(`/services/faq/${encodeURIComponent(slug)}`);
    }

    if (segments[1] === "c" && segments[2]) {
      const group = await getPublicFaqCategory(segments[2]);
      if (!group) notFound();
      return <FaqCategoryPage group={group} />;
    }

    if (segments.length === 2) {
      const found = await getPublicFaqItem(segments[1]);
      if (!found) notFound();
      return <FaqItemPage item={found.item} category={found.category} />;
    }

    notFound();
  }

  return <PageFromRoute section="services" slug={segments[0]} />;
}
