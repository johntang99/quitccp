import { PageFromRoute } from "@/components/PageFromRoute";

export default async function AboutPage({
  params,
  searchParams
}: {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await params;
  // 全球网络 filters its service points and pages through them, so the template
  // needs the query string; without it both controls were inert links to "#".
  return <PageFromRoute section="about" slug={resolved.slug?.[0]} query={await searchParams} />;
}
