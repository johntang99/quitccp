/**
 * 新加的中文文案，是不是原封不动从代码里搬进来的。
 *
 * B 阶段每一批都在做同一件事：把写死在组件里的中文搬进 zh.ts。搬动本身必须
 * 是零改动 ——《编辑手册》里印着后台那些名字，侧栏的「Dashboard」顺手改成
 * 「总览」不是改进，是让手册对不上；一句话被拆成两句，编辑第二天就会觉得
 * 后台「哪里不一样了」但说不出哪里。
 *
 * 为什么不只靠 admin:snapshot：
 * 快照比的是渲染出来的页面，而页面上混着数据库里的实时数据。一旦为了挡住
 * 数据波动而给页面加 data-snapshot 标记，旧基线就比标记旧了 —— 那之后快照
 * 只能证明「从现在起没变」，证明不了「这一批没变」。
 *
 * 这个检查不渲染任何东西：直接拿 git 里改动前的源码，和新加的 zh 条目对。
 *
 *     npm run zh:unchanged            # 和 HEAD 比
 *     npm run zh:unchanged -- <ref>   # 和指定提交比
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const REF = process.argv.find((a) => !a.startsWith("-") && a !== process.argv[0] && a !== process.argv[1]) ?? "HEAD";

function git(args: string): string {
  return execSync(`git ${args}`, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

/** 空白压平：源码里换行加缩进的一句话，搬进文案表是一行。 */
const flat = (s: string) => s.replace(/\s+/g, " ").trim();

/** 一张表里的 key → 值。 */
function parseTable(src: string): Map<string, string> {
  const out = new Map<string, string>();
  /* 文案表是手写的字面量，一行一条，值里不会有未转义的引号。 */
  const re = /^\s*"([^"]+)":\s*"((?:[^"\\]|\\.)*)"/gm;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    out.set(m[1], m[2].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
  }
  return out;
}

const HAN = /[一-鿿]/;

function main() {
  const before = parseTable(git(`show ${REF}:apps/web/src/lib/i18n/zh.ts`));
  const after = parseTable(readFileSync("apps/web/src/lib/i18n/zh.ts", "utf8"));

  const added = [...after].filter(([k]) => !before.has(k));
  const changed = [...after].filter(([k, v]) => before.has(k) && before.get(k) !== v);

  /* 改动涉及的文件，改动前的内容全拼在一起 —— 搬文案时一条可能来自任意一个。 */
  /* packages 也要看：首页版式名的原文在 packages/content-schema 里，
     而翻译时它们被搬进了后台的文案表。只看 apps/web/src 的话，这 35 条
     全会报成「找不到原文」。 */
  const files = git(`diff --name-only ${REF} -- apps/web/src packages`)
    .split("\n")
    .map((f) => f.trim())
    .filter((f) => f && !f.includes("/lib/i18n/"));
  let haystack = "";
  for (const f of files) {
    try {
      haystack += `\n${git(`show ${REF}:${f}`)}`;
    } catch {
      /* 新建的文件在 ref 里不存在，跳过。 */
    }
  }
  /*
   * 改动前的 zh 表也算「原文」。
   *
   * 把一条文案从 admin.art.* 挪到 admin.list.*（两个页面共用的词），在这里看
   * 起来就是「新增了一条，而源码里找不到」—— 可是字一个没变，它只是换了个
   * key 名。改名也该能被看出来，所以把旧表一并当作比对源：值还在旧表里，
   * 就是改名，不是改字。
   */
  const haystackWithOldTable = `${haystack}\n${git(`show ${REF}:apps/web/src/lib/i18n/zh.ts`)}`;

  /*
   * 源码里跨行拼接的字符串，在 flat 之后中间夹着一个加号。
   *
   *     `最近改过的那篇文章（${article.slug}）……` +
   *     "但线上页面里没有这个标题 —— ……" +
   *     "编辑的改动不会出现在网站上……"
   *
   * 渲染出来是连着的一句，而这里按连续子串找就断在那个加号上。模板字符串和
   * 普通字符串会混着用，所以两种引号都要认 —— 只认双引号时，自检那七条
   * remedy 全都报成了「找不到原文」，而它们一个字都没改。
   */
  const flatHay = flat(haystackWithOldTable).replace(/[`"]\s*\+\s*[`"]/g, "");

  const newZh = added.filter(([, v]) => HAN.test(v));
  const missing = newZh.filter(([, v]) => {
    /* 占位符那一段按原样对不上（源码里是 ${x} 或 {x} 外的表达式），
       所以按占位符切开，每一段都得在原文里找到。 */
    return flat(v)
      .split(/\{\w+\}/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 2 && HAN.test(part))
      .some((part) => !flatHay.includes(part));
  });

  console.log(`\n  和 ${REF} 比：新增 ${added.length} 条文案，其中带中文的 ${newZh.length} 条`);
  console.log(`  改动涉及 ${files.length} 个文件`);

  if (changed.length > 0) {
    console.log(`\n  ✗ ${changed.length} 条已有文案的中文被改了：`);
    for (const [k, v] of changed.slice(0, 20)) {
      console.log(`      ${k}`);
      console.log(`        － ${before.get(k)}`);
      console.log(`        ＋ ${v}`);
    }
  }

  if (missing.length > 0) {
    console.log(`\n  ✗ ${missing.length} 条新文案在改动前的源码里找不到原文：`);
    for (const [k, v] of missing.slice(0, 25)) {
      console.log(`      ${k}`);
      console.log(`        ${v.slice(0, 150)}`);
    }
    console.log(`\n    要么是把字改了（不该），要么这条本来就是新写的文案（那就正常，`);
    console.log(`    但值得自己确认一遍是不是真的新写）。`);
  }

  if (changed.length === 0 && missing.length === 0) {
    console.log(`\n  ✓ 新加的 ${newZh.length} 条中文文案全都能在改动前的源码里逐字找到`);
    return;
  }
  process.exit(1);
}

main();
