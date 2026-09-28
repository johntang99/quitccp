/**
 * Build deterministic 301 redirect rows from normalized migration data.
 *
 * Input:
 *   node build-redirect-map.ts <normalized-json-file>
 *
 * Output:
 *   stdout JSON list of redirect rows
 */

import { readFileSync } from "node:fs";

interface NormalizedArticle {
  legacyUrl: string;
  slug: string;
  section: "news" | "resources";
}

interface RedirectRow {
  legacy_url: string;
  destination_url: string;
  status_code: 301;
}

function toDestination(article: NormalizedArticle): string {
  if (article.section === "news") return `/news/${article.slug}`;
  return `/resources/${article.slug}`;
}

function main() {
  const filePath = process.argv[2];
  if (!filePath) throw new Error("Missing input file path");
  const raw = JSON.parse(readFileSync(filePath, "utf8")) as { rows: NormalizedArticle[] };
  const byLegacy = new Map<string, RedirectRow>();
  for (const row of raw.rows ?? []) {
    const legacy = row.legacyUrl?.trim();
    if (!legacy) continue;
    if (!byLegacy.has(legacy)) {
      byLegacy.set(legacy, {
        legacy_url: legacy,
        destination_url: toDestination(row),
        status_code: 301
      });
    }
  }

  const redirects = Array.from(byLegacy.values()).sort((a, b) =>
    a.legacy_url.localeCompare(b.legacy_url)
  );

  process.stdout.write(
    JSON.stringify(
      {
        total: redirects.length,
        redirects
      },
      null,
      2
    )
  );
}

main();
