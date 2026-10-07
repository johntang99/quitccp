import { notFound } from "next/navigation";
import { PageFromRoute } from "@/components/PageFromRoute";

/** The two legal documents. Anything else under /legal/ is a 404. */
const PAGES = new Set(["privacy", "terms"]);

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!PAGES.has(slug)) notFound();
  return <PageFromRoute section="legal" slug={slug} />;
}
