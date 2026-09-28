import { PageFromRoute } from "@/components/PageFromRoute";

export default async function ServicesPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const resolved = await params;
  return <PageFromRoute section="services" slug={resolved.slug?.[0]} />;
}
