import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { NormalizedArticle } from "./migrate-wp-posts";

interface InputFile {
  rows: NormalizedArticle[];
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function parseArg(argv: string[], name: string): string | undefined {
  const idx = argv.indexOf(name);
  if (idx < 0) return undefined;
  return argv[idx + 1];
}

async function main() {
  const argv = process.argv.slice(2);
  const input = parseArg(argv, "--input");
  const locale = parseArg(argv, "--locale");

  if (!input || !locale) {
    throw new Error(
      "Usage: tsx scripts/load-search-benchmark-locale.ts --input <normalized-json> --locale <locale>"
    );
  }

  const parsed = JSON.parse(readFileSync(input, "utf8")) as InputFile;
  const rows = parsed.rows ?? [];

  const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false }
  });

  const batchSize = 20;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const payload = batch.map((row) => ({
      slug: row.slug,
      locale,
      title: row.title,
      summary: row.summary,
      body_markdown: row.bodyMarkdown,
      body_plain: row.bodyPlain,
      section: row.section,
      status: "published",
      editorial_status: "published",
      legacy_url: row.legacyUrl,
      legacy_id: row.legacyId,
      published_at: row.publishedAt
    }));

    const { error } = await supabase.from("cms_articles").upsert(payload, { onConflict: "slug,locale" });
    if (error) throw error;
    upserted += batch.length;
  }

  process.stdout.write(
    JSON.stringify(
      {
        locale,
        totalRows: rows.length,
        upserted
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
