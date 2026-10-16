/**
 * Deletes build traces that point at a file the build never wrote.
 *
 * `src/pages/500.tsx` is fully static, so `next build` renders it to
 * `pages/500.html` and emits no `pages/500.js` -- but it writes
 * `pages/500.js.nft.json` anyway, a dependency trace for a file that does not
 * exist. The trace is harmless until something reads it: Vercel's builder
 * lstats every trace subject while assembling the deployment and fails the
 * whole build with
 *
 *   Error: [ENOENT] lstat '/vercel/path0/apps/web/.next/server/pages/500.js'
 *
 * Which is not reached on every build. It surfaced the day `/news/[slug]/chunk/[n]`
 * gained `generateStaticParams`: nothing about the orphan changed -- a build of
 * the previous commit produces the identical stray file -- but the extra
 * prerendered outputs sent the builder down the path that reads it. So the
 * orphan is a landmine that any future route can step on, and removing it is
 * the fix rather than avoiding whatever walked past it this time.
 *
 * Runs as `postbuild`, so it covers the real deploy build and `build:check`
 * alike. `NEXT_DIST_DIR` is what `build:check` sets to keep out of the dev
 * server's way.
 */
import { readdirSync, existsSync, rmSync, statSync } from "node:fs";
import path from "node:path";

const dist = path.join(process.cwd(), process.env.NEXT_DIST_DIR || ".next");
const removed = [];

/** Every `*.nft.json` under the build's server output. */
function walk(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!entry.endsWith(".nft.json")) continue;
    /* The trace's subject is its own name without the suffix. */
    const subject = full.slice(0, -".nft.json".length);
    if (existsSync(subject)) continue;
    rmSync(full);
    removed.push(path.relative(dist, full));
  }
}

walk(path.join(dist, "server"));

if (removed.length > 0) {
  console.log(`\npostbuild: removed ${removed.length} orphan trace file(s): ${removed.join(", ")}`);
}
