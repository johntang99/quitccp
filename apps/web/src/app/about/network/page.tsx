import { PageFromRoute } from "@/components/PageFromRoute";

/**
 * 全球网络, which is the one page under /about that reads the query string.
 *
 * It filters its service points and pages through them, so it needs
 * `searchParams` -- and reading those marks a route dynamic, which is why it
 * sits here instead of in `/about/[[...slug]]`. That catch-all serves 使命与原则,
 * 理事会与团队 and 公开与问责, none of which take a parameter, and with this page
 * moved out it can be cached.
 *
 * A static segment wins over a catch-all, so this file takes /about/network and
 * the catch-all never sees it.
 */
export const dynamic = "force-dynamic";

export default async function AboutNetworkPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <PageFromRoute section="about" slug="network" query={await searchParams} />;
}
