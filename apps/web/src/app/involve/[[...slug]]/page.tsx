import { PageFromRoute } from "@/components/PageFromRoute";

/* Bounded even though this route is prerendered: regeneration still opens a
   database connection, and an unbounded render holds it for five minutes. */
export const maxDuration = 15;

/**
 * Lets a copy of the page exist between the reader and Postgres.
 *
 * A dynamic segment with no `generateStaticParams` is treated as fully dynamic
 * and answers `no-store`, whatever `revalidate` says -- measured on
 * /news/[slug], where removing the dynamic APIs alone did not move the header.
 * These pages have no dynamic API to remove; they were uncacheable only for
 * the want of this.
 */
export const revalidate = 300;

export async function generateStaticParams() {
  return [];
}

export default async function InvolvePage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const resolved = await params;
  return <PageFromRoute section="involve" slug={resolved.slug?.[0]} />;
}
