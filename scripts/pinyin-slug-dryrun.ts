/**
 * 全站地址改拼音 —— 只读的体检报告。
 *
 * 不写库、不改任何东西。它把计划算出来，报告这次改名会发生什么：多少条会变、
 * 多少条被截断、集数有没有保住、哪些会撞名、哪些根本拼不出地址。再加一份
 * 完整的 CSV 对照表供逐条核对。
 *
 * 计划本身来自 `lib/pinyin-slug-plan.ts` —— 和真正动手的 `pinyin-slug-migrate`
 * 是同一份代码。验过的是 A、跑的是 B，是这类迁移最容易犯也最致命的错。
 *
 *     npx tsx scripts/pinyin-slug-dryrun.ts
 *     npx tsx scripts/pinyin-slug-dryrun.ts --csv /tmp/mapping.csv
 */

import pg from "pg";
import { writeFileSync } from "node:fs";
import { slugifyTitle, episodeMatch } from "../apps/web/src/lib/admin/slugify";
import { buildPlan, fetchRows, PATH_PREFIX } from "./lib/pinyin-slug-plan";

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
  const rows = await fetchRows(client);
  await client.end();

  const { changes, skipped } = buildPlan(rows);

  const changed = changes.filter((c) => c.slug !== c.next);
  const bumped = changes.filter((c) => c.bump > 0);
  const tailed = changes.filter((c) => c.tailed);

  const truncated = changes.filter((c) => {
    /* 截断判断：不设上限重算一遍才比得出来。拿默认上限的结果去比默认上限的
       结果，两边都截过，于是永远「没有截断」—— 一个只会报喜的指标。 */
    const full = slugifyTitle(c.title, { withDate: false, limit: Infinity });
    return c.next.slice(11).replace(/-\d+$/, "") !== full;
  });

  const withEpisode = changes.filter((c) => episodeMatch(c.title));
  /*
   * 集数到底保住没有，不能看「短记号在不在地址里」—— （三）没被截断时 romanise
   * 成 san 留在原位，记号 `3` 根本不会追加，那种写法会把保住的也判成丢了。
   *
   * 真正的判据：把集数从标题里拿掉再算一次地址，结果不一样说明集数对这个地址
   * 有贡献；一样，就是真丢了。
   */
  const episodeLost = withEpisode.filter((c) => {
    const m = episodeMatch(c.title)!;
    const without = c.title.replace(m.text, "");
    return (
      slugifyTitle(without, { withDate: true, date: c.published_at }) ===
      slugifyTitle(c.title, { withDate: true, date: c.published_at })
    );
  });

  const lens = changes.map((c) => c.next.length).sort((a, b) => a - b);
  const oldLens = changes.map((c) => encodeURIComponent(c.slug).length).sort((a, b) => a - b);
  const mid = (a: number[]) => a[Math.floor(a.length / 2)];

  const say = (label: string, value: string | number) => console.log(`${label.padEnd(26, "　")} ${value}`);

  console.log("\n========== 拼音地址试跑（只读，什么都没改） ==========\n");
  say("总条数", `${rows.length}（文章 ${rows.filter((r) => r.kind === "article").length} ／ 视频 ${rows.filter((r) => r.kind === "video").length}）`);
  say("地址会改变", changed.length);
  say("保持原样（拼不出）", skipped.length);
  console.log("");
  say("超长被截断", truncated.length);
  say("标题里有集数", withEpisode.length);
  say("集数保住了", `${withEpisode.length - episodeLost.length} ／ ${withEpisode.length}${episodeLost.length === 0 ? "  ✓ 全部" : "  ✗ 丢了 " + episodeLost.length}`);
  say("动用「保住末尾」", tailed.length);
  say("最后仍需加 -2 -3", bumped.length);
  console.log("");
  say("新地址长度", `中位 ${mid(lens)}，最长 ${lens[lens.length - 1]}`);
  say("旧地址编码后长度", `中位 ${mid(oldLens)}，最长 ${oldLens[oldLens.length - 1]}`);
  say("新地址全是 ASCII", changes.every((c) => /^[a-z0-9-]+$/.test(c.next)) ? "是 ✓" : "否 ✗");
  say("新地址有无重复", (() => {
    const seen = new Set<string>();
    for (const c of changes) {
      const k = `${c.kind}:${c.next}`;
      if (seen.has(k)) return "有重复 ✗";
      seen.add(k);
    }
    return "无 ✓";
  })());

  for (const s of skipped) {
    console.log(`\n保持原样：[${s.kind}] 《${s.title}》`);
  }

  if (episodeLost.length) {
    console.log("\n---------- 集数没进地址的（必须看） ----------");
    for (const c of episodeLost.slice(0, 20)) {
      console.log(`  《${c.title}》`);
      console.log(`      ${PATH_PREFIX[c.kind]}${c.next}`);
    }
  }

  if (bumped.length) {
    /* 把抢到原地址的那一条一起印出来。两个标题摆在一起才看得出是「同一篇
       重复发了两次」还是「同一系列两集被压成了一个地址」—— 后者必须修，
       前者是站上本来就有的重复内容。 */
    console.log("\n---------- 加了 -2 -3 的，和占着原地址的那一条 ----------");
    const byNext = new Map(changes.map((c) => [`${c.kind}:${c.next}`, c]));
    let differing = 0;
    for (const c of bumped) {
      const holder = byNext.get(`${c.kind}:${c.next.replace(/-\d+$/, "")}`);
      const identical = holder && holder.title.replace(/\s+/g, "") === c.title.replace(/\s+/g, "");
      if (!identical) differing += 1;
      console.log(`  ${PATH_PREFIX[c.kind]}${c.next}`);
      console.log(`      ${identical ? "标题一模一样（站上本来就是重复内容）" : "标题不同 ← 要看"}：《${c.title}》`);
    }
    console.log(`\n  其中标题本来就一模一样的 ${bumped.length - differing} 条，标题不同的 ${differing} 条`);
  }

  console.log("\n---------- 随便看几条 ----------");
  for (const c of changed.slice(0, 6)) {
    console.log(`  旧  ${PATH_PREFIX[c.kind]}${c.slug}`);
    console.log(`  新  ${PATH_PREFIX[c.kind]}${c.next}\n`);
  }

  const csv = arg("--csv");
  if (csv) {
    const q = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    writeFileSync(
      csv,
      ["kind,id,title,old_slug,new_slug,bump,tailed"]
        .concat(changes.map((c) => [c.kind, c.id, q(c.title), q(c.slug), q(c.next), c.bump, c.tailed ? 1 : 0].join(",")))
        .join("\n"),
      "utf8"
    );
    console.log(`完整对照表已写入 ${csv}（${changes.length} 行）`);
  }

  console.log("\n（这一遍没有写任何数据。）\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
