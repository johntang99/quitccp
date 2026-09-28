import { PageFromRoute } from "@/components/PageFromRoute";

interface ResourcesPageProps {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ResourcesPage({ params, searchParams }: ResourcesPageProps) {
  const resolved = await params;
  const query = await searchParams;
  return <PageFromRoute section="resources" slug={resolved.slug?.[0]} query={query} />;
}
