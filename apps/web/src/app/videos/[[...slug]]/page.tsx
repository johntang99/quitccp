import { PageFromRoute } from "@/components/PageFromRoute";

export default async function VideosPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const resolved = await params;
  return <PageFromRoute section="videos" slug={resolved.slug?.[0]} />;
}
