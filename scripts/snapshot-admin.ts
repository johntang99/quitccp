/**
 * 中文后台的文字快照，用来证明翻译没有改动中文界面。
 *
 * B 阶段要把后台 19,715 个汉字搬进语言包。搬动本身是机械的，危险的是手滑：
 * 把「Dashboard」顺手改成「总览」、把一句话拆成两句、漏掉一个变量。这些都不会
 * 让构建失败，也不会让页面报错 —— 中文编辑第二天打开后台才发现名字变了，而
 * 《编辑手册》里还印着旧名字。
 *
 * 所以规矩是：zh 表里的字串必须和今天代码里的一模一样。这个脚本把规矩变成
 * 一条命令：
 *
 *     npm run admin:snapshot          # 改之前，存一份
 *     npm run admin:snapshot -- --check   # 改之后，对一遍
 *
 * 数字一律归一化成 #（文章条数、时间戳每次都在变），所以差异里剩下的就是文案
 * 本身的变化 —— 一条都不该有。
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.SNAPSHOT_BASE ?? "http://localhost:4020";
const CHECK = process.argv.includes("--check");
const DIR = path.join(process.cwd(), ".admin-snapshot");

/* 编辑每天走的路径优先，但一次全拍 —— 拍的成本是零，漏拍的成本是上线后才发现。 */
const PAGES = [
  "/admin/login",
  "/admin/dashboard",
  "/admin/content",
  "/admin/articles",
  "/admin/articles/new",
  "/admin/articles/latest",
  "/admin/articles/stats",
  "/admin/categories",
  "/admin/videos",
  "/admin/videos/new",
  "/admin/videos/stats",
  "/admin/video-categories",
  "/admin/video-studio",
  "/admin/materials",
  "/admin/materials/new",
  "/admin/material-categories",
  "/admin/faq",
  "/admin/faq/new",
  "/admin/faq/categories",
  "/admin/media",
  "/admin/theme",
  "/admin/users",
  "/admin/users/guide",
  "/admin/cert-stats",
  "/admin/audit",
  "/admin/logs",
  "/admin/revisions",
  "/admin/account",
  "/admin/settings",
  "/admin/forgot"
];

/**
 * 去掉标了 data-snapshot="data" 的区块。
 *
 * 后台有一半页面是数据密集的：总览列最近的报警、搜不到结果的词、最近改过的
 * 文章；日志和审计整页都是行。这些内容每分钟都在变 —— 第一次比对时跳出来的
 * 「差异」里有 `시진핑` 和 `zzharborprobe`，后者还是自检探针自己搜进去的。
 * 把它们算进「文案变了」，这个检查三天内就会被当成噪音忽略。
 *
 * 哪些是数据由页面自己声明，不在这里猜：`<tbody>` 一类的通用规则会误伤
 * 权限表那种「表格里装的就是文案」的地方。
 */
function stripDataRegions(html: string): string {
  const open = /<(\w+)\b[^>]*\bdata-snapshot="data"[^>]*>/i;
  let out = html;
  for (let guard = 0; guard < 200; guard += 1) {
    const m = open.exec(out);
    if (!m) break;
    const tag = m[1];
    const start = m.index;
    /* 同名标签会嵌套（div 里有 div），所以要数着配对，不能找第一个 </div>。 */
    const scan = new RegExp(`<${tag}\\b[^>]*>|</${tag}\\s*>`, "gi");
    scan.lastIndex = start;
    let depth = 0;
    let end = -1;
    for (let t = scan.exec(out); t; t = scan.exec(out)) {
      depth += t[0].startsWith("</") ? -1 : 1;
      if (depth === 0) { end = t.index + t[0].length; break; }
    }
    if (end < 0) break;
    out = `${out.slice(0, start)}⟪数据⟫${out.slice(end)}`;
  }
  return out;
}

/** 看得见的文字，去掉标记、脚本和样式。 */
function visibleText(html: string): string {
  return stripDataRegions(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    /* placeholder、aria-label、title、alt 也是界面文案，标签里的也要拍进来。 */
    .replace(/<[^>]*\b(placeholder|aria-label|title|alt)="([^"]*)"[^>]*>/gi, (m, _a, v) => `\n⟦${v}⟧\n${m.replace(/"[^"]*"/g, '""')}`)
    /* 标签换成换行，不是空格：渲染出来的 HTML 基本没有换行，整页会挤成一行，
       那样差异里只能看到一条一模一样的长行，真正改了的那几个字反而看不见。
       一个文本节点一行，差异才指得到地方。 */
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    /* 数字每次都在变：条数、时间、百分比。归一化掉，剩下的差异就是文案。 */
    .replace(/\d+/g, "#")
    .replace(/[ \t ]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
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
  take(await fetch(`${BASE}/admin/login`));
  const res = await fetch(`${BASE}/api/admin/auth/login`, {
    method: "POST",
    body: new URLSearchParams({ email, password }),
    headers: { cookie: jar.join("; "), "content-type": "application/x-www-form-urlencoded" },
    redirect: "manual"
  });
  take(res);
  if (res.status !== 303 && res.status !== 302) throw new Error(`登录失败：${res.status}`);
  return jar.join("; ");
}

function fileFor(page: string): string {
  return path.join(DIR, `${page.replace(/^\/admin\/?/, "").replace(/\//g, "_") || "root"}.txt`);
}

async function main() {
  const cookie = await login();
  mkdirSync(DIR, { recursive: true });

  let changed = 0;
  let captured = 0;
  for (const page of PAGES) {
    const res = await fetch(BASE + page, { headers: { cookie }, redirect: "manual" });
    if (res.status !== 200) {
      console.log(`  ？ ${page} → ${res.status}（跳过）`);
      continue;
    }
    const text = visibleText(await res.text());
    const file = fileFor(page);

    if (!CHECK) {
      writeFileSync(file, text);
      captured += 1;
      continue;
    }
    if (!existsSync(file)) {
      console.log(`  ？ ${page}：没有快照可比（先跑一次不带 --check 的）`);
      continue;
    }
    const before = readFileSync(file, "utf8");
    captured += 1;
    if (before === text) continue;

    /*
     * 要比的是「读者看得见的字」，不是 DOM 的节点边界。
     *
     * 把一句话从「两段文字 + 一个变量」改成一条完整文案，渲染出来的字一模
     * 一样，但 React 原来在两个文本节点之间插的分隔没了，按行比就会报一条
     * 假警报。真正不能变的是把空白压平之后的那串字。
     */
    const flat = (x: string) => x.replace(/\s+/g, " ").trim();
    if (flat(before) === flat(text)) {
      console.log(`  ～ ${page}：文字没变，只是节点边界变了（已更新快照）`);
      writeFileSync(file, text);
      continue;
    }

    changed += 1;
    console.log(`\n  ✗ ${page}`);
    /* 按位置比，不按集合比：集合看不见顺序变化，也看不见重复行数变化 ——
       dashboard 第一次就是这么报了一个「变了」却列不出任何差异行的。 */
    const a = before.split("\n");
    const b = text.split("\n");
    let shown = 0;
    for (let i = 0, j = 0; (i < a.length || j < b.length) && shown < 12; ) {
      if (a[i] === b[j]) { i += 1; j += 1; continue; }
      /* 往后看一小段，判断是删了一行还是加了一行还是改了一行。 */
      const addedHere = a[i] !== undefined && b.slice(j, j + 4).includes(a[i]);
      const goneHere = b[j] !== undefined && a.slice(i, i + 4).includes(b[j]);
      if (addedHere && !goneHere) { console.log(`      ＋ ${(b[j] ?? "").slice(0, 160)}`); j += 1; }
      else if (goneHere && !addedHere) { console.log(`      － ${(a[i] ?? "").slice(0, 160)}`); i += 1; }
      else {
        if (a[i] !== undefined) console.log(`      － ${a[i].slice(0, 160)}`);
        if (b[j] !== undefined) console.log(`      ＋ ${b[j].slice(0, 160)}`);
        i += 1; j += 1;
      }
      shown += 1;
    }
    if (shown >= 12) console.log(`      …（只列前 12 处）`);
  }

  if (!CHECK) {
    console.log(`\n  存了 ${captured} 个页面的中文文案快照到 .admin-snapshot/`);
    return;
  }
  if (changed === 0) {
    console.log(`\n  ✓ ${captured} 个后台页面的中文文案一字未变`);
    return;
  }
  console.log(`\n  ✗ ${changed} 个页面的中文文案变了（上面是差异）`);
  console.log(`    翻译阶段这里应该是 0 —— 变了就是手滑，不是改进。`);
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
