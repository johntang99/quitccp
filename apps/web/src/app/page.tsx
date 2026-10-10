import type { Metadata } from "next";
import { TemplateRenderer } from "@/components/templates/TemplateRenderer";
import { getRenderablePage } from "@/lib/public-content";

/* The one page whose canonical is genuinely "/" -- declared here rather than in
   the root layout, which handed the same claim to every page beneath it. */
export const metadata: Metadata = { alternates: { canonical: "/" } };

/**
 * The homepage reads its content from the CMS, so it must not be frozen at
 * build time -- on Vercel a statically prerendered `/` would keep serving the
 * build's HTML and an editor's change would only appear after a redeploy.
 *
 * 300s is the safety net; saving in /admin calls revalidatePath("/") so the
 * change is normally visible on the next request.
 */
export const revalidate = 300;

export default async function HomePage() {
  const home = await getRenderablePage("root", "index");
  if (!home) return null;
  return <TemplateRenderer {...home} />;
}
