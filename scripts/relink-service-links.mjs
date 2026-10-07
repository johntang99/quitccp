/**
 * Repoints the last stored www.tuidang.org links at the service subdomain or
 * at our own pages.
 *
 * 老网站管理员 moved the certificate services to service.tuidang.org, which now
 * hosts the hub, the application, verification (zh/en) and the details-change
 * form. Those addresses survive the cutover; www.tuidang.org does not, because
 * it becomes this site.
 *
 * Each old address is mapped by hand rather than by pattern -- 「联系我们」 on
 * the certificate page means the details-change form, while 「联系服务点」
 * means reach a person, and only reading the surrounding label tells them
 * apart.
 *
 *   node --env-file=.env.local scripts/relink-service-links.mjs
 *   node --env-file=.env.local scripts/relink-service-links.mjs --apply
 *   node --env-file=.env.local scripts/relink-service-links.mjs --restore backups/service-links-<stamp>.json
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
    const { error } = await s.from("cms_content_entries").update({ data: c.before }).eq("id", c.id);
    if (error) throw error;
  }
  console.log(`  已还原 ${backup.changes.length} 个页面`);
  process.exit(0);
}

/**
 * path -> field -> new address. Keyed on the exact field so that the same old
 * URL can go to two different places depending on what it means there.
 */
const MAP = {
  "pages/home.json": {
    // 「下载资料」/「公开报告下载」 -- our own downloads page carries these.
    "involve.items.3.href": "/resources/downloads",
    "resources.items.3.href": "/resources/downloads",
    // 「站点使用条款」 -- imported into the CMS, see import-legal-pages.mjs.
    "resources.items.5.href": "/legal/terms"
  },
  "pages/involve-volunteer.json": {
    // The volunteer sign-up form posts to our own contact page.
    "signupForm.submitHref": "/services/contact"
  },
  "pages/services-contact.json": {
    // Labelled 联系我们 but the note asks for a 证明编号 -- this is the
    // certificate details-change flow, which the subdomain now self-serves.
    "handoff.actions.0.href": "https://service.tuidang.org/cert-modify/"
  },
  "pages/services-faq.json": {
    // 「全部常见问题 →」 -- the FAQ lives here now.
    "fullFaqPanel.links.7.href": "/services/faq"
  }
};

function getAt(node, field) {
  return field.split(".").reduce((n, k) => (n == null ? n : n[k]), node);
}
function setAt(node, field, value) {
  const keys = field.split(".");
  const last = keys.pop();
  const parent = keys.reduce((n, k) => n[k], node);
  parent[last] = value;
}

const { data: rows, error } = await s.from("cms_content_entries").select("id, path, data").eq("locale", "zh");
if (error) throw error;

const changes = [];
let moved = 0;
for (const row of rows ?? []) {
  const rules = MAP[row.path];
  if (!rules) continue;
  const after = JSON.parse(JSON.stringify(row.data ?? {}));
  let touched = false;
  for (const [field, target] of Object.entries(rules)) {
    const current = getAt(after, field);
    if (typeof current !== "string") {
      console.log(`  ⚠ ${row.path} 的 ${field} 不存在，跳过`);
      continue;
    }
    if (!/https?:\/\/(?:www\.)?tuidang\.org/.test(current)) {
      console.log(`  · ${row.path} 的 ${field} 已经是 ${current}，跳过`);
      continue;
    }
    console.log(`  ${row.path}`);
    console.log(`      ${field}`);
    console.log(`      ${current}  →  ${target}`);
    setAt(after, field, target);
    moved += 1;
    touched = true;
  }
  if (touched) changes.push({ id: row.id, path: row.path, before: row.data, after });
}

console.log(`\n  改写 ${moved} 处，分布在 ${changes.length} 个页面`);

// Whatever is left still points at a domain that becomes this site on Friday.
// `legacyUrl` is excluded: it records where an imported page was copied from,
// and is never rendered as a link.
const leftover = [];
for (const row of rows ?? []) {
  const applied = changes.find((c) => c.id === row.id);
  const data = JSON.parse(JSON.stringify(applied ? applied.after : (row.data ?? {})));
  delete data.legacyUrl;
  const json = JSON.stringify(data);
  for (const m of json.matchAll(/https?:\\?\/\\?\/(?:www\.)?tuidang\.org(\\?\/[^"\\]*)?/g)) {
    leftover.push(`${row.path}  ${(m[1] || "/").replace(/\\\//g, "/")}`);
  }
}
if (leftover.length) {
  console.log(`\n  仍然指向 www.tuidang.org 的 ${leftover.length} 处（没有对应的替代地址）：`);
  leftover.forEach((l) => console.log(`    ${l}`));
}

if (changes.length === 0) process.exit(0);
if (!APPLY) {
  console.log("\n  空跑 —— 没有写入。确认后加 --apply。");
  process.exit(0);
}

fs.mkdirSync("backups", { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const file = path.join("backups", `service-links-${stamp}.json`);
fs.writeFileSync(file, JSON.stringify({ at: stamp, changes }, null, 2));
console.log(`\n  备份已写入 ${file}`);

for (const c of changes) {
  const { error: e } = await s.from("cms_content_entries").update({ data: c.after }).eq("id", c.id);
  if (e) throw e;
}
console.log(`  已更新 ${changes.length} 个页面。`);
console.log(`  撤销：node --env-file=.env.local scripts/relink-service-links.mjs --restore ${file}`);
