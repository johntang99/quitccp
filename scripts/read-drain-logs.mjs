/**
 * Reads the log archive back out of R2.
 *
 * The drain (see workers/vercel-log-drain) writes whatever Vercel sent, as
 * NDJSON, under `logs/YYYY/MM/DD/HH/`. That is the right shape for keeping
 * things and the wrong shape for answering a question, so this is the other
 * half: give it a time range and it fetches only the hours that can matter,
 * stitches the batches back together and filters them.
 *
 * It exists because of how the question actually gets asked after an incident
 * -- "what was arriving at 03:40 on the 13th?" -- and because by the time
 * anyone asks, Vercel's own one-day window has usually closed.
 *
 *   # same R2 credentials as push-media-mirror.mjs, in the root .env.local
 *   R2_ACCOUNT_ID=...  R2_ACCESS_KEY_ID=...  R2_SECRET_ACCESS_KEY=...
 *   R2_LOG_BUCKET=tuidang-logs
 *
 *   node scripts/read-drain-logs.mjs --hours 3
 *   node scripts/read-drain-logs.mjs --from 2026-10-13T03:00 --to 2026-10-13T05:00 --status 500
 *   node scripts/read-drain-logs.mjs --hours 24 --path /news/ --summary
 *
 * Times are UTC, because that is what the archive is partitioned by and
 * silently converting them is how you end up reading the wrong hour.
 */
import { AwsClient } from "aws4fetch";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(path.join(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1] ?? true;
}
const has = (name) => process.argv.includes(`--${name}`);

const bucket = process.env.R2_LOG_BUCKET || "tuidang-logs";
const accountId = process.env.R2_ACCOUNT_ID;
const endpoint = process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;
if (!accountId || !process.env.R2_ACCESS_KEY_ID) {
  console.error("缺少 R2 凭据：请在 .env.local 里设置 R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY");
  process.exit(1);
}

const aws = new AwsClient({
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto"
});

/* The hours the range touches, as key prefixes. Listing per hour rather than
   listing the bucket keeps a question about one afternoon from paging through
   months of archive. */
function hourPrefixes(from, to) {
  const out = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), from.getUTCHours()));
  const p = (n) => String(n).padStart(2, "0");
  while (cursor <= to) {
    out.push(`logs/${cursor.getUTCFullYear()}/${p(cursor.getUTCMonth() + 1)}/${p(cursor.getUTCDate())}/${p(cursor.getUTCHours())}/`);
    cursor.setUTCHours(cursor.getUTCHours() + 1);
  }
  return out;
}

async function listKeys(prefix) {
  const keys = [];
  let token = null;
  do {
    const url = new URL(endpoint + "/" + bucket);
    url.searchParams.set("list-type", "2");
    url.searchParams.set("prefix", prefix);
    if (token) url.searchParams.set("continuation-token", token);
    const response = await aws.fetch(url.toString());
    if (response.status === 404) return keys;
    if (!response.ok) throw new Error(`列目录失败 ${response.status} ${prefix}`);
    const xml = await response.text();
    for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) keys.push(m[1]);
    token = xml.match(/<NextContinuationToken>([^<]+)</)?.[1] ?? null;
  } while (token);
  return keys;
}

async function fetchNdjson(key) {
  const response = await aws.fetch(`${endpoint}/${bucket}/${key}`);
  if (!response.ok) throw new Error(`取对象失败 ${response.status} ${key}`);
  return (await response.text()).split("\n").filter(Boolean);
}

const now = new Date();
const hours = Number(arg("hours", 0));
const from = arg("from") ? new Date(arg("from") + "Z") : new Date(now.getTime() - (hours || 1) * 3600e3);
const to = arg("to") ? new Date(arg("to") + "Z") : now;

const wantPath = arg("path");
const wantStatus = arg("status") ? Number(arg("status")) : null;
const wantGrep = arg("grep");
const summaryOnly = has("summary");
const limit = Number(arg("limit", 200));

const prefixes = hourPrefixes(from, to);
console.error(`时间范围 ${from.toISOString().slice(0, 16)} → ${to.toISOString().slice(0, 16)} UTC，共 ${prefixes.length} 个小时分区`);

const rows = [];
for (const prefix of prefixes) {
  const keys = await listKeys(prefix);
  for (const key of keys) {
    for (const line of await fetchNdjson(key)) {
      let row;
      try {
        row = JSON.parse(line);
      } catch {
        continue; /* a truncated batch should not stop the whole read */
      }
      const t = row.timestamp ?? 0;
      if (t < from.getTime() || t > to.getTime()) continue;
      const p = row.proxy?.path ?? row.path ?? row.requestPath ?? "";
      const status = row.proxy?.statusCode ?? row.statusCode ?? row.responseStatusCode;
      if (wantPath && !decodeURIComponent(p).includes(wantPath)) continue;
      if (wantStatus !== null && status !== wantStatus) continue;
      if (wantGrep && !line.includes(wantGrep)) continue;
      rows.push({ t, p, status, row });
    }
  }
}

rows.sort((a, b) => a.t - b.t);
console.error(`命中 ${rows.length} 条\n`);

if (rows.length === 0) process.exit(0);

const tally = (fn) =>
  Object.entries(rows.reduce((m, r) => ((m[fn(r)] = (m[fn(r)] || 0) + 1), m), {}))
    .sort((a, b) => b[1] - a[1]);

console.log("按状态码：", JSON.stringify(Object.fromEntries(tally((r) => r.status))));
console.log("按来源：  ", JSON.stringify(Object.fromEntries(tally((r) => r.row.source))));
console.log("按缓存：  ", JSON.stringify(Object.fromEntries(tally((r) => r.row.proxy?.vercelCache ?? r.row.cache ?? "-"))));
const waf = tally((r) => r.row.proxy?.wafAction ?? "-").filter(([k]) => k !== "-");
if (waf.length) console.log("防火墙：  ", JSON.stringify(Object.fromEntries(waf)));

console.log("\n最多的路径：");
for (const [p, n] of tally((r) => r.p).slice(0, 10)) console.log(`  ${String(n).padStart(6)}  ${decodeURIComponent(p).slice(0, 90)}`);

if (!summaryOnly) {
  console.log(`\n明细（前 ${Math.min(limit, rows.length)} 条）：`);
  for (const r of rows.slice(0, limit)) {
    const ip = r.row.proxy?.clientIp ? ` ${r.row.proxy.clientIp}` : "";
    console.log(
      `  ${new Date(r.t).toISOString().slice(11, 23)}  ${String(r.status ?? "-").padStart(3)}  ${(r.row.source ?? "-").padEnd(9)}${ip}  ${decodeURIComponent(r.p).slice(0, 80)}`
    );
  }
}
