import { PageFromRoute } from "@/components/PageFromRoute";

export default async function InvolvePage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const resolved = await params;
  return <PageFromRoute section="involve" slug={resolved.slug?.[0]} />;
}
