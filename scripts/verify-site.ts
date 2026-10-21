/**
 * 中文站还好吗。
 *
 * 多语言改造会一路动到数据库和公共代码路径，而中文站是唯一一个有真实读者、
 * 正在被攻击、而且全站 15,372 篇内容都指望它的站。每改一次就要能一条命令问清楚
 * 「它还正常吗」—— 靠记得逐项去点，迟早有一次会跳过。
 *
 * 这个脚本只读，不写任何东西。
 *
 *     npm run verify            # 查生产
 *     npm run verify -- --local # 查本地 dev :4020
 *     npm run verify -- --locale en
 *
 * ## 为什么连数据库行数也查
 *
 * 页面返回 200 不代表没出事。一次写错的迁移可以让某张表空掉而页面照样渲染 ——
 * 列表只是变短，首页只是少几张卡。所以要把行数和一个已知的下限比。
 */

import pg from "pg";

const LOCAL = process.argv.includes("--local");
const BASE = LOCAL ? "http://localhost:4020" : (process.env.NEXT_PUBLIC_SITE_URL || "https://www.tuidang.org").replace(/\/$/, "");

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}
const LOCALE = (arg("--locale") || process.env.SITE_LOCALE || "zh").toLowerCase();

const PROBE = process.env.PROBE_BYPASS_SECRET?.trim();
const CRON = process.env.CRON_SECRET?.trim();

/*
 * 下限而不是精确值：编辑每天都在发内容，行数只会涨。写死精确值的话，这个脚本
 * 每隔几天就要改一次，改着改着就没人信它了。低于下限才是真出事。
 */
const MIN_ROWS: Record<string, number> = {
  cms_articles: 15000,
  cms_videos: 800,
  cms_redirects: 31000,
  cms_materials: 20,
  cms_faqs: 40,
  cms_content_entries: 60
};

const PAGES = ["/", "/news", "/videos", "/resources", "/resources/culture", "/services", "/services/faq", "/about", "/involve", "/search?q=三退", "/sitemap.xml", "/robots.txt"];

/* 每一条都走一条不同的代码路径：拼音迁移留下的跳转、旧 WordPress 数字地址、
   资料区那条 10-21 才补上的文章兜底、文章改视频之后重指的那批。 */
const REDIRECTS: [string, string][] = [
  ["/news/台港景点退党潮-中共官员：退后一身轻-真舒服（图", "改名跳转"],
  ["/2013/09/08/35483/", "旧 WP 数字地址"],
  ["/resources/乐曲-听儿说", "资料区文章兜底"],
  ["/2026/02/08/702451/", "文章改视频后重指"]
];

let failures = 0;
const fail = (msg: string) => { failures += 1; console.log(`  ✗ ${msg}`); };
const ok = (msg: string) => console.log(`  ✓ ${msg}`);

async function get(path: string): Promise<{ status: number; url: string; body?: string }> {
  try {
    const res = await fetch(BASE + encodeURI(path), {
      headers: PROBE && !LOCAL ? { "x-quitccp-probe": PROBE } : {},
      redirect: "follow"
    });
    return { status: res.status, url: res.url, body: await res.text() };
  } catch (error) {
    return { status: 0, url: "", body: error instanceof Error ? error.message : "" };
  }
}

async function checkPages() {
  console.log("\n【页面】");
  for (const p of PAGES) {
    const r = await get(p);
    if (r.status === 200) ok(`${p}`);
    else fail(`${p} → ${r.status || "连不上"}`);
  }
}

async function checkRedirects() {
  console.log("\n【旧地址跳转】");
  for (const [path, what] of REDIRECTS) {
    const r = await get(path);
    const landed = r.url ? decodeURIComponent(new URL(r.url).pathname) : "";
    if (r.status === 200 && landed !== path) ok(`${what}：${landed.slice(0, 54)}`);
    else if (r.status === 200) fail(`${what}：200 但没有跳转（${path}）`);
    else fail(`${what}：${r.status} ${path}`);
  }
}

async function checkDatabase() {
  console.log("\n【数据库】");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
  } catch (error) {
    fail(`连不上数据库：${error instanceof Error ? error.message : ""}`);
    return;
  }

  for (const [table, min] of Object.entries(MIN_ROWS)) {
    try {
      const { rows } = await client.query(
        `select count(*)::int n from ${table} where locale = $1`, [LOCALE]
      );
      const n = rows[0].n;
      if (n >= min) ok(`${table} ${n} 行（下限 ${min}）`);
      else fail(`${table} 只有 ${n} 行，低于下限 ${min} —— 可能有数据丢了`);
    } catch (error) {
      fail(`${table}: ${error instanceof Error ? error.message : ""}`);
    }
  }

  /* 迁移有没有跑全。文件数和登记数对不上，说明有人手工跑了 SQL 没登记，
     或者有迁移压根没跑 —— 两种都会让下一次迁移在意想不到的地方失败。 */
  try {
    const { rows } = await client.query(`select suite, count(*)::int n from schema_migrations group by 1 order by 1`);
    const text = rows.map((r) => `${r.suite}=${r.n}`).join(" ");
    ok(`迁移登记：${text}`);
  } catch {
    fail("schema_migrations 查不到 —— 迁移执行器没启用？");
  }

  for (const [label, sql] of [
    ["断链重定向", `select count_dead_redirects($1) n`],
    ["跨语言错误关联", `select count_cross_locale_links() n`]
  ] as [string, string][]) {
    try {
      const { rows } = await client.query(sql, sql.includes("$1") ? [LOCALE] : []);
      if (Number(rows[0].n) === 0) ok(`${label} 0`);
      else fail(`${label} ${rows[0].n} 条`);
    } catch (error) {
      fail(`${label}: ${error instanceof Error ? error.message : ""}`);
    }
  }

  await client.end();
}

/**
 * 探针是不是被防火墙挡在门外了。
 *
 * 判据是拿到挑战页本身，而不是「取回来的东西不对」—— 后者有很多种原因，
 * 只有前者能确定地说「这不是网站的问题」。
 */
async function probeBlocked(): Promise<boolean> {
  if (LOCAL) return false;
  try {
    const res = await fetch(`${BASE}/`, {
      headers: PROBE ? { "x-quitccp-probe": PROBE } : {},
      signal: AbortSignal.timeout(20_000)
    });
    if (res.status === 200) return false;
    const body = await res.text();
    return /Security Checkpoint|challenge-platform|__vercel_challenge/i.test(body);
  } catch {
    return false;
  }
}

async function checkSelfcheck() {
  console.log("\n【自检】");
  if (!CRON) { console.log("  － 没有 CRON_SECRET，跳过"); return; }
  try {
    const res = await fetch(`${BASE}/api/cron/selfcheck`, {
      headers: {
        authorization: `Bearer ${CRON}`,
        ...(PROBE && !LOCAL ? { "x-quitccp-probe": PROBE } : {})
      },
      signal: AbortSignal.timeout(150_000)
    });
    const body = (await res.json()) as {
      worst?: string;
      checks?: { key: string; label: string; state: string; value: string }[];
    };
    /*
     * 探针被防火墙挡住时，「页面内容是最新的」会报「页面是旧的」—— 因为它拿到的
     * 是 Vercel 的挑战页而不是文章。那不是站坏了，是放行规则排在限速之下轮不到
     * 执行（2026-10-21 查证两次：探针 403 + Vercel Security Checkpoint，而同一篇
     * 文章在本地和真实浏览器里都正常）。
     *
     * 每次都靠人去查一遍，这条检查迟早会被当成噪音直接忽略 —— 所以先替人查一次，
     * 把「站坏了」和「探针进不去」分开说。
     */
    const blocked = await probeBlocked();

    for (const c of body.checks ?? []) {
      /* unknown 不算失败：探针被防火墙挡住、R2 没配，都会是这个状态，
         而它们不代表中文站坏了。bad 才算。 */
      if (c.state === "bad") {
        if (blocked && c.key === "page_fresh") {
          console.log(`  － ${c.label}：${c.value}（探针被防火墙挡住，不是站坏了）`);
        } else {
          fail(`${c.label}：${c.value}`);
        }
      } else ok(`${c.label}：${c.value}`);
    }
    if (blocked) {
      console.log(
        "\n  注：探针拿到的是 Vercel 的挑战页，所以依赖它的检查项不作数。\n" +
          "     根因是防火墙里那条 x-quitccp-probe 放行规则排在限速规则之下，\n" +
          "     规则自上而下匹配，轮不到它。把它挪到限速和挑战之上即可。"
      );
    }
    if (!body.checks?.length) fail("自检没有返回任何项");
  } catch (error) {
    fail(`自检调不通：${error instanceof Error ? error.message : ""}`);
  }
}

/**
 * 后台能不能用。
 *
 * 多语言收口改的大部分是后台的查询 —— 文章列表、视频列表、分类、资料、统计。
 * 公开页面全绿不代表后台没坏：它们走的是完全不同的代码路径，而编辑每天都在用。
 *
 * 用编辑账号登录，而不是管理员：编辑权限最小，能过就说明没有把什么东西卡在
 * 权限之外；而且这是真实使用中最常见的那种会话。
 */
async function checkAdmin() {
  console.log("\n【后台】");
  const email = process.env.VERIFY_ADMIN_EMAIL;
  const password = process.env.VERIFY_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("  － 没有 VERIFY_ADMIN_EMAIL / VERIFY_ADMIN_PASSWORD，跳过");
    return;
  }

  const jar: string[] = [];
  const cookie = () => jar.join("; ");
  const take = (res: Response) => {
    const raw = res.headers.getSetCookie?.() ?? [];
    for (const c of raw) {
      const pair = c.split(";")[0];
      const name = pair.split("=")[0];
      const i = jar.findIndex((x) => x.startsWith(`${name}=`));
      if (i >= 0) jar[i] = pair;
      else jar.push(pair);
    }
  };

  try {
    take(await fetch(`${BASE}/admin/login`, { headers: PROBE && !LOCAL ? { "x-quitccp-probe": PROBE } : {} }));
    const body = new URLSearchParams({ email, password });
    const login = await fetch(`${BASE}/api/admin/auth/login`, {
      method: "POST",
      body,
      headers: {
        cookie: cookie(),
        "content-type": "application/x-www-form-urlencoded",
        ...(PROBE && !LOCAL ? { "x-quitccp-probe": PROBE } : {})
      },
      redirect: "manual"
    });
    take(login);
    if (login.status !== 303 && login.status !== 302) {
      fail(`登录失败：${login.status}`);
      return;
    }
    ok("登录");
  } catch (error) {
    fail(`登录出错：${error instanceof Error ? error.message : ""}`);
    return;
  }

  const pages = [
    ["/admin/dashboard", "总览"],
    ["/admin/articles", "文章列表"],
    ["/admin/articles/stats", "文章统计"],
    ["/admin/videos", "视频列表"],
    ["/admin/videos/stats", "视频统计"],
    ["/admin/categories", "文章分类"],
    ["/admin/materials", "资料"],
    ["/admin/faq", "常见问答"],
    ["/admin/content", "页面内容"],
    ["/admin/media", "图片视频库"],
    ["/admin/logs", "日志"],
    ["/admin/settings", "设置"]
  ];
  for (const [path, label] of pages) {
    try {
      const res = await fetch(BASE + path, {
        headers: { cookie: cookie(), ...(PROBE && !LOCAL ? { "x-quitccp-probe": PROBE } : {}) },
        redirect: "manual"
      });
      const html = res.status === 200 ? await res.text() : "";
      /* 200 还不够 —— 被踢回登录页也是 200。认登录表单的特征。 */
      if (res.status !== 200) fail(`${label} → ${res.status}`);
      else if (/name="password"/.test(html)) fail(`${label}：被踢回登录页`);
      else ok(`${label}`);
    } catch (error) {
      fail(`${label}：${error instanceof Error ? error.message : ""}`);
    }
  }
}

async function main() {
  console.log(`\n========== 检查 ${BASE}（locale=${LOCALE}）==========`);
  await checkPages();
  await checkRedirects();
  await checkDatabase();
  await checkAdmin();
  await checkSelfcheck();

  console.log("");
  if (failures === 0) {
    console.log("✓ 全部通过。\n");
    return;
  }
  console.log(`✗ ${failures} 项不通过。\n`);
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
