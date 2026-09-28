import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

interface RedirectRow {
  legacy_url: string;
  destination_url: string;
  status_code: 301;
}

interface InputFile {
  redirects: RedirectRow[];
}

function assertEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function main() {
  const filePath = process.argv[2];
  const mode = process.argv[3] ?? "--dry-run";
  if (!filePath) throw new Error("Usage: tsx scripts/load-redirects.ts <redirect-json> [--apply|--dry-run]");

  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as InputFile;
  const redirects = (parsed.redirects ?? []).sort((a, b) => a.legacy_url.localeCompare(b.legacy_url));

  if (mode !== "--apply") {
    process.stdout.write(
      JSON.stringify(
        {
          mode: "dry-run",
          totalRedirects: redirects.length,
          sample: redirects.slice(0, 5)
        },
        null,
        2
      )
    );
    return;
  }

  const supabase = createClient(assertEnv("SUPABASE_URL"), assertEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false }
  });

  const batchSize = 400;
  for (let i = 0; i < redirects.length; i += batchSize) {
    const chunk = redirects.slice(i, i + batchSize);
    const { error } = await supabase
      .from("cms_redirects")
      .upsert(chunk, { onConflict: "legacy_url" });
    if (error) throw error;
  }

  process.stdout.write(
    JSON.stringify(
      {
        mode: "apply",
        totalRedirects: redirects.length
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
