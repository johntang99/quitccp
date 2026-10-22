/**
 * 英文站：把和影片库重复的那一批文章去掉。
 *
 *     npm run dedupe:en:videos                 # 预演
 *     npm run dedupe:en:videos -- --apply
 *
 * ## 为什么会重复
 *
 * 搬英文站内容时分了两次：import:en 按文章分类把 183 篇文章搬进来，
 * import:en:videos 再按 Video Post 分类把 36 支影片搬进影片库。可是旧站的
 * Video Post 本来就是一个「文章分类」—— 它底下那些帖子既被当成文章搬了一遍，
 * 又被当成影片搬了一遍。
 *
 * 结果是《铁证如山》第 21 到 32 集在英文站上各有两份：一份 /news/<slug>，
 * 一份 /videos/<slug>，标题一字不差。栏目栏里还因此多出一个叫「Video Post」
 * 的新闻栏目 —— 读者点进「新闻」，看到的是一排影片。
 *
 * 12 篇逐一核对过：slug、旧地址、标题三样里至少两样和影片库里的某一支对上，
 * 12 篇全部对上，没有一篇是影片库里没有的。所以删文章、留影片。
 *
 * ## 为什么还是加重定向
 *
 * 英文站还没有域名，这 12 个地址眼下没有人在用，加不加都一样。加了是因为
 * 它们迟早会上线，而到那天没人会记得这里删过东西 —— 顺手留下的跳转不花钱，
 * 事后补一条断掉的旧地址要花很多。
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

const norm = (s: string) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

async function main() {
  loadEnv(resolve(process.cwd(), ".env.local"));
  loadEnv(resolve(process.cwd(), ".env"));
  const apply = process.argv.includes("--apply");

  const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log(`\n===== 英文站：去掉和影片重复的文章${apply ? "" : "（预演）"} =====\n`);

  const { rows: cat } = await c.query(
    `select id from cms_article_categories where locale='en' and slug='vpost'`);
  if (cat.length === 0) throw new Error("找不到 vpost 分类 —— 可能已经跑过了");
  const catId = String(cat[0].id);

  const { rows: arts } = await c.query(
    `select a.* from cms_articles a join cms_article_category_map m on m.article_id=a.id
     where m.category_id=$1 and a.locale='en' order by a.published_at desc`, [catId]);
  const { rows: vids } = await c.query(
    `select slug, title, legacy_url from cms_videos where locale='en'`);

  const bySlug = new Map(vids.map((v: any) => [String(v.slug), v]));
  const byLegacy = new Map(vids.map((v: any) => [String(v.legacy_url), v]));
  const byTitle = new Map(vids.map((v: any) => [norm(v.title), v]));

  const pairs = arts.map((a: any) => {
    const hits = [
      bySlug.get(String(a.slug)) && "slug",
      byLegacy.get(String(a.legacy_url)) && "旧地址",
      byTitle.get(norm(a.title)) && "标题"
    ].filter(Boolean) as string[];
    const v = bySlug.get(String(a.slug)) ?? byLegacy.get(String(a.legacy_url)) ?? byTitle.get(norm(a.title));
    return { a, v, hits };
  });

  /*
   * 三样里至少对上两样才算同一个东西。
   *
   * 只靠标题会错：影片库里另一套片子里有同名的一集。只靠 slug 也会错：
   * 两边都是从同一个 WordPress 搬的，slug 一样很正常，但那恰恰也可能是
   * 两条不同的记录。要两样同时对上，才说得上是「同一个帖子被搬了两次」。
   */
  const sure = pairs.filter((p) => p.v && p.hits.length >= 2);
  const unsure = pairs.filter((p) => !p.v || p.hits.length < 2);

  console.log(`  Video Post 分类下 ${arts.length} 篇，英文影片 ${vids.length} 支\n`);
  console.log(`  ── 确认重复、文章可删 ${sure.length} 篇 ──`);
  for (const p of sure) {
    console.log(`     ${String(p.a.title).slice(0, 56)}`);
    console.log(`        /news/${String(p.a.slug).slice(0, 48)}  →  /videos/${String(p.v.slug).slice(0, 48)}   （对上：${p.hits.join("、")}）`);
  }
  if (unsure.length > 0) {
    console.log(`\n  ── 对不上、不动 ${unsure.length} 篇 ──`);
    for (const p of unsure) console.log(`     ${String(p.a.title).slice(0, 56)}  （只对上：${p.hits.join("、") || "无"}）`);
  }

  console.log(`\n  ── 之后 ──`);
  console.log(`     新加 ${sure.length} 条重定向 /news/<slug> → /videos/<slug>`);
  console.log(unsure.length === 0
    ? `     Video Post 分类下会空掉，删掉这个分类（栏目栏少一个标签）`
    : `     还剩 ${unsure.length} 篇，不删分类`);

  if (!apply) {
    console.log("\n（预演，一个字都没写。加 --apply 才真跑。）\n");
    await c.end();
    return;
  }

  const dump = resolve(process.cwd(), "backups", `en-video-posts-${new Date().toISOString().slice(0, 10)}.json`);
  writeFileSync(dump, JSON.stringify(sure.map((p) => p.a), null, 1), "utf8");
  console.log(`\n  ✓ 要删的 ${sure.length} 篇已整行备份到 ${dump}`);

  await c.query("begin");
  try {
    for (const p of sure) {
      await c.query(
        `insert into cms_redirects (legacy_url, destination_url, status_code, locale)
         values ($1,$2,301,'en')
         on conflict (legacy_url, locale) do update set destination_url=excluded.destination_url`,
        [`/news/${p.a.slug}`, `/videos/${p.v.slug}`]);
    }
    console.log(`  ✓ 重定向 ${sure.length} 条`);

    const ids = sure.map((p) => p.a.id);
    await c.query(`delete from cms_article_category_map where article_id=any($1::uuid[])`, [ids]);
    const del = await c.query(`delete from cms_articles where id=any($1::uuid[])`, [ids]);
    console.log(`  ✓ 删掉 ${del.rowCount} 篇文章`);

    const { rows: left } = await c.query(
      `select count(*)::int n from cms_article_category_map where category_id=$1`, [catId]);
    if (left[0].n === 0) {
      await c.query(`delete from cms_article_categories where id=$1`, [catId]);
      console.log(`  ✓ 删掉空的「Video Post」分类`);
    } else {
      console.log(`  － 「Video Post」下还有 ${left[0].n} 篇，分类留着`);
    }
    await c.query("commit");
  } catch (error) {
    await c.query("rollback");
    throw error;
  }

  console.log("\n✓ 跑完了。\n");
  await c.end();
}

main().catch((error) => {
  console.error(`\n✗ ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
