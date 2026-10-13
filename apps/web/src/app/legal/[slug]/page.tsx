import { notFound } from "next/navigation";
import { PageFromRoute } from "@/components/PageFromRoute";

/* Bounded even though this route is prerendered: regeneration still opens a
   database connection, and an unbounded render holds it for five minutes. */
export const maxDuration = 15;

/** The two legal documents. Anything else under /legal/ is a 404. */
const PAGES = new Set(["privacy", "terms"]);

export const revalidate = 300;

/**
 * Both of them, by name: there are two legal documents and there always will
 * be, so they are built at deploy time rather than waiting for the first
 * reader. Without this the route is treated as fully dynamic and answers
 * `no-store` -- see /news/[slug], where that was measured.
 */
export async function generateStaticParams() {
  return [...PAGES].map((slug) => ({ slug }));
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!PAGES.has(slug)) notFound();
  return <PageFromRoute section="legal" slug={slug} />;
}
