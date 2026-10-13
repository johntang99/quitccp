import type { Metadata } from "next";
import { TemplateRenderer } from "@/components/templates/TemplateRenderer";
import { getRenderablePage } from "@/lib/public-content";

/**
 * A content page renders in about a second. Without this it inherits Vercel's
 * 300-second ceiling, and on 2026-10-13 that ceiling is what turned a flood
 * into an outage: ~500 req/s against one article saturated Postgres, every
 * request then blocked on a query it would never get, and each one held its
 * database connection for the full five minutes. The connections never came
 * back fast enough to drain, Postgres stopped accepting new ones, and the
 * whole project went dark -- 86,000 FUNCTION_INVOCATION_TIMEOUTs in 12 hours.
 *
 * Fifteen seconds is far more than this page needs and far less than it takes
 * to exhaust the database. Under load the site now gets slow and sheds
 * requests instead of holding them until something breaks.
 */
export const maxDuration = 15;


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
