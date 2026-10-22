/**
 * 英文站：把搬内容时带进来的几处脏东西清掉。
 *
 *     npm run clean:en                 # 预演
 *     npm run clean:en -- --apply
 *
 * 三处，都是把英文站逐页点过去才看见的 —— 数据库里都是合法的字符串，没有
 * 任何检查会报错。
 *
 * ## 一、摘要末尾的 ]]>
 *
 * 旧站的 RSS/导出把正文包在 <![CDATA[ ... ]]> 里。剥标签时开头那半边被当成
 * HTML 注释吃掉了，收尾的 ]]> 不是标签，于是原样留在摘要末尾。4 条中有 2 条
 * 的摘要**整个**就是「]]>」—— 那两篇本来就没有标题，列表里的卡片于是长成
 * 「]]>2015-02-16 Tuidang Statements Read →」。
 *
 * ## 二、指向 www.tuidang.org/wp-content 的死图
 *
 * 旧英文站的文章里引用了 15 个中文站 WordPress 上传目录下的地址。中文站早就
 * 不是 WordPress 了，这些路径现在被防火墙挡着返回 429；而且逐个查过，文件在
 * 媒体镜像上没有、在旧英文站自己的上传目录里也没有 —— 15 个全是 404，不是
 * 搬漏了，是源站本来就挂着死链。
 *
 * 留着就是读者页面上一排碎图标。删掉，连同它紧邻的说明文字一起 —— 一张图
 * 没了，下面那句「（图／某某）」留着没有意义。
 *
 * ## 三、没有标题的三篇
 *
 * 退党声明，读者投来的，源站就没写标题，slug 就是 WordPress 的帖子 ID。
 * 列表里是一张只有日期的空卡片。其中 /news/2562 连正文都没有，只有一张
 * 手写声明的照片，没有任何文字可以拿来当标题。
 *
 * 这里不替编辑拟标题 —— 退党声明是当事人的话，不该由程序给它安一个说法。
 * 改成草稿：内容还在后台，英文编辑要用的时候自己起个标题再发。
 */

import pg from "pg";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv(file: string) {
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (process.env[key] !== undefined) continue;
      process.env[key] = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    }
  } catch {
    /* 可选文件。 */
  }
}

const DEAD = "www.tuidang.org/wp-content";

/**
 * 删掉一张死图，连同紧跟其后的那一行说明。
 *
 * 说明行的判据是「图片下面、空行之前、不长的一行」—— 旧站的图注就是这么
 * 排的。判错了也只是多留一句话，比把正文截掉安全。
 */
function dropDeadImages(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*!\[[^\]]*\]\([^)]*\)\s*$/.test(line) && line.includes(DEAD)) {
      /* 图注：紧接着的一行，不空、不是另一张图、不长。 */
      const next = lines[i + 1] ?? "";
      if (next.trim() && !/^\s*!\[/.test(next) && next.trim().length <= 160) i += 1;
      continue;
    }
    /* 同一行里混着文字和死图的，只把图去掉。 */
    out.push(line.includes(DEAD) ? line.replace(/!\[[^\]]*\]\([^)\s]*www\.tuidang\.org\/wp-content[^)\s]*\)/g, "") : line);
  }
  return out.join("\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function main() {
  loadEnv(resolve(process.cwd(), ".env.local"));
  loadEnv(resolve(process.cwd(), ".env"));
  const apply = process.argv.includes("--apply");

  const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log(`\n===== 英文站清理${apply ? "" : "（预演）"} =====\n`);

  const { rows: cdata } = await c.query(
    `select id, slug, title, summary from cms_articles where locale='en' and summary like '%]]>%'`);
  console.log(`  ── 摘要里的 ]]> ${cdata.length} 条 ──`);
  for (const r of cdata) {
    const fixed = String(r.summary).replace(/\s*\]\]>\s*$/g, "").trim();
    console.log(`     /news/${String(r.slug).slice(0, 40)}`);
    console.log(`        前：…${String(r.summary).slice(-56).replace(/\n/g, " ")}`);
    console.log(`        后：…${(fixed.slice(-56) || "（空）").replace(/\n/g, " ")}`);
  }

  const { rows: dead } = await c.query(
    `select id, slug, title, hero_image, body_markdown from cms_articles
     where locale='en' and (hero_image like '%'||$1||'%' or body_markdown like '%'||$1||'%')`, [DEAD]);
  console.log(`\n  ── 指向已 404 的 ${DEAD} 的图，${dead.length} 篇文章 ──`);
  for (const r of dead) {
    const before = (String(r.body_markdown).match(/!\[/g) ?? []).length;
    const body = dropDeadImages(String(r.body_markdown));
    const after = (body.match(/!\[/g) ?? []).length;
    console.log(`     ${String(r.title).slice(0, 52)}`);
    console.log(`        图 ${before} → ${after} 张，正文 ${String(r.body_markdown).length} → ${body.length} 字${String(r.hero_image ?? "").includes(DEAD) ? "，头图也是死链，清空" : ""}`);
  }

  const { rows: untitled } = await c.query(
    `select id, slug, status, length(body_markdown) len from cms_articles
     where locale='en' and coalesce(trim(title),'')='' and status='published'`);
  console.log(`\n  ── 没有标题、改成草稿 ${untitled.length} 篇 ──`);
  for (const r of untitled) console.log(`     /news/${String(r.slug).padEnd(8)} 正文 ${r.len} 字`);

  if (!apply) {
    console.log("\n（预演，一个字都没写。加 --apply 才真跑。）\n");
    await c.end();
    return;
  }

  const dump = resolve(process.cwd(), "backups", `en-clean-${new Date().toISOString().slice(0, 10)}.json`);
  writeFileSync(dump, JSON.stringify({ cdata, dead, untitled }, null, 1), "utf8");
  console.log(`\n  ✓ 改动前的原样已备份到 ${dump}`);

  await c.query("begin");
  try {
    for (const r of cdata) {
      await c.query(`update cms_articles set summary=$1, updated_at=now() where id=$2`,
        [String(r.summary).replace(/\s*\]\]>\s*$/g, "").trim(), r.id]);
    }
    console.log(`  ✓ 摘要 ${cdata.length} 条`);

    for (const r of dead) {
      await c.query(
        `update cms_articles set body_markdown=$1, hero_image=$2, updated_at=now() where id=$3`,
        [dropDeadImages(String(r.body_markdown)),
         String(r.hero_image ?? "").includes(DEAD) ? "" : String(r.hero_image ?? ""), r.id]);
    }
    console.log(`  ✓ 死图 ${dead.length} 篇`);

    if (untitled.length > 0) {
      await c.query(`update cms_articles set status='draft', updated_at=now() where id=any($1::uuid[])`,
        [untitled.map((r: any) => r.id)]);
      console.log(`  ✓ 无标题 ${untitled.length} 篇改成草稿`);
    }

    const { rows: left } = await c.query(
      `select count(*)::int n from cms_articles where locale='en'
       and (summary like '%]]>%' or body_markdown like '%'||$1||'%'
            or (coalesce(trim(title),'')='' and status='published'))`, [DEAD]);
    if (left[0].n !== 0) throw new Error(`还剩 ${left[0].n} 条没清干净`);
    await c.query("commit");
  } catch (error) {
    await c.query("rollback");
    throw error;
  }

  console.log("\n✓ 清完了。\n");
  await c.end();
}

main().catch((error) => {
  console.error(`\n✗ ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
