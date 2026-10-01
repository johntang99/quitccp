/**
 * Verifies the production build without disturbing a running dev server.
 *
 * `next dev` and `next build` both write to `apps/web/.next`, so a plain
 * `npm run build` replaces the chunks the dev server is still serving and
 * localhost:4020 starts failing with "Cannot find module ./vendor-chunks/…".
 * This points the build at `.next-verify` instead, so the two coexist.
 *
 * `next build` also rewrites `next-env.d.ts` and `tsconfig.json` to reference
 * whichever dist directory it just used. Left alone that would commit a
 * `.next-verify` path into files the real deploy build depends on, so both are
 * snapshotted and put back afterwards -- a verification run must leave no trace.
 *
 *   npm run build:check
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const touched = ["apps/web/next-env.d.ts", "apps/web/tsconfig.json"].map((file) =>
  path.join(repoRoot, file)
);

const snapshots = new Map();
for (const file of touched) {
  if (existsSync(file)) snapshots.set(file, readFileSync(file));
}

const result = spawnSync("npm", ["run", "build"], {
  cwd: repoRoot,
  stdio: "inherit",
  env: { ...process.env, NEXT_DIST_DIR: ".next-verify" }
});

let restored = 0;
for (const [file, before] of snapshots) {
  if (existsSync(file) && !readFileSync(file).equals(before)) {
    writeFileSync(file, before);
    restored += 1;
  }
}
if (restored > 0) {
  console.log(`\nbuild:check restored ${restored} file(s) the build rewrote.`);
}

process.exit(result.status ?? 1);
