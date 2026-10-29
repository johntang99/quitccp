/**
 * 把「目标写着旧中文地址」的重定向改到内容现在的地址。
 *
 * 拼音迁移只修了目标形如 /news/<某篇的旧 slug> 的重定向。它漏掉了跨栏目的那
 * 一批：旧站「中华传统文化」「资料下载」两个栏目的 379 篇，在新站是**文章**，
 * 而重定向的目标写的是 /resources/<中文 slug>。段前缀对不上，迁移脚本就没认出
 * 它们，于是这 379 条从 10-19 起 308 跳到 404。
 *
 * 配 slug_legacy，不配标题：slug_legacy 就是这一行迁移前的地址，等值即同一行，
 * 没有模糊匹配的余地。
 *
 * 同一个旧地址有时既是文章又是视频（当年一个页面带正文也带片子）。默认取文章；
 * 只有正文短到不成文（< 300 字）而视频在，才取视频 —— 否则读者会落到一篇只有
 * 标题的空页上。
 *
 *     npx tsx scripts/repoint-stale-destinations.ts            # 预演
 *     npx tsx scripts/repoint-stale-destinations.ts --apply
 */

import pg from "pg";

const APPLY = process.argv.includes("--apply");
/* 正文短于这个长度就不算「有内容」，改投视频。 */
const STUB_BODY = 300;

interface Row {
  id: string;
  legacy_url: string;
  destination_url: string;
  stale_slug: string;
  article_slug: string | null;
  article_status: string | null;
  article_len: number | null;
  video_slug: string | null;
  video_status: string | null;
}

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  /*
   * 目标的最后一段拿来配 slug_legacy。只看最后一段，因为出问题的正是段前缀：
   * 目标写 /resources/…，内容其实在 /news/…。
   *
   * 带子目录的目标（/resources/downloads/<类>/<slug>）排除在外 —— 那是资料详情
   * 页的正常地址，本来就通。
   */
  const { rows } = await client.query<Row>(`
    with stale as (
      select r.id, r.legacy_url, r.destination_url,
             substring(r.destination_url from '^/[a-z]+/([^/]+)$') as stale_slug
      from cms_redirects r
      where r.destination_url ~ '^/[a-z]+/[^/]+$'
        and not exists (select 1 from cms_articles  a where r.destination_url = '/news/'      || a.slug)
        and not exists (select 1 from cms_videos    v where r.destination_url = '/videos/'    || v.slug)
        and not exists (select 1 from cms_materials m where r.destination_url = '/resources/' || m.slug)
    )
    select s.*,
           a.slug as article_slug, a.status as article_status,
           length(coalesce(a.body_markdown, '')) as article_len,
           v.slug as video_slug, v.status as video_status
    from stale s
    /*
     * 也配文章现在的 slug：视频转成文章时 slug 原样带过去，旧链接还写着
     * /videos/<slug>。10-29 自检报出的 26 条就是这一类 —— slug_legacy 是
     * 中文旧地址，配不上，但同名文章就在 /news/<slug>。两种都配上时取 slug 等值的。
     */
    left join lateral (
      select * from cms_articles a
      where a.slug = s.stale_slug or a.slug_legacy = s.stale_slug
      order by (a.slug = s.stale_slug) desc
      limit 1
    ) a on true
    left join cms_videos   v on v.slug_legacy = s.stale_slug
    where a.id is not null or v.id is not null
  `);

  const plan: { id: string; from: string; to: string; why: string }[] = [];
  for (const row of rows) {
    const articleOk = row.article_slug && row.article_status === "published";
    const videoOk = row.video_slug && row.video_status === "published";
    const articleIsStub = (row.article_len ?? 0) < STUB_BODY;

    let to: string | null = null;
    let why = "";
    if (articleOk && !(articleIsStub && videoOk)) {
      to = `/news/${row.article_slug}`;
      why = "文章";
    } else if (videoOk) {
      to = `/videos/${row.video_slug}`;
      why = articleOk ? `视频（文章只有 ${row.article_len} 字）` : "视频";
    }
    if (to && to !== row.destination_url) plan.push({ id: row.id, from: row.destination_url, to, why });
  }

  console.log(`\n${APPLY ? "改" : "预演"}：扫出 ${rows.length} 条目标过期，可改 ${plan.length} 条\n`);
  const byWhy = plan.reduce<Record<string, number>>((acc, p) => {
    acc[p.why.split("（")[0]] = (acc[p.why.split("（")[0]] ?? 0) + 1;
    return acc;
  }, {});
  for (const [k, n] of Object.entries(byWhy)) console.log(`  改投${k}  ${n} 条`);
  console.log("");
  for (const p of plan.slice(0, 8)) console.log(`  ${p.from}\n      → ${p.to}  [${p.why}]`);
  if (plan.length > 8) console.log(`  …另外 ${plan.length - 8} 条`);
  for (const p of plan.filter((x) => x.why.startsWith("视频（"))) {
    console.log(`\n  取视频而非文章：${p.from}\n      → ${p.to}  [${p.why}]`);
  }

  const skipped = rows.length - plan.length;
  if (skipped > 0) console.log(`\n  跳过 ${skipped} 条（文章和视频都不是已发布状态）`);

  if (!APPLY) {
    console.log("\n（预演，没有写库。加 --apply 才真改。）\n");
    await client.end();
    return;
  }

  await client.query("begin");
  try {
    for (const p of plan) {
      await client.query(`update cms_redirects set destination_url = $1 where id = $2`, [p.to, p.id]);
    }
    /* 不能制造跳转链：目标自己不能又是另一条重定向的入口。 */
    const { rows: chain } = await client.query(
      `select count(*)::int as n from cms_redirects a join cms_redirects b on b.legacy_url = a.destination_url`
    );
    if (chain[0].n > 0) throw new Error(`制造了 ${chain[0].n} 条跳转链，已回滚`);
    await client.query("commit");
    console.log(`\n已改 ${plan.length} 条。跳转链 0。\n`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  }

  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
