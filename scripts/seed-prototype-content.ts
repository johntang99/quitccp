import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prototypePageContentSeeds, sharedContentPaths } from "@quitccp/content-schema";

function loadEnvFileIfPresent(filePath: string) {
  try {
    const raw = readFileSync(filePath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex <= 0) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const valueRaw = trimmed.slice(eqIndex + 1).trim();
      if (!key || process.env[key] !== undefined) continue;
      const value = valueRaw.replace(/^['"]|['"]$/g, "");
      process.env[key] = value;
    }
  } catch {
    // Optional file: ignore when missing.
  }
}

function loadLocalEnv() {
  const cwd = process.cwd();
  loadEnvFileIfPresent(resolve(cwd, ".env.local"));
  loadEnvFileIfPresent(resolve(cwd, ".env"));
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function readArg(args: string[], name: string, fallback: string): string {
  const idx = args.indexOf(name);
  if (idx < 0) return fallback;
  return (args[idx + 1] || fallback).trim();
}

function isMissingContentTableError(error: unknown): boolean {
  const text = typeof error === "object" && error !== null ? JSON.stringify(error) : String(error);
  return (
    (text.includes("cms_content_entries") || text.includes("PGRST205")) &&
    (text.includes("schema cache") || text.includes("does not exist") || text.includes("42P01"))
  );
}

async function main() {
  loadLocalEnv();

  const args = process.argv.slice(2);
  const locale = readArg(args, "--locale", "zh");
  const overwrite = hasFlag(args, "--overwrite");
  const apply = hasFlag(args, "--apply");

  const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false }
  });

  const sharedSeeds = sharedContentPaths.map((path) => ({
    path,
    data: {
      meta: {
        scope: "shared",
        path
      }
    }
  }));

  const allSeeds = [...prototypePageContentSeeds.map((seed) => ({ path: seed.path, data: seed.data })), ...sharedSeeds];
  const { data: existingRows, error: existingError } = await supabase
    .from("cms_content_entries")
    .select("path")
    .eq("locale", locale);
  if (existingError) {
    if (isMissingContentTableError(existingError)) {
      throw new Error("cms_content_entries table is missing. Apply migration 008_content_entries.sql first.");
    }
    throw existingError;
  }

  const existingSet = new Set((existingRows ?? []).map((row) => String(row.path)));
  const rowsToApply = allSeeds.filter((seed) => overwrite || !existingSet.has(seed.path));

  const result = {
    locale,
    overwrite,
    apply,
    totalSeeds: allSeeds.length,
    existing: existingSet.size,
    willUpsert: rowsToApply.length,
    willSkip: allSeeds.length - rowsToApply.length
  };

  if (!apply) {
    process.stdout.write(`${JSON.stringify({ dryRun: true, ...result }, null, 2)}\n`);
    return;
  }

  if (rowsToApply.length > 0) {
    const { error } = await supabase.from("cms_content_entries").upsert(
      rowsToApply.map((seed) => ({
        locale,
        path: seed.path,
        data: seed.data,
        updated_by: "script:seed-prototype-content"
      })),
      { onConflict: "locale,path" }
    );
    if (error) {
      if (isMissingContentTableError(error)) {
        throw new Error("cms_content_entries table is missing. Apply migration 008_content_entries.sql first.");
      }
      throw error;
    }
  }

  process.stdout.write(`${JSON.stringify({ dryRun: false, ...result }, null, 2)}\n`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
