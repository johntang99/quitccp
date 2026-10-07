import { notFound, redirect } from "next/navigation";
import { PageFromRoute } from "@/components/PageFromRoute";
import { FaqCategoryPage, FaqIndexPage, FaqItemPage } from "@/components/public/FaqPages";
import {
  getPublicFaq,
  getPublicFaqCategory,
  getPublicFaqItem,
  getPublicFaqSlugByLegacyId
} from "@/lib/public-content";

export default async function ServicesPage({
  params,
  searchParams
}: {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await params;
  const segments = resolved.slug ?? [];
  const query = await searchParams;

  /*
   * The FAQ is three pages, not one: the card index, a category listing, and a
   * single answer. It sits under /services/faq rather than in its own section
   * because that is the address the service tab bar and every inbound link
   * already use.
   */
  if (segments[0] === "faq") {
    const q = typeof query.q === "string" ? query.q : "";

    if (segments.length === 1) {
      const groups = await getPublicFaq(q);
      // Before migration 023 there is nothing to show; fall through to the
      // stored page so the tab is never a dead end.
      if (groups.length > 0 || q) return <FaqIndexPage groups={groups} q={q} />;
      return <PageFromRoute section="services" slug="faq" />;
    }

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
