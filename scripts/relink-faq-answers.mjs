/**
 * Repoints links inside FAQ answers at our own FAQ.
 *
 * The imported answers end with lines like
 * "更多信息请参考：[常见问题解答](https://www.tuidang.org/faq/)" and link to each
 * other as /docs/<id>/. After the cutover tuidang.org is this site, so those
 * addresses stop resolving -- and every one of them points at an answer we now
 * hold ourselves.
 *
 *   node --env-file=.env.local scripts/relink-faq-answers.mjs
 *   node --env-file=.env.local scripts/relink-faq-answers.mjs --apply
 *   node --env-file=.env.local scripts/relink-faq-answers.mjs --restore backups/faq-relink-<stamp>.json
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
const FAQ_PAGE = "/services/faq";

if (RESTORE) {
  const backup = JSON.parse(fs.readFileSync(RESTORE, "utf8"));
  for (const c of backup.changes) {
    const { error } = await s.from("cms_faqs").update({ answer_markdown: c.before }).eq("id", c.id);
    if (error) throw error;
  }
  console.log(`  已还原 ${backup.changes.length} 条`);
  process.exit(0);
}

const { data: rows, error } = await s.from("cms_faqs").select("id, slug, question, answer_markdown, legacy_id");
if (error) throw error;

// Every answer we hold, by the id its old address used.
const slugByLegacy = new Map(rows.filter((r) => r.legacy_id).map((r) => [Number(r.legacy_id), r.slug]));

const HUB = /https?:\/\/(?:www\.)?tuidang\.org\/faq\/?/g;
const DOC = /https?:\/\/(?:www\.)?tuidang\.org\/docs\/(\d+)\/?/g;

const changes = [];
let hubHits = 0;
let docHits = 0;
let docMisses = 0;
for (const row of rows) {
  const before = String(row.answer_markdown ?? "");
  let after = before.replace(DOC, (whole, id) => {
    const slug = slugByLegacy.get(Number(id));
    if (!slug) {
      docMisses += 1;
      return whole; // not one of ours; leave it pointing at the old site
    }
    docHits += 1;
    return `${FAQ_PAGE}#${encodeURIComponent(slug)}`;
  });
  after = after.replace(HUB, () => {
    hubHits += 1;
    return FAQ_PAGE;
  });
  if (after !== before) changes.push({ id: row.id, question: row.question, before, after });
}

console.log(`\n  需要改写 ${changes.length} 条答案`);
console.log(`    指向 FAQ 首页的链接 ${hubHits} 处 → ${FAQ_PAGE}`);
console.log(`    指向具体问答的链接 ${docHits} 处 → ${FAQ_PAGE}#<slug>`);
if (docMisses) console.log(`    ${docMisses} 处 /docs/ 链接不在我们的问答库里，保持原样`);

if (changes.length === 0) process.exit(0);
for (const c of changes.slice(0, 4)) console.log(`      ${c.question.slice(0, 30)}`);

if (!APPLY) {
  console.log("\n  空跑 —— 没有写入。确认后加 --apply。");
  process.exit(0);
}

fs.mkdirSync("backups", { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const file = path.join("backups", `faq-relink-${stamp}.json`);
fs.writeFileSync(file, JSON.stringify({ at: stamp, changes }, null, 2));
console.log(`\n  备份已写入 ${file}`);

for (const c of changes) {
  const { error: e } = await s.from("cms_faqs").update({ answer_markdown: c.after }).eq("id", c.id);
  if (e) throw e;
}
console.log(`  已改写 ${changes.length} 条。`);
console.log(`  撤销：node --env-file=.env.local scripts/relink-faq-answers.mjs --restore ${file}`);
