/**
 * 英文站实际渲染出来还有多少中文 —— 后台或公开站。
 *
 * ## 为什么不看文件里的字数就够
 *
 * check-i18n 数的是「源码里写死了多少汉字」，按文件排。那个数字用来估工作量
 * 很好，但回答不了「英文编辑打开这一页，眼前还有多少中文」：
 *
 *   - 一句话写在共用组件里，字数只算一次，渲染出来每个条目一份
 *     （section-fields 的「选择图片…」88 字，一页上出现 428 个汉字）
 *   - 一页的文案可能散在好几个文件里，单看哪个文件都像翻完了
 *     （总览页翻完了，自检标签在 defense-status.ts 里还是中文）
 *   - 反过来，源码里的中文也可能根本不渲染（兜底、死分支）
 *
 * 所以这里不读源码，直接用英文站的后台账号把页面取下来，数渲染结果里的汉字。
 * 排在前面的就是「英文编辑最先看见的中文」。
 *
 *     npm run admin:rendered     # 后台 29 页（要登录）
 *     npm run site:rendered      # 公开站（不用登录）
 *
 * 后台那一档需要 VERIFY_ADMIN_EMAIL / VERIFY_ADMIN_PASSWORD，并且那个账号的
 * 权限要够 —— 编辑看不到用户管理、审计、日志、主题，用编辑账号跑会漏掉四页。
 *
 * ## 公开站这一档量的是另一件事
 *
 * 后台的中文在源码里，翻译就是把它搬进语言包。公开站的中文**几乎全在数据里**：
 * 首页区块、导航标签、统计数字的说明，都来自 cms_content_entries。英文站一条
 * locale='en' 的记录都没有，于是整站回落到 @quitccp/content-schema 里那份中文
 * 原型内容 —— 所以这个数字降下来靠的是播种，不是改代码。
 */

const PUBLIC_MODE = process.argv.includes("--public");
const BASE = process.env.RENDERED_BASE ?? "http://localhost:4021";

/*
 * 防火墙挑战页的绕行票。
 *
 * 本地不需要，打生产必须有 —— 没有它，取回来的每一页都是挑战页，差异会是
 * 「整站文案全变了」。只在非 localhost 时附带：本地根本没有那道防护，多发
 * 一个头没意义。
 */
const PROBE = process.env.PROBE_BYPASS_SECRET?.trim();
const REMOTE = !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(BASE);
const probeHeaders: Record<string, string> = PROBE && REMOTE ? { "x-quitccp-probe": PROBE } : {};


/*
 * 公开站。和 verify-site 的清单对齐，另外补上几个只有在栏目页上才看得见的
 * 页面 —— 首页干净了不代表栏目页干净。
 */
const PUBLIC_PAGES = [
  "/", "/news", "/videos", "/resources", "/resources/culture", "/resources/downloads",
  "/services", "/services/faq", "/services/declare", "/services/cert",
  "/about", "/about/history", "/about/team", "/involve", "/involve/volunteer",
  "/search?q=quit"
];

const ADMIN_PAGES = [
  "/admin/dashboard", "/admin/content", "/admin/articles", "/admin/articles/new",
  "/admin/articles/latest", "/admin/articles/stats", "/admin/categories",
  "/admin/videos", "/admin/videos/new", "/admin/videos/stats", "/admin/video-categories",
  "/admin/video-studio", "/admin/materials", "/admin/materials/new",
  "/admin/material-categories", "/admin/faq", "/admin/faq/new", "/admin/faq/categories",
  "/admin/media", "/admin/theme", "/admin/users", "/admin/users/guide",
  "/admin/cert-stats", "/admin/audit", "/admin/logs", "/admin/revisions",
  "/admin/account", "/admin/settings", "/admin/declarations"
];

const PAGES = PUBLIC_MODE ? PUBLIC_PAGES : ADMIN_PAGES;

/**
 * 去掉标了 data-snapshot="data" 的区块。
 *
 * 和 snapshot-admin 一个道理：媒体库列的是文件名、日志列的是请求，那些是
 * 数据不是文案。不剥掉的话媒体库会因为「法天安門.jpg」这种文件名排到前面，
 * 而那一页的界面其实已经翻完了。
 */
function stripDataRegions(html: string): string {
  const open = /<(\w+)\b[^>]*\bdata-snapshot="data"[^>]*>/i;
  let out = html;
  /*
   * 上限只是防死循环，不是预算 —— 一页上有多少个数据区，是页面说了算。
   * 原来写 200，而审计日志一页正好列 200 行：上限用光，剩下的行一个没剥，
   * 这个检查就天天报「审计页文案变了」。基线里 ⟪数据⟫ 的个数恰好等于上限，
   * 就是撞到这里的指纹。
   */
  for (let guard = 0; guard < 20_000; guard += 1) {
    const m = open.exec(out);
    if (!m) break;
    const tag = m[1];
    const start = m.index;
    const scan = new RegExp(`<${tag}\\b[^>]*>|</${tag}\\s*>`, "gi");
    scan.lastIndex = start;
    let depth = 0;
    let end = -1;
    for (let tk = scan.exec(out); tk; tk = scan.exec(out)) {
      depth += tk[0].startsWith("</") ? -1 : 1;
      if (depth === 0) { end = tk.index + tk[0].length; break; }
    }
    if (end < 0) break;
    out = `${out.slice(0, start)} ${out.slice(end)}`;
  }
  return out;
}

/**
 * 语言自称不算「没翻译」。
 *
 * 语言选择器里的「中文」「日本語」「한국어」本来就该是那种语言写的 —— 在英文
 * 界面里把「日本語」写成「Japanese」才是错的。不排除的话每一页都挂着 3 个汉字，
 * 「这一页干净了」就永远到不了。
 */
const ENDONYMS = ["中文", "日本語"];

/** 看得见的文字：去掉标记、脚本、样式，并把属性里的文案也算上。 */
function visibleText(html: string): string {
  return stripDataRegions(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*\b(placeholder|aria-label|title|alt)="([^"]*)"[^>]*>/gi, (m, _a, v) => ` ${v} `)
    .replace(/<[^>]+>/g, " ");
}

/** 数汉字，但不数语言自称。 */
function countHan(text: string): number {
  let t = text;
  for (const word of ENDONYMS) t = t.split(word).join(" ");
  return (t.match(HAN) ?? []).length;
}

async function login(): Promise<string> {
  const email = process.env.VERIFY_ADMIN_EMAIL;
  const password = process.env.VERIFY_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("需要 VERIFY_ADMIN_EMAIL / VERIFY_ADMIN_PASSWORD");
  const jar: string[] = [];
  const take = (res: Response) => {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const pair = c.split(";")[0];
      const name = pair.split("=")[0];
      const i = jar.findIndex((x) => x.startsWith(`${name}=`));
      if (i >= 0) jar[i] = pair;
      else jar.push(pair);
    }
  };
  take(await fetch(`${BASE}/admin/login`, { headers: probeHeaders }));
  const res = await fetch(`${BASE}/api/admin/auth/login`, {
    method: "POST",
    body: new URLSearchParams({ email, password }),
    headers: { cookie: jar.join("; "), "content-type": "application/x-www-form-urlencoded", ...probeHeaders },
    redirect: "manual"
  });
  take(res);
  if (res.status !== 303 && res.status !== 302) throw new Error(`登录失败：${res.status}`);
  return jar.join("; ");
}

/* 两个：一个数个数（带 g），一个找位置（不带 g）。同一个带 g 的正则在
   match 和 search 之间会带着 lastIndex 走，找出来的位置就不对了。 */
const HAN = /[一-鿿]/g;
const HAN_ONE = /[一-鿿]/;

async function main() {
  /* 公开站不用登录；后台每一页都要。 */
  const cookie = PUBLIC_MODE ? "" : await login();
  const rows: { page: string; han: number; sample: string }[] = [];
  let unreachable = 0;

  for (const page of PAGES) {
    const res = await fetch(BASE + page, { headers: { cookie, ...probeHeaders }, redirect: "manual" });
    if (res.status !== 200) {
      console.log(`  ？ ${page} → ${res.status}`);
      unreachable += 1;
      continue;
    }
    const text = visibleText(await res.text());
    const han = countHan(text);
    /* 取一小段上下文，好认出是哪句话。 */
    let stripped = text;
    for (const word of ENDONYMS) stripped = stripped.split(word).join(" ");
    const first = stripped.search(HAN_ONE);
    const sample = first < 0 ? "" : stripped.slice(first, first + 26).replace(/\s+/g, "");
    rows.push({ page, han, sample });
  }

  rows.sort((a, b) => b.han - a.han);
  const total = rows.reduce((n, r) => n + r.han, 0);

  const what = PUBLIC_MODE ? "公开站" : "后台";
  console.log(`\n  英文站${what}：${rows.length} 页，渲染出来共 ${total} 个汉字\n`);
  for (const r of rows) {
    if (r.han === 0) continue;
    console.log(`  ${String(r.han).padStart(5)}  ${r.page.padEnd(32)} ${r.sample}…`);
  }
  const clean = rows.filter((r) => r.han === 0).length;
  console.log(`\n  ${clean} 页已经没有中文。`);
  if (unreachable > 0) {
    console.log(`  ${unreachable} 页取不到 —— 权限不够的话会这样（编辑看不到用户管理、审计、日志、主题）。`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
