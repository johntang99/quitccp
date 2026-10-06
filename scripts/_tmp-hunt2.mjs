import { createClient } from "@supabase/supabase-js";
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await s.from("cms_content_entries").select("locale, path, data");
let hits = 0;
for (const r of data ?? []) {
  const json = JSON.stringify(r.data ?? {});
  for (const m of json.matchAll(/https?:\\?\/\\?\/[a-z0-9.-]*tuidang\.org\\?\/wp-content\\?\/[^"\\]+/gi)) {
    console.log(`  ${r.locale}  ${r.path}`);
    console.log(`      ${m[0].replace(/\\\//g, "/").slice(0, 100)}`);
    hits++;
  }
}
console.log(`\n  cms_content_entries 里共 ${hits} 处`);
