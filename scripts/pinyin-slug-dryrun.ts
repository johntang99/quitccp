/**
 * 全站地址改拼音 —— 只读试跑。
 *
 * 不写库、不改任何东西。它把 16,218 条内容的新地址全部算出来，报告这次改名
 * 会发生什么：多少条会变、多少条被截断、集数有没有保住、哪些会撞名、哪些
 * 根本拼不出地址。再加一份完整的 CSV 对照表供逐条核对。
 *
 * ## 为什么先跑这一遍
 *
 * 改名是一次性的、面向全站的、而且会牵动 15,573 条跳转记录。出错的代价不是
 * 「改回来」那么简单 —— 中途断掉的链接是别人手里的链接。所以先把结果摆出来
 * 看，而不是跑一半才发现 300 条文章挤进了同一个地址。
 *
 *     npx tsx scripts/pinyin-slug-dryrun.ts
 *     npx tsx scripts/pinyin-slug-dryrun.ts --csv /tmp/mapping.csv
 */

import pg from "pg";
import { writeFileSync } from "node:fs";
import { slugifyTitle, episodeMatch } from "../apps/web/src/lib/admin/slugify";

type Row = {
  id: string;
  title: string;
  slug: string;
  published_at: string | null;
  kind: "article" | "video";
};

type Mapped = Row & {
  next: string;
  /** 撞名时加的后缀，没撞就是 0 */
  bump: number;
  truncated: boolean;
  episode: string;
  /** 集数在标题里的原文，用来验它到底有没有进地址 */
  episodeText: string;
};

const PREFIX = { article: "/news/", video: "/videos/" } as const;

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const rows: Row[] = [];
  for (const [kind, table] of [
    ["article", "cms_articles"],
    ["video", "cms_videos"]
  ] as const) {
    const r = await client.query(
      `select id::text, title, slug, published_at from ${table} order by published_at nulls last, id`
    );
    for (const row of r.rows) rows.push({ ...row, kind });
  }
  await client.end();

  /*
   * 撞名在「同一个前缀下」才算撞 —— /news/x 和 /videos/x 是两个地址，不冲突。
   * 所以文章和视频各记一张已用表。
   */
  const taken: Record<string, Set<string>> = { article: new Set(), video: new Set() };
  const mapped: Mapped[] = [];
  const empty: Row[] = [];

  /*
   * 两遍扫描，不是一遍。
   *
   * 一遍扫描是「谁先来谁拿干净地址，后来的让位」，结果取决于查询顺序 —— 迁移
   * 脚本中途失败重跑一次，顺序一变，两条内容的地址就可能对调。已经发出去的
   * 地址不能这样随机。
   *
   * 所以先算一遍默认地址，把会挤在一起的找出来；这些组里的每一条都走「保住
   * 标题末尾」，谁也不占那个笼统的地址。剩下真分不开的（标题本来就一模一样）
   * 才按 id 排序依次加 -2、-3，这个顺序是稳定的。
   */
  const firstPass = new Map<string, number>();
  for (const row of rows) {
    const s = slugifyTitle(row.title, { withDate: true, date: row.published_at });
    if (!s) continue;
    const key = `${row.kind}:${s}`;
    firstPass.set(key, (firstPass.get(key) ?? 0) + 1);
  }

  for (const row of rows) {
    const match = episodeMatch(row.title);
    const ep = match?.token ?? "";
    const base = slugifyTitle(row.title, { withDate: true, date: row.published_at });
    if (!base) {
      /* 标题拼不出任何字母数字（纯符号、纯表情）。这种必须人工看，绝不能
         自动给一个随便的地址。 */
      empty.push(row);
      continue;
    }

    /* 截断判断：不设上限重算一遍才比得出来。第一版拿默认上限的结果去比默认
       上限的结果，两边都截过，于是永远「没有截断」—— 一个只会报喜的指标。 */
    const untrimmed = slugifyTitle(row.title, { withDate: false, limit: Infinity });
    const truncated = base.slice(11) !== untrimmed;

    /* 这一条的默认地址被别人也算到了，就整组改用「保住标题末尾」。同一场
       集会的几篇报导，区别只在结尾的发言人名字，把末尾接回来就自己分开了，
       而且地址还看得懂。 */
    let next = base;
    let bump = 0;
    if ((firstPass.get(`${row.kind}:${base}`) ?? 0) > 1) {
      const withTail = slugifyTitle(row.title, {
        withDate: true,
        date: row.published_at,
        keepTail: true
      });
      if (withTail) next = withTail;
    }
    const stem = next;
    while (taken[row.kind].has(next)) {
      bump += 1;
      next = `${stem}-${bump + 1}`; // 第二条是 -2，第三条是 -3
    }
    taken[row.kind].add(next);
    mapped.push({ ...row, next, bump, truncated, episode: ep, episodeText: match?.text ?? "" });
  }

  const changed = mapped.filter((m) => m.slug !== m.next);
  const same = mapped.length - changed.length;
  const bumped = mapped.filter((m) => m.bump > 0);
  const truncated = mapped.filter((m) => m.truncated);
  const withEpisode = mapped.filter((m) => m.episode);
  /*
   * 集数到底保住没有，不能看「短记号在不在地址里」—— （三）没被截断时romanise
   * 成 san 留在原位，记号 `3` 根本不会追加，那种写法会把保住的也判成丢了。
   *
   * 真正的判据是：把集数从标题里拿掉再算一次地址，如果结果不一样，说明集数
   * 对这个地址有贡献；一样，就是真丢了。
   */
  const episodeLost = withEpisode.filter((m) => {
    const without = m.title.replace(m.episodeText, "");
    return (
      slugifyTitle(without, { withDate: true, date: m.published_at }) ===
      slugifyTitle(m.title, { withDate: true, date: m.published_at })
    );
  });
  const episodeKept = withEpisode.filter((m) => !episodeLost.includes(m));
  const longest = [...mapped].sort((a, b) => b.next.length - a.next.length)[0];
  const asciiOnly = mapped.every((m) => /^[a-z0-9-]+$/.test(m.next));

  const say = (label: string, value: string | number) =>
    console.log(`${label.padEnd(28, "　")} ${value}`);

  console.log("\n========== 拼音地址试跑（只读，什么都没改） ==========\n");
  say("总条数", `${rows.length}（文章 ${rows.filter((r) => r.kind === "article").length} ／ 视频 ${rows.filter((r) => r.kind === "video").length}）`);
  say("地址会改变", changed.length);
  say("地址不变", same);
  say("拼不出地址，需人工", empty.length);
  console.log("");
  say("超长被截断", truncated.length);
  say("标题里有集数", withEpisode.length);
  say("集数保住了", `${episodeKept.length} ／ ${withEpisode.length}${episodeKept.length === withEpisode.length ? "  ✓ 全部" : "  ✗ 有丢的"}`);
  say("同日撞名加了后缀", bumped.length);
  console.log("");
  say("最长的新地址", `${longest.next.length} 字符`);
  say("新地址是否全是 ASCII", asciiOnly ? "是 ✓" : "否 ✗");
  say("新地址有无重复", (() => {
    const seen = new Map<string, number>();
    for (const m of mapped) {
      const key = `${m.kind}:${m.next}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    const dup = [...seen.values()].filter((n) => n > 1).length;
    return dup === 0 ? "无 ✓" : `${dup} 组重复 ✗`;
  })());

  if (empty.length) {
    console.log("\n---------- 拼不出地址的（需人工处理） ----------");
    for (const r of empty.slice(0, 20)) console.log(`  [${r.kind}] ${r.slug}  ←  《${r.title}》`);
    if (empty.length > 20) console.log(`  …还有 ${empty.length - 20} 条`);
  }

  if (episodeLost.length) {
    console.log("\n---------- 集数没进地址的（必须看） ----------");
    for (const m of episodeLost.slice(0, 20)) {
      console.log(`  《${m.title}》  集数「${m.episodeText}」`);
      console.log(`      ${PREFIX[m.kind]}${m.next}`);
    }
    if (episodeLost.length > 20) console.log(`  …还有 ${episodeLost.length - 20} 条`);
  }

  if (bumped.length) {
    /*
     * 撞名的那几条，把抢到原地址的那一条一起印出来。两个标题摆在一起才看得出
     * 是「同一篇重复发了两次」还是「同一系列两集被压成了一个地址」—— 后者是
     * 必须修的，前者是站上本来就有的重复内容。
     */
    console.log("\n---------- 同日撞名的全部 ----------");
    const byNext = new Map(mapped.map((m) => [`${m.kind}:${m.next}`, m]));
    for (const m of bumped) {
      const holder = byNext.get(`${m.kind}:${m.next.replace(/-\d+$/, "")}`);
      console.log(`  ${PREFIX[m.kind]}${m.next}`);
      console.log(`      这一条：《${m.title}》`);
      console.log(`      占着原地址的：《${holder ? holder.title : "？"}》`);
      console.log(`      标题一样吗：${holder && holder.title.trim() === m.title.trim() ? "一样（本来就是重复内容）" : "不一样 ← 要看"}`);
    }
  }

  console.log("\n---------- 带集数的，截断之后长这样（前 12 条） ----------");
  for (const m of withEpisode.filter((x) => x.truncated).slice(0, 12)) {
    console.log(`  《${m.title}》`);
    console.log(`      ${PREFIX[m.kind]}${m.next}`);
  }

  console.log("\n---------- 随便看几条 ----------");
  for (const m of changed.slice(0, 8)) {
    console.log(`  旧  ${PREFIX[m.kind]}${m.slug}`);
    console.log(`  新  ${PREFIX[m.kind]}${m.next}`);
    console.log("");
  }

  const csv = arg("--csv");
  if (csv) {
    const q = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    const lines = ["kind,id,title,old_slug,new_slug,truncated,episode,bump"];
    for (const m of mapped) {
      lines.push(
        [m.kind, m.id, q(m.title), q(m.slug), q(m.next), m.truncated ? 1 : 0, m.episode, m.bump].join(",")
      );
    }
    writeFileSync(csv, lines.join("\n"), "utf8");
    console.log(`完整对照表已写入 ${csv}（${mapped.length} 行）`);
  }

  console.log("\n（这一遍没有写任何数据。）\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
