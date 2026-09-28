/**
 * Seeds `pages/home.json` from the homepage defaults.
 *
 * The defaults are the current homepage verbatim, so this is visually a no-op --
 * it moves the content out of the template and into the CMS where it can be
 * edited. Existing keys are preserved unless --force is passed.
 *
 *   npx tsx scripts/seed-home-content.ts [--force] [--locale zh]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { homeContentDefaults } from "@quitccp/content-schema";

function loadEnvFileIfPresent(filePath: string) {
  try {
    for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (!key || process.env[key] !== undefined) continue;
      process.env[key] = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // optional
  }
}

const HOME_PATH = "pages/home.json";

async function main() {
  const cwd = process.cwd();
  loadEnvFileIfPresent(resolve(cwd, "apps/web/.env.local"));
  loadEnvFileIfPresent(resolve(cwd, ".env.local"));

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");

  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const localeIdx = args.indexOf("--locale");
  const locale = localeIdx >= 0 ? args[localeIdx + 1] : "zh";

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: existing, error: readError } = await supabase
    .from("cms_content_entries")
    .select("id, data")
    .eq("path", HOME_PATH)
    .eq("locale", locale)
    .maybeSingle();
  if (readError) throw readError;

  const current = (existing?.data ?? {}) as Record<string, unknown>;
  // Anything already in the entry (title, meta, streamEntries) is carried
  // through untouched. Within a section we fill only the keys that are missing,
  // so a legacy `hero` holding just {title, body} gains variant/eyebrow/actions
  // without losing the words an editor already wrote.
  const merged: Record<string, unknown> = { ...current };
  for (const [sectionKey, sectionValue] of Object.entries(homeContentDefaults)) {
    const existingSection = merged[sectionKey];
    if (force || existingSection === undefined) {
      merged[sectionKey] = sectionValue;
      continue;
    }
    if (
      typeof existingSection === "object" &&
      existingSection !== null &&
      !Array.isArray(existingSection)
    ) {
      merged[sectionKey] = {
        ...(sectionValue as Record<string, unknown>),
        ...(existingSection as Record<string, unknown>)
      };
    }
  }

  if (existing) {
    const { error } = await supabase
      .from("cms_content_entries")
      .update({ data: merged, updated_by: "seed:home-content" })
      .eq("id", existing.id);
    if (error) throw error;
    console.log(`updated ${HOME_PATH} (${locale})${force ? " [forced]" : ""}`);
  } else {
    const { error } = await supabase
      .from("cms_content_entries")
      .insert({ path: HOME_PATH, locale, data: merged, updated_by: "seed:home-content" });
    if (error) throw error;
    console.log(`created ${HOME_PATH} (${locale})`);
  }

  console.log("sections:", Object.keys(homeContentDefaults).join(", "));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
