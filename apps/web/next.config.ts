import type { NextConfig } from "next";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(currentDir, "../..");

/**
 * Lets the app read the repo-root `.env.local`.
 *
 * Next only loads env files sitting beside the app (`apps/web/`), so anything
 * the monorepo keeps at the root -- the OpenAI key, Meili, Resend -- was
 * invisible to route handlers. Copying those into a second env file is the wrong
 * fix: on Vercel there is one environment, not one per directory, so the
 * duplicate exists only on a developer's machine and immediately drifts.
 *
 * Precedence is deliberate. Anything already in `process.env` is left alone, so
 * a real deployment's variables always win and this is a no-op there -- the root
 * file is gitignored and simply does not exist on the build machine. Next has
 * already loaded `apps/web/.env*` by the time the config is required, so those
 * win too; the root file only fills what nothing else has set.
 *
 * NEXT_PUBLIC_ values still belong in the app's own env or the platform: this
 * runs late enough for server code but should not be relied on for the values
 * webpack inlines into the browser bundle.
 */
function loadRepoRootEnv() {
  const file = path.join(repoRoot, ".env.local");
  if (!existsSync(file)) return;

  for (const line of readFileSync(file, "utf8").split("\n")) {
    const text = line.trim();
    if (!text || text.startsWith("#")) continue;
    const at = text.indexOf("=");
    if (at <= 0) continue;
    const key = text.slice(0, at).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (process.env[key] !== undefined) continue;
    let value = text.slice(at + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadRepoRootEnv();

/**
 * The old site's landing pages, which the new one has no equivalent of.
 *
 * `cms_redirects` holds 15,513 rows and the middleware serves them, but every
 * one is an article in `/YYYY/MM/DD/<id>/` form. The pages people actually
 * linked to and bookmarked -- the certificate page, the documentary page, 九评
 * -- were never articles, so nothing covers them. After the domain moves they
 * would 404 for anyone arriving on an old link, and they are the three most
 * referenced old paths in our own article bodies (31 of the 83 broken links
 * found there).
 *
 * Listed here rather than added to the table because these are three fixed
 * decisions about where a section went, not migration data.
 */
const LEGACY_PAGES = [
  // Certificate lookup was never rebuilt here; it lives on the service site.
  // The slashed spellings (/cert/ etc.) are what the old site used and what
  // our article bodies contain; Next normalises the slash away before these
  // rules run, so matching the bare form covers both.
  { source: "/cert", destination: "https://service.tuidang.org/cert-verify/" },
  { source: "/documentary", destination: "/videos" },
  { source: "/9ping", destination: "/resources" }
];

const nextConfig: NextConfig = {
  outputFileTracingRoot: repoRoot,
  async redirects() {
    return LEGACY_PAGES.map((r) => ({ ...r, permanent: true }));
  },
  /**
   * `next dev` and `next build` both write to `.next` by default, so a
   * production build run while the dev server is up replaces the chunks that
   * server is still serving -- the running site then 500s with
   * "Cannot find module ./vendor-chunks/...". Pointing a verification build at
   * its own directory lets the two coexist:
   *
   *   npm run build:check
   *
   * Unset, this is the usual `.next`, so real deploys are unaffected.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next"
};

export default nextConfig;
