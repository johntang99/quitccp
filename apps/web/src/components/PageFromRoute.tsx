import { notFound } from "next/navigation";
import { getPublicFaq, getRenderablePage } from "@/lib/public-content";
import { TemplateRenderer } from "./templates/TemplateRenderer";

interface PageFromRouteProps {
  section: string;
  slug?: string;
  query?: Record<string, string | string[] | undefined>;
}

export async function PageFromRoute({ section, slug, query }: PageFromRouteProps) {
  const page = await getRenderablePage(section, slug ?? "index");
  // The FAQ is the one page whose body is a content type of its own rather than
  // fields on the page. Fetched here so the template stays a pure renderer.
  const faqGroups =
    section === "services" && (slug ?? "index") === "faq" ? await getPublicFaq() : undefined;
  // Render the real 404 rather than a "not found" body under a 200. A removed
  // page returning 200 keeps it in search indexes and hides it from the
  // redirect-coverage checks.
  if (!page) notFound();

  return <TemplateRenderer {...page} query={query} faqGroups={faqGroups} />;
}
