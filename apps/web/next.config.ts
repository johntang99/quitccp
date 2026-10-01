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

const nextConfig: NextConfig = {
  outputFileTracingRoot: repoRoot,
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
