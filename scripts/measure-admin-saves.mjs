/**
 * Times what an editor actually waits for.
 *
 *   node --env-file=.env.local scripts/measure-admin-saves.mjs [--articles 10] [--videos 10]
 *
 * Every number here comes from the real admin endpoints with a real session --
 * the same POST the browser makes when somebody presses 保存. Timing the
 * database directly would have missed the two things that actually cost an
 * editor time: the page render that precedes the save, and the taxonomy,
 * revision and audit writes that follow it.
 *
 * Nothing is modified. Each item is read out of its own edit form and posted
 * back exactly as it came, so a run leaves the content byte-identical and can
 * be repeated as often as a measurement needs.
 */

const BASE = process.env.MEASURE_BASE_URL ?? "http://localhost:4020";
const argv = process.argv.slice(2);
const countFor = (flag, fallback) => {
  const i = argv.indexOf(flag);
  return i === -1 ? fallback : Number(argv[i + 1]) || fallback;
};
const WANT_ARTICLES = countFor("--articles", 10);
const WANT_VIDEOS = countFor("--videos", 10);

const rest = (path, init = {}) =>
  fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      ...init.headers
    }
  });

/** Log in the way a person does, and keep the cookies. */
async function signIn() {
  const body = new URLSearchParams({
    email: process.env.SEED_ADMIN_EMAIL,
    password: process.env.SEED_ADMIN_PASSWORD
  });
  const response = await fetch(`${BASE}/api/admin/auth/login`, {
    method: "POST",
    body,
    redirect: "manual"
  });
  const jar = (response.headers.getSetCookie?.() ?? [])
    .map((line) => line.split(";")[0])
    .join("; ");
  if (!jar) throw new Error(`登录失败（${response.status}），拿不到 cookie`);
  return jar;
}

/**
 * Read an edit form into the exact field set the browser would post.
 *
 * Parsed with regex rather than a DOM library on purpose: this script exists
 * to measure the admin, and adding a dependency to the repo to do it would
 * cost more than it tells us.
 *
 * Checkboxes only appear in a POST when checked, and file inputs never carry a
 * value, so both are skipped rather than sent empty -- posting those back
 * wrong is how a measurement quietly turns into an edit.
 */
function readForm(html, formMarker) {
  /* Anchored on the form's own action, not on "<form": every admin page also
     carries a search box and a logout form, and the first match was the search
     box -- which posts no title, so every video "failed" with 请填写标题 and
     the measurement blamed the app for the harness's mistake. */
  const marker = html.indexOf(formMarker);
  const at = marker === -1 ? -1 : html.lastIndexOf("<form", marker);
  if (at === -1) return null;
  const end = html.indexOf("</form>", at);
  const form = html.slice(at, end === -1 ? undefined : end);

  const unescape = (text) =>
    text
      .replaceAll("&quot;", '"')
      .replaceAll("&#39;", "'")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&amp;", "&");

  const fields = {};
  for (const tag of form.match(/<input[^>]*>/g) ?? []) {
    const name = tag.match(/name="([^"]+)"/)?.[1];
    if (!name) continue;
    const type = (tag.match(/type="([^"]+)"/)?.[1] ?? "text").toLowerCase();
    if (type === "file" || type === "submit" || type === "button") continue;
    const value = unescape(tag.match(/value="([^"]*)"/)?.[1] ?? "");
    if (type === "checkbox" || type === "radio") {
      if (/\schecked(\s|=|>|\/)/.test(tag)) fields[name] = value || "1";
      continue;
    }
    fields[name] = value;
  }
  for (const m of form.matchAll(/<textarea[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/textarea>/g)) {
    fields[m[1]] = unescape(m[2]);
  }
  for (const m of form.matchAll(/<select[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
    const body = m[2];
    const chosen =
      body.match(/<option[^>]*value="([^"]*)"[^>]*\sselected/) ??
      body.match(/<option[^>]*\sselected[^>]*value="([^"]*)"/) ??
      body.match(/<option[^>]*value="([^"]*)"/);
    fields[m[1]] = unescape(chosen?.[1] ?? "");
  }
  return Object.keys(fields).length ? fields : null;
}

const ms = (start) => Date.now() - start;

async function timeOne(jar, { editPath, formMarker, postPath, label }) {
  const openedAt = Date.now();
  const page = await fetch(`${BASE}${editPath}`, { headers: { cookie: jar } });
  const html = await page.text();
  const open = ms(openedAt);
  if (!page.ok) return { label, ok: false, open, save: 0, why: `打开编辑页 ${page.status}` };

  const fields = readForm(html, formMarker);
  if (!fields) return { label, ok: false, open, save: 0, why: "页面里找不到表单" };

  const savedAt = Date.now();
  const response = await fetch(`${BASE}${postPath}`, {
    method: "POST",
    headers: {
      cookie: jar,
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json"
    },
    body: new URLSearchParams(fields),
    redirect: "manual"
  });
  const save = ms(savedAt);
  const text = await response.text();
  const ok = response.status < 400;
  return {
    label,
    ok,
    open,
    save,
    why: ok ? "" : `${response.status} ${text.slice(0, 120)}`
  };
}

function report(title, rows) {
  const good = rows.filter((r) => r.ok);
  const bad = rows.filter((r) => !r.ok);
  const nums = (pick) => good.map(pick).sort((a, b) => a - b);
  const stat = (list) =>
    list.length
      ? {
          min: list[0],
          median: list[Math.floor(list.length / 2)],
          max: list[list.length - 1],
          mean: Math.round(list.reduce((a, b) => a + b, 0) / list.length)
        }
      : { min: 0, median: 0, max: 0, mean: 0 };
  const open = stat(nums((r) => r.open));
  const save = stat(nums((r) => r.save));

  console.log(`\n  ${title}`);
  console.log(`  ${"─".repeat(72)}`);
  for (const r of rows) {
    const mark = r.ok ? "✓" : "✗";
    console.log(
      `  ${mark} ${String(r.open).padStart(5)}ms 开  ${String(r.save).padStart(5)}ms 存   ${r.label.slice(0, 34)}${r.why ? "  " + r.why : ""}`
    );
  }
  console.log(`  ${"─".repeat(72)}`);
  console.log(`  成功 ${good.length}/${rows.length}${bad.length ? `，失败 ${bad.length}` : ""}`);
  console.log(`  打开编辑页   最快 ${open.min}ms   中位 ${open.median}ms   最慢 ${open.max}ms   平均 ${open.mean}ms`);
  console.log(`  保存         最快 ${save.min}ms   中位 ${save.median}ms   最慢 ${save.max}ms   平均 ${save.mean}ms`);
  return { good: good.length, total: rows.length, open, save };
}

const jar = await signIn();
console.log(`  已登录 ${BASE}`);

const { data: articles } = await (
  await rest(`cms_articles?select=id,title&status=eq.published&order=updated_at.desc&limit=${WANT_ARTICLES}`)
).json().then((rows) => ({ data: rows }));

const articleRows = [];
for (const row of articles) {
  articleRows.push(
    await timeOne(jar, {
      editPath: `/admin/articles/${row.id}`,
      formMarker: 'class="article-form"',
      postPath: "/api/admin/content/articles",
      label: row.title
    })
  );
}
const a = report(`文章 ${articleRows.length} 篇`, articleRows);

const { data: videos } = await (
  await rest(`cms_videos?select=id,title&order=updated_at.desc&limit=${WANT_VIDEOS}`)
).json().then((rows) => ({ data: rows }));

const videoRows = [];
for (const row of videos) {
  videoRows.push(
    await timeOne(jar, {
      editPath: `/admin/videos/${row.id}`,
      formMarker: 'action="/api/admin/content/videos/save"',
      postPath: "/api/admin/content/videos/save",
      label: row.title
    })
  );
}
const v = report(`影片 ${videoRows.length} 条`, videoRows);

console.log("\n  合计");
console.log(`  ${"─".repeat(72)}`);
console.log(`  文章 ${a.good}/${a.total} 成功，保存中位 ${a.save.median}ms`);
console.log(`  影片 ${v.good}/${v.total} 成功，保存中位 ${v.save.median}ms`);
console.log("");
process.exit(a.good === a.total && v.good === v.total ? 0 : 1);
