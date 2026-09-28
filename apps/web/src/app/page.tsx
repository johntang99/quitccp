import { TemplateRenderer } from "@/components/templates/TemplateRenderer";
import { getRenderablePage } from "@/lib/public-content";

export default async function HomePage() {
  const home = await getRenderablePage("root", "index");
  if (!home) return null;
  return <TemplateRenderer {...home} />;
}
