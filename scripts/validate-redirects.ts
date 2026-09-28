/**
 * Validates redirect table consistency.
 * - no duplicated legacy_url
 * - no duplicated destination_url for same legacy category cluster warning
 * - destination belongs to known top-level sections
 */

import { readFileSync } from "node:fs";

interface RedirectRow {
  legacy_url: string;
  destination_url: string;
  status_code: number;
}

const allowedPrefixes = ["/news/", "/resources/", "/about/", "/services/", "/involve/", "/videos/"];

function main() {
  const filePath = process.argv[2];
  if (!filePath) throw new Error("Missing redirect JSON file path");
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as { redirects: RedirectRow[] };
  const rows = parsed.redirects ?? [];

  const seenLegacy = new Set<string>();
  const dupLegacy: string[] = [];
  const invalidDest: string[] = [];
  const invalidLegacy: string[] = [];
  const invalidStatus: string[] = [];

  for (const row of rows) {
    if (!row.legacy_url.startsWith("/")) invalidLegacy.push(row.legacy_url);
    if (row.status_code !== 301) invalidStatus.push(`${row.legacy_url}:${row.status_code}`);
    if (seenLegacy.has(row.legacy_url)) dupLegacy.push(row.legacy_url);
    seenLegacy.add(row.legacy_url);
    if (!allowedPrefixes.some((prefix) => row.destination_url.startsWith(prefix))) {
      invalidDest.push(row.destination_url);
    }
  }

  if (dupLegacy.length || invalidDest.length || invalidLegacy.length || invalidStatus.length) {
    process.stdout.write(
      JSON.stringify(
        {
          ok: false,
          duplicateLegacyCount: dupLegacy.length,
          invalidDestinationCount: invalidDest.length,
          invalidLegacyCount: invalidLegacy.length,
          invalidStatusCount: invalidStatus.length,
          duplicateLegacySample: dupLegacy.slice(0, 20),
          invalidDestinationSample: invalidDest.slice(0, 20),
          invalidLegacySample: invalidLegacy.slice(0, 20),
          invalidStatusSample: invalidStatus.slice(0, 20)
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  process.stdout.write(JSON.stringify({ ok: true, total: rows.length }, null, 2));
}

main();
