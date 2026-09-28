import { existsSync, readFileSync } from "node:fs";

const requiredPaths = [
  "apps/web/src/app/not-found.tsx",
  "apps/web/src/app/search/page.tsx",
  "apps/web/src/app/api/health/route.ts",
  "apps/web/src/app/services/[[...slug]]/page.tsx",
  "apps/web/src/app/admin/dashboard/page.tsx",
  "apps/web/src/app/api/service/declarations/route.ts",
  "supabase/content/migrations/001_initial_content_schema.sql",
  "supabase/service/migrations/001_initial_service_schema.sql",
  "docs/implementation/launch-hardening-checklist.md",
  "docs/implementation/rollback-drill.md"
];

function main() {
  const missing = requiredPaths.filter((path) => !existsSync(path));
  const launchChecklist = readFileSync("docs/implementation/launch-hardening-checklist.md", "utf8");
  const securityLinePresent = launchChecklist.includes("MFA");
  const result = {
    ok: missing.length === 0 && securityLinePresent,
    missing,
    securityLinePresent
  };
  process.stdout.write(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main();
