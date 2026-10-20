/**
 * 把「文章改视频」留下的断链重指到视频。
 *
 * 背景：「铁证如山」活摘系列 2026-10-12/13 作为视频重新发布，10-16 编辑删掉了
 * 重复的文章版。旧地址的重定向还指着那些已删文章，于是 308 跳到 404 ——
 * 内容明明还在站上，只是换了形态。
 *
 * 配对靠集数，不靠标题相似度：文章写「第二十六集」，视频写「第26集」或只写
 * 「Episode 26」，集数还可能存在 episode 栏而不在标题里 —— 三处都解析，取并集。
 * 只有「集数解析成功 且 该集在目标分类下唯一」才改，其余留给人工。
 *
 * 不改 legacy_url，只改 destination_url，所以不会碰 legacy_url 的唯一索引。
 *
 *     npx tsx scripts/repoint-series-redirects.ts            # 预演
 *     npx tsx scripts/repoint-series-redirects.ts --apply
 */

import pg from "pg";

const CATEGORY = "铁证如山";
const APPLY = process.argv.includes("--apply");

/* 目标不存在的重定向。三张内容表都要查 —— 少查一张，就会把活着的地址当成断链。 */
const DANGLING = `
  select r.id, r.legacy_url, r.destination_url,
         substring(r.destination_url from '^/[a-z]+/(.*)$') as target_slug
  from cms_redirects r
  where not exists (select 1 from cms_articles  a where r.destination_url = '/news/'      || a.slug)
    and not exists (select 1 from cms_videos    v where r.destination_url = '/videos/'    || v.slug)
    and not exists (select 1 from cms_materials m where r.destination_url = '/resources/' || m.slug)
`;

const CN = "零一二三四五六七八九";

/* 中文数字转阿拉伯。系列最长四十集上下，不需要「百」「千」那一套。 */
function cnNum(text: string): number | null {
  if (/^\d+$/.test(text)) return Number(text);
  const split = text.match(/^(.*?)十(.*)$/);
  if (split) {
    const tens = split[1] === "" ? 1 : CN.indexOf(split[1]);
    const ones = split[2] === "" ? 0 : CN.indexOf(split[2]);
    return tens < 0 || ones < 0 ? null : tens * 10 + ones;
  }
  const one = CN.indexOf(text);
  return one <= 0 ? null : one;
}

function episodeOf(...fields: (string | null | undefined)[]): number | null {
  for (const field of fields) {
    if (!field) continue;
    const zh = field.match(/第\s*([0-9〇零一二三四五六七八九十]+)\s*集/);
    if (zh) {
      const n = cnNum(zh[1].replace(/〇/g, "零"));
      if (n) return n;
    }
    const en = field.match(/Episode\s*(\d+)/i);
    if (en) return Number(en[1]);
    if (/^\d+$/.test(field.trim())) return Number(field.trim());
  }
  return null;
}

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  /* 被删文章的标题只剩审计日志里有 —— 行本身已经没了，集数只能从那里取。 */
  const { rows: dangling } = await client.query(`
    with d as (${DANGLING})
    select distinct d.id, d.legacy_url, d.destination_url, al.detail->>'title' as old_title
    from d join cms_audit_logs al
      on al.action in ('article.delete', 'video.delete', 'material.delete')
     and al.detail::text like '%' || d.target_slug || '%'
  `);

  const { rows: videos } = await client.query(
    `select v.slug, v.title, v.episode
       from cms_videos v
       join cms_video_category_map m on m.video_id = v.id
       join cms_video_categories c on c.id = m.category_id
      where c.name = $1 and v.status = 'published'`,
    [CATEGORY]
  );

  const byEpisode = new Map<number, { slug: string; title: string }[]>();
  for (const video of videos) {
    const ep = episodeOf(video.title, video.episode);
    if (ep == null) continue;
    if (!byEpisode.has(ep)) byEpisode.set(ep, []);
    byEpisode.get(ep)!.push({ slug: video.slug, title: video.title });
  }

  const plan: { id: string; from: string; to: string; ep: number; title: string }[] = [];
  const leave: { title: string; ep: number | null; candidates: number }[] = [];
  for (const row of dangling) {
    const ep = episodeOf(row.old_title);
    const candidates = ep == null ? [] : byEpisode.get(ep) ?? [];
    if (ep != null && candidates.length === 1) {
      plan.push({
        id: row.id,
        from: row.destination_url,
        to: `/videos/${candidates[0].slug}`,
        ep,
        title: row.old_title ?? ""
      });
    } else {
      leave.push({ title: row.old_title ?? "", ep, candidates: candidates.length });
    }
  }

  plan.sort((a, b) => a.ep - b.ep);
  console.log(`\n${APPLY ? "改" : "预演"}：${plan.length} 条重指，${leave.length} 条保持不动\n`);
  for (const p of plan) {
    console.log(`  第${String(p.ep).padStart(2)}集  ${p.from}`);
    console.log(`          → ${p.to}`);
  }
  for (const l of leave) {
    console.log(`  不动（集数=${l.ep ?? "无"}，候选 ${l.candidates}）《${l.title}》`);
  }

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
    /* 重指之后不能制造新的跳转链：目标本身不能又是另一条重定向的入口。 */
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
