import { PageFromRoute } from "@/components/PageFromRoute";

export default async function AboutPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const resolved = await params;
  return <PageFromRoute section="about" slug={resolved.slug?.[0]} />;
}
