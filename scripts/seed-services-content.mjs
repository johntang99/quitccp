/**
 * Prepares the 我们的服务 pages for the block editor.
 *
 * Four separate changes, all on the same eight entries:
 *
 *   1. Fills the blocks that were written into the templates -- the handoff
 *      panels, the offline hotline list, the two sidebar lists of authoritative
 *      documents on tuidang.org, and the certificate apply buttons.
 *   2. Folds the heading+body arrays into one Markdown body per page. The text
 *      is DERIVED from what is stored, never retyped, so nothing can drift or
 *      be lost in transcription.
 *   3. Restores the links on the immigration policy list. The stored items lost
 *      their `href`, and because the template only falls back when the list is
 *      empty, six policy documents were rendering as plain unclickable text.
 *   4. Stores the titles the templates were overriding, and drops keys no
 *      services template reads any more.
 *
 * Nothing is written without `--apply`.
 *
 *   node --env-file=.env.local scripts/seed-services-content.mjs
 *   node --env-file=.env.local scripts/seed-services-content.mjs --apply
 *   node --env-file=.env.local scripts/seed-services-content.mjs --restore backups/services-<stamp>.json
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const RESTORE = (() => {
  const i = args.indexOf("--restore");
  return i === -1 ? null : args[i + 1];
})();
const LOCALE = "zh";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const {
  servicesPageDefaults,
  SERVICES_POLICY_DOC_HREFS,
  SERVICES_CORRECTED_TITLES,
  SERVICES_NESTED_FILLS
} = await import("../packages/content-schema/src/services-content.ts");

/**
 * Keys no services template reads.
 *
 * `steps`, `organizations`, `regionOptions`, `certificateOptions` and
 * `submitPanel` on the declaration page, and `formHints`/`requestOptions` on
 * the contact page, are left from when those pages carried their own forms.
 * Both now hand off to the production service, so the fields describe a form
 * that no longer exists -- and an editor who filled them in would see nothing
 * change.
 */
const DROP = {
  declare: ["steps", "organizations", "regionOptions", "certificateOptions", "submitPanel"],
  contact: ["formHints", "requestOptions"]
};

/** heading+body rows -> one markdown body. Headings become `## `. */
function rowsToMarkdown(rows, { boldLead = false } = {}) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const heading = String(row?.heading ?? "").trim();
      const body = String(row?.body ?? "").trim();
      if (!heading) return body;
      if (!body) return `## ${heading}`;
      // 查验结果 reads as a definition list -- "有效。该编号由…" -- so its
      // heading belongs inline and bold, not as a section heading.
      return boldLead ? `**${heading}** ${body}` : `## ${heading}\n\n${body}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

/** Per page: derive the markdown body from whatever that page already stores. */
const MARKDOWN = {
  cert: (d) => {
    const md = rowsToMarkdown(d.introSections);
    if (!md) return null;
    // Was a hardcoded paragraph after the list; it belongs in the same body.
    return {
      key: "intro",
      value: {
        body: `${md}\n\n每份证明都有唯一编号，任何机构或个人都可以[在线查验真伪](/services/verify)，不需要联系本中心，也不需要授权。`
      }
    };
  },
  privacy: (d) => {
    const md = rowsToMarkdown(d.sections);
    return md ? { key: "intro", value: { body: md } } : null;
  },
  contact: (d) => {
    const md = rowsToMarkdown(d.processingSections);
    return md ? { key: "intro", value: { body: md } } : null;
  },
  verify: (d) => {
    const scope = d.scopeSection ?? {};
    const parts = [];
    const resultHeading = String(scope.resultHeading ?? "查验结果代表什么").trim();
    const results = rowsToMarkdown(d.resultMeaning, { boldLead: true });
    if (results) parts.push(`## ${resultHeading}`, results);
    const scopeHeading = String(scope.scopeHeading ?? "").trim();
    const scopeBody = String(scope.scopeBody ?? "").trim();
    if (scopeHeading || scopeBody) {
      if (scopeHeading) parts.push(`## ${scopeHeading}`);
      if (scopeBody) parts.push(scopeBody);
    }
    return parts.length > 0 ? { key: "intro", value: { body: parts.join("\n\n") } } : null;
  },
  declare: (d) => {
    // Five fields assembled one sentence with two links inside it. As markdown
    // it is one field, and the links read as links.
    const n = d.safetyNotice ?? {};
    const body = String(n.body ?? "").trim();
    if (!body) return null;
    const tools = String(n.toolsLabel ?? "").trim();
    const toolsHref = String(n.toolsHref ?? "/resources/tools").trim();
    const middle = String(n.middleText ?? "").trim();
    const privacy = String(n.privacyLabel ?? "").trim();
    const privacyHref = String(n.privacyHref ?? "/services/privacy").trim();
    let text = body;
    if (tools) text += ` [${tools}](${toolsHref})`;
    if (middle) text += middle;
    if (privacy) text += ` [${privacy}](${privacyHref})`;
    return { key: "safetyNotice", value: { ...n, body: text } };
  }
};

const BACKUP_DIR = path.join(process.cwd(), "backups");

if (RESTORE) {
  const backup = JSON.parse(fs.readFileSync(RESTORE, "utf8"));
  for (const c of backup.changes) {
    const { error } = await supabase
      .from("cms_content_entries")
      .update({ data: c.before })
      .eq("locale", LOCALE)
      .eq("path", c.path);
    if (error) throw error;
  }
  console.log(`  已还原 ${backup.changes.length} 个页面（${path.basename(RESTORE)}）`);
  process.exit(0);
}

const { data: rows, error } = await supabase
  .from("cms_content_entries")
  .select("path, data")
  .eq("locale", LOCALE)
  .like("path", "pages/services-%")
  .order("path");
if (error) throw error;

const changes = [];
for (const row of rows) {
  const slug = row.path.replace("pages/services-", "").replace(".json", "");
  const before = row.data ?? {};
  const after = structuredClone(before);
  const notes = [];

  // 1. blocks lifted out of the templates
  for (const [key, value] of Object.entries(servicesPageDefaults[slug] ?? {})) {
    if (after[key] !== undefined) continue;
    after[key] = structuredClone(value);
    notes.push(`新增 ${key}`);
  }

  // 1b. fields missing from inside an object a top-level fill cannot reach
  for (const fill of SERVICES_NESTED_FILLS) {
    if (fill.slug !== slug) continue;
    const [head, leaf] = fill.path;
    const parent = after[head];
    if (!parent || typeof parent !== "object" || parent[leaf] !== undefined) continue;
    parent[leaf] = fill.value;
    notes.push(`新增 ${fill.path.join(".")}`);
  }

  // 2. markdown body derived from what is already stored
  const md = MARKDOWN[slug]?.(before);
  if (md && JSON.stringify(after[md.key]) !== JSON.stringify(md.value)) {
    after[md.key] = md.value;
    const chars = String(md.value.body ?? "").length;
    notes.push(`正文转 Markdown（${chars} 字）`);
  }

  // 3. the policy list lost its links; put them back by title
  if (slug === "immigration" && Array.isArray(after.policySection?.items)) {
    let fixed = 0;
    after.policySection.items = after.policySection.items.map((item) => {
      if (item?.href) return item;
      const href = SERVICES_POLICY_DOC_HREFS[String(item?.title ?? "").trim()];
      if (!href) return item;
      fixed++;
      return { ...item, href };
    });
    if (fixed > 0) notes.push(`补回 ${fixed} 条政策链接`);
  }

  // 4. the title the template was forcing, and the dead keys
  const title = SERVICES_CORRECTED_TITLES[slug];
  if (title && after.title !== title) {
    notes.push(`标题 "${after.title}" → "${title}"`);
    after.title = title;
  }
  for (const key of DROP[slug] ?? []) {
    if (after[key] === undefined) continue;
    delete after[key];
    notes.push(`删除无用键 ${key}`);
  }

  if (notes.length > 0) changes.push({ path: row.path, before, after, notes });
}

console.log(`\n  需要更新 ${changes.length} 个页面\n`);
for (const c of changes) {
  console.log(`    ${c.path}`);
  for (const n of c.notes) console.log(`      · ${n}`);
}

if (changes.length === 0) {
  console.log("  没有需要改的。");
  process.exit(0);
}

fs.mkdirSync(BACKUP_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const file = path.join(BACKUP_DIR, `services-${stamp}.json`);
fs.writeFileSync(file, JSON.stringify({ at: stamp, changes }, null, 2));
console.log(`\n  备份已写入 ${path.relative(process.cwd(), file)}`);

if (!APPLY) {
  console.log("\n  空跑 —— 没有写入。确认后加 --apply。");
  process.exit(0);
}

for (const c of changes) {
  const { error: writeError } = await supabase
    .from("cms_content_entries")
    .update({ data: c.after })
    .eq("locale", LOCALE)
    .eq("path", c.path);
  if (writeError) throw writeError;
}
console.log(`  已更新 ${changes.length} 个页面。`);
console.log(
  `  撤销：node --env-file=.env.local scripts/seed-services-content.mjs --restore ${path.relative(process.cwd(), file)}`
);
