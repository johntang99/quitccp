import { PageFromRoute } from "@/components/PageFromRoute";

/* Bounded even though this route is prerendered: regeneration still opens a
   database connection, and an unbounded render holds it for five minutes. */
export const maxDuration = 15;

/**
 * 使命与原则, 理事会与团队, 公开与问责 -- the pages under /about that take no
 * parameter.
 *
 * 全球网络 does take one and has moved to its own route, because reading
 * `searchParams` here would mark every page in this section dynamic: they would
 * each be rendered, with their database queries, on every request. That is the
 * property the 2026-10-13 flood was built around on /news.
 */
export const revalidate = 300;

/**
 * Empty on purpose: a dynamic segment with no `generateStaticParams` is treated
 * as fully dynamic and answers `no-store`, whatever `revalidate` says. Measured
 * on /news/[slug].
 */
export async function generateStaticParams() {
  return [];
}

export default async function AboutPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const resolved = await params;
  return <PageFromRoute section="about" slug={resolved.slug?.[0]} />;
}
