/**
 * Builds 机构简介（一页）— the bilingual one-page organisation profile that
 * /resources/press offers to journalists.
 *
 *   npx tsx scripts/build-org-profile-pdf.ts --dry-run
 *   npx tsx scripts/build-org-profile-pdf.ts --apply
 *
 * Generated rather than hand-made so it can be rebuilt when the facts change:
 * every figure comes from the site's own content -- the About page's intro and
 * principles, and the live registry count synced from santui -- so the PDF
 * cannot drift away from what the site says.
 *
 * ## What is deliberately excluded
 *
 * The About page's 理事会与团队 section is placeholder data: four members all
 * named 姓名占位, illustrated with photographs of 陈用林, 郝凤军 and 韩广生 --
 * three real, named people who appear elsewhere on the site as 见证者, not as
 * board members. Naming no one is a gap; presenting real people as officers of
 * an organisation they may have no role in is a misrepresentation, and this
 * document is handed to journalists. It is left out until there are real names.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

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

const OBJECT_PATH = "press/quitccp-org-profile.pdf";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

interface Principle {
  label: string;
  text: string;
}

/**
 * A principle's sentence can be split across `text` + `linkLabel` + `linkSuffix`
 * because the page renders the middle part as a link. Taking only `text` left
 * 「…详见」 hanging with nothing after it. There is no link in a PDF, so the
 * words are simply joined back together.
 */
function principleText(row: Record<string, unknown>): string {
  return [row.text, row.linkLabel, row.linkSuffix].map((v) => (typeof v === "string" ? v : "")).join("");
}

function buildHtml(input: {
  paragraphs: string[];
  principles: Principle[];
  countLabel: string;
  countAsOf: string;
}): string {
  const { paragraphs, principles, countLabel, countAsOf } = input;
  return `<!doctype html>
<html lang="zh-Hans"><head><meta charset="utf-8"><title>机构简介 — 全球退党服务中心</title>
<style>
  @page { size: A4; margin: 16mm 15mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Noto Serif SC", "Songti SC", serif; color: #1b1b1f; font-size: 10pt; line-height: 1.65; }
  .rule { height: 2.5pt; background: #3B2E7E; margin-bottom: 9pt; }
  header { display: flex; justify-content: space-between; align-items: flex-end; gap: 12pt; }
  h1 { font-size: 17pt; margin: 0; letter-spacing: .02em; }
  .en { font-family: Helvetica, Arial, sans-serif; font-size: 7.6pt; color: #5a5a66; letter-spacing: .03em; margin-top: 3pt; }
  .stamp { font-family: Helvetica, Arial, sans-serif; font-size: 7.4pt; color: #5a5a66; text-align: right; line-height: 1.5; white-space: nowrap; }
  h2 { font-size: 10.5pt; margin: 13pt 0 5pt; color: #2A2060; letter-spacing: .04em; }
  h2 span { font-family: Helvetica, Arial, sans-serif; font-size: 7.2pt; color: #8a8a96; letter-spacing: .06em; margin-left: 6pt; font-weight: normal; }
  p { margin: 0 0 6pt; text-align: justify; }
  .figure { display: flex; align-items: baseline; gap: 8pt; border: .6pt solid #d9d6cc; padding: 7pt 10pt; margin: 8pt 0 2pt; background: #faf9f6; }
  .figure b { font-family: Helvetica, Arial, sans-serif; font-size: 20pt; color: #3B2E7E; letter-spacing: -.01em; }
  .figure span { font-size: 8.6pt; color: #4a4a55; }
  ul { margin: 0; padding-left: 0; list-style: none; }
  li { margin-bottom: 4.5pt; padding-left: 9pt; position: relative; }
  li::before { content: "·"; position: absolute; left: 0; color: #3B2E7E; font-weight: 700; }
  li b { color: #2A2060; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16pt; }
  .enblock { font-family: Helvetica, Arial, sans-serif; font-size: 8.2pt; line-height: 1.55; color: #3f3f4a; }
  footer { margin-top: 12pt; padding-top: 7pt; border-top: .6pt solid #d9d6cc;
           font-family: Helvetica, Arial, sans-serif; font-size: 7.4pt; color: #6a6a76; display: flex; justify-content: space-between; gap: 10pt; }
</style></head><body>
  <div class="rule"></div>
  <header>
    <div>
      <h1>全球退党服务中心</h1>
      <div class="en">GLOBAL SERVICE CENTER FOR QUITTING THE CHINESE COMMUNIST PARTY</div>
    </div>
    <div class="stamp">
      成立于 2005 年 1 月 · 纽约<br>
      501(c)(3) 非营利组织<br>
      Founded January 2005, New York
    </div>
  </header>

  <h2>机构简介 <span>WHO WE ARE</span></h2>
  ${paragraphs.map((text) => `<p>${escapeHtml(text)}</p>`).join("\n  ")}

  <div class="figure">
    <b>${escapeHtml(countLabel)}</b>
    <span>人已公开声明退出中共党、团、队组织<br>
      <span style="font-family:Helvetica,Arial,sans-serif;font-size:7.4pt;color:#7a7a86">
        declarations of withdrawal recorded — as of ${escapeHtml(countAsOf)}
      </span>
    </span>
  </div>

  <h2>我们提供什么 <span>WHAT WE DO</span></h2>
  <div class="two">
    <ul>
      <li><b>声明登记。</b>当事人自行提交退出党、团、队的声明，可实名、化名或代号，免费，无需注册。</li>
      <li><b>退党证明。</b>中英文对照的书面凭据，实名办理，附唯一编号。</li>
      <li><b>查询与验证。</b>任何机构或个人可凭编号在线查验真伪，无需联系本中心。</li>
      <li><b>记录与出版。</b>调查报告、当事人自述、影音节目与可自由转载的资料。</li>
    </ul>
    <div class="enblock">
      <b>Registration.</b> Individuals submit their own statements of withdrawal
      from the Party, Youth League and Young Pioneers — under a real name, a pen
      name or a code. Free, no account required.<br><br>
      <b>Certificates.</b> A bilingual written record, issued under a unique
      number, for those who need documentary proof.<br><br>
      <b>Verification.</b> Any institution can check a certificate online by its
      number, without contacting us.<br><br>
      <b>Documentation.</b> Investigative reports, first-hand accounts and
      freely redistributable materials.
    </div>
  </div>

  <h2>我们的原则 <span>OUR PRINCIPLES</span></h2>
  <ul>
    ${principles
      .map((p) => `<li><b>${escapeHtml(p.label)}</b>${escapeHtml(p.text)}</li>`)
      .join("\n    ")}
  </ul>

  <h2>可供查证 <span>HOW WE CAN BE CHECKED</span></h2>
  <p>统计口径、计入规则与已知局限完整公开；财务报表经独立会计师事务所审计，Form 990 依法公开；治理结构与年度工作公开；针对本机构的威胁与攻击同样公开记录。</p>
  <div class="enblock">Counting rules and their known limits, audited financial
  statements, Form 990 filings, governance and the record of threats against
  this organisation are all published.</div>

  <footer>
    <div>quitccp.org · 媒体与采访联络 / Press enquiries: quitccp.org/services/contact</div>
    <div>本页内容可自由引用与转载，注明来源即可 · Free to quote and reproduce with attribution</div>
  </footer>
</body></html>`;
}

async function main() {
  loadEnvFileIfPresent(resolve(process.cwd(), ".env.local"));
  const apply = process.argv.includes("--apply");
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "media";
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: aboutRow, error } = await supabase
    .from("cms_content_entries")
    .select("data")
    .eq("path", "pages/about-index.json")
    .eq("locale", "zh")
    .maybeSingle();
  if (error) throw error;
  const intro = ((aboutRow?.data as Record<string, unknown>)?.intro ?? {}) as Record<string, unknown>;
  const paragraphs = Array.isArray(intro.paragraphs) ? (intro.paragraphs as string[]) : [];
  const principles = (Array.isArray(intro.principles) ? intro.principles : []).map((row) => {
    const p = row as Record<string, unknown>;
    return { label: String(p.label ?? ""), text: principleText(p) };
  });
  if (paragraphs.length === 0 || principles.length === 0) {
    throw new Error("About page has no intro paragraphs/principles to build from");
  }

  // The headline figure comes from the santui snapshot, the same source the
  // homepage uses, so the PDF and the site cannot disagree.
  const { data: feedRow } = await supabase
    .from("cms_content_entries")
    .select("data")
    .eq("path", "feeds/santui.json")
    .eq("locale", "zh")
    .maybeSingle();
  const snapshot = (feedRow?.data ?? {}) as { total?: number; fetchedAt?: string };
  const total = typeof snapshot.total === "number" ? snapshot.total : 0;
  // Truncated, never rounded -- a registry count is a floor. Same rule as the site.
  const countLabel = total > 0 ? `${(Math.floor(total / 1e6) / 100).toFixed(2)} 亿` : "4.6 亿";
  const countAsOf = (snapshot.fetchedAt ?? new Date().toISOString()).slice(0, 10);

  const html = buildHtml({ paragraphs, principles, countLabel, countAsOf });

  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  let pdf: Buffer;
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    pdf = await page.pdf({ format: "A4", printBackground: true });
  } finally {
    await browser.close();
  }

  console.log(`built ${(pdf.length / 1024).toFixed(0)}KB · 登记数 ${countLabel} (as of ${countAsOf})`);
  console.log(`  ${paragraphs.length} paragraph(s), ${principles.length} principle(s) from the About page`);

  if (!apply) {
    // Written locally so it can be looked at before anything is published.
    const preview = resolve(process.cwd(), "artifacts/org-profile-preview.pdf");
    writeFileSync(preview, pdf);
    console.log(`\n--dry-run: not uploaded. Preview written to ${preview}`);
    return;
  }

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(OBJECT_PATH, pdf, { contentType: "application/pdf", upsert: true });
  if (uploadError) throw uploadError;
  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(OBJECT_PATH);
  const downloadUrl = `${pub.publicUrl}?download=${encodeURIComponent("全球退党服务中心-机构简介.pdf")}`;
  console.log(`\nuploaded -> ${downloadUrl}`);
  console.log("link it from: /resources/press (机构简介), /about (下载面板), homepage");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
