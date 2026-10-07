/**
 * Repoints old-site page links inside FAQ answers at our own pages.
 *
 * `relink-faq-answers.mjs` handled the links between FAQ entries. These are the
 * ones that leave the FAQ: the certificate page, contact-us, the Nine
 * Commentaries page and the bare homepage. All four exist on this site, and all
 * four addresses stop resolving when tuidang.org becomes this site.
 *
 * Images are not touched -- `rehost-media-to-storage.mjs` owns those.
 *
 *   node --env-file=.env.local scripts/relink-faq-pages.mjs
 *   node --env-file=.env.local scripts/relink-faq-pages.mjs --apply
 *   node --env-file=.env.local scripts/relink-faq-pages.mjs --restore backups/faq-pages-<stamp>.json
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const APPLY = process.argv.includes("--apply");
const RESTORE = (() => {
  const i = process.argv.indexOf("--restore");
  return i === -1 ? null : process.argv[i + 1];
})();

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

if (RESTORE) {
  const backup = JSON.parse(fs.readFileSync(RESTORE, "utf8"));
  for (const c of backup.changes) {
    const { error } = await s.from("cms_faqs").update({ answer_markdown: c.before }).eq("id", c.id);
    if (error) throw error;
  }
  console.log(`  已还原 ${backup.changes.length} 条`);
  process.exit(0);
}

/**
 * Old path -> ours. Longest first, so /contact-us/ is matched before the bare
 * root. `swcfpc=1` is a Cloudflare cache-bypass parameter the old site appended;
 * it carries no meaning here.
 */
const ROUTES = [
  [/^\/contact-us\/?(\?[^)\s]*)?$/, "/services/contact"],
  [/^\/cert\/?$/, "/services/cert"],
  [/^\/9ping\/?$/, "/videos/jiuping"],
  [/^\/?$/, "/"]
];

const LINK = /\]\((https?:\/\/(?:www\.)?tuidang\.org((?:\/[^)\s]*)?))\)/g;

const { data: rows, error } = await s.from("cms_faqs").select("id, question, answer_markdown");
if (error) throw error;

const changes = [];
const tally = new Map();
let unmatched = 0;
for (const row of rows) {
  const before = String(row.answer_markdown ?? "");
  const after = before.replace(LINK, (whole, _url, p) => {
    if (p.startsWith("/wp-content")) return whole; // the rehost script's job
    const hit = ROUTES.find(([re]) => re.test(p));
    if (!hit) {
      unmatched += 1;
      console.log(`    未匹配，保持原样: ${p}`);
      return whole;
    }
    tally.set(hit[1], (tally.get(hit[1]) ?? 0) + 1);
    return `](${hit[1]})`;
  });
  if (after !== before) changes.push({ id: row.id, question: row.question, before, after });
}

console.log(`\n  需要改写 ${changes.length} 条答案`);
for (const [to, n] of [...tally].sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(3)} 处 → ${to}`);
if (unmatched) console.log(`  ${unmatched} 处没有对应页面，保持原样`);

if (changes.length === 0) process.exit(0);
if (!APPLY) {
  console.log("\n  空跑 —— 没有写入。确认后加 --apply。");
  process.exit(0);
}

fs.mkdirSync("backups", { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const file = path.join("backups", `faq-pages-${stamp}.json`);
fs.writeFileSync(file, JSON.stringify({ at: stamp, changes }, null, 2));
console.log(`\n  备份已写入 ${file}`);

for (const c of changes) {
  const { error: e } = await s.from("cms_faqs").update({ answer_markdown: c.after }).eq("id", c.id);
  if (e) throw e;
}
console.log(`  已改写 ${changes.length} 条。`);
console.log(`  撤销：node --env-file=.env.local scripts/relink-faq-pages.mjs --restore ${file}`);
