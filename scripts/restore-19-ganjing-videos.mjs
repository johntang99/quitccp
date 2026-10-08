/**
 * Puts the 19 old-site mp4 films back, now that the team has re-uploaded them
 * to 干净世界.
 *
 * These 19 were deleted earlier in one pass with the other dead films: their
 * mp4s had gone with the old site, and the news section already carried the
 * same piece. What makes them recoverable rather than re-created is that the
 * article and the film were never two things -- same legacy_id, same old-site
 * URL, same slug, and byte-identical bodies in 18 of 19. One WordPress post,
 * imported into both tables.
 *
 * So the film rows come back out of the retire backup exactly as they were --
 * cover, duration, 简介, 讲者, and their 三退前线 placement all intact -- with
 * only `source_url` changed to the new 干净世界 address. Nothing is invented.
 *
 * The articles are not touched beyond gaining a player at the top. They keep
 * their URLs, so the 19 old-site redirects (all 15,134 of them point at /news/)
 * keep working. This is how the site already works: all 737 existing films also
 * exist as a news article, and 536 of those articles embed the player too.
 *
 *   node --env-file=.env.local scripts/restore-19-ganjing-videos.mjs
 *   node --env-file=.env.local scripts/restore-19-ganjing-videos.mjs --apply
 *   node --env-file=.env.local scripts/restore-19-ganjing-videos.mjs --restore backups/gjw19-<stamp>.json
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const APPLY = process.argv.includes("--apply");
const RESTORE = (() => {
  const i = process.argv.indexOf("--restore");
  return i === -1 ? null : process.argv[i + 1];
})();

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const SOURCE_BACKUP = "backups/retire-2026-10-08T03-46-56-620Z.json";

if (RESTORE) {
  const b = JSON.parse(fs.readFileSync(RESTORE, "utf8"));
  for (const a of b.articleEdits ?? []) {
    const { error } = await s.from("cms_articles").update({ body_markdown: a.before }).eq("id", a.id);
    if (error) throw error;
  }
  for (const v of b.insertedVideos ?? []) {
    await s.from("cms_video_category_map").delete().eq("video_id", v.id);
    const { error } = await s.from("cms_videos").delete().eq("id", v.id);
    if (error) throw error;
  }
  console.log(`  已撤销：删掉 ${(b.insertedVideos ?? []).length} 支影片，还原 ${(b.articleEdits ?? []).length} 篇正文`);
  process.exit(0);
}

/** 团队上传后的新地址（docx 给的是 /video/ 与一条 /live/，这里一律转成可嵌入的 /embed/）。 */
const UPLOADED = [
  ["《四亿人的觉醒》近期将在新唐人电视台连续播放", "https://www.ganjingworld.com/video/1it9db0cdl63psaX1qtnBgDsF1ge1c"],
  ["【退党洪流】第十六期 避疫有良方欧美亚抗共", "https://www.ganjingworld.com/video/1it9fmggb8m64KgYbaT17qAgf1hr1c"],
  ["【三退大潮】退党义工：海外华人要清醒 勿做中共帮凶", "https://www.ganjingworld.com/video/1it9bdc6nor1uUDG4tmrHmqkK17m1c"],
  ["纽约纪念4‧25集会 社区领袖：法拉盛不会容忍迫害", "https://www.ganjingworld.com/video/1it9chuihrl2SJh4ZqjsM6AAh1qu1c"],
  ["宋颜杰：自己还有一颗正直的心 今天就三退", "https://www.ganjingworld.com/video/1it9fvn3v5d3OXNwjgHgUyxSx1md1c"],
  ["纽约法轮功反迫害游行 侨民：他们是真爱国者", "https://www.ganjingworld.com/video/1it9gh8bdl9308x8ktlDt7Lri1d21c"],
  ["【三退大潮】纽约逾千退党义工游行 声援大陆民众三退", "https://www.ganjingworld.com/video/1it9apjlhqq1NQM0QD1KWCGHv18g1c"],
  ["赵慧子：君子不立于危墙之下 远离中共", "https://www.ganjingworld.com/video/1it9d6h66tq1EdPgfPxLwWEr213a1c"],
  ["郭雷：正义之士必须退出邪恶的中共组织", "https://www.ganjingworld.com/video/1it9ees1nsq3wW2vtyHLwXuao1k91c"],
  ["李宗民：中共是非法组织 十多年前就已三退", "https://www.ganjingworld.com/video/1it9gu6gc184TfZ2tq5QPdEQr1dk1c"],
  ["宫凯：共产党不铲除 中国没有未来", "https://www.ganjingworld.com/video/1it9cpmrfds3t5f2QdIlfIK7m1qj1c"],
  ["【三退大潮】蔡桂华：让中国人获得自由（四）", "https://www.ganjingworld.com/live/1it9bniaivjykBmztMmef7E0s1eg1c"],
  ["2023年法拉盛华人新年遊行 退党服务中心传递重要信息：三退保平安", "https://www.ganjingworld.com/video/1it9c5m5um461YNkWcRJZ6oIf18k1c"],
  ["李军：中国民众，你三退了吗？", "https://www.ganjingworld.com/video/1it9f982neu2Z8J7SHEtt5wtl1jj1c"],
  ["【退党洪流】美国战略转移剑指中共 三退抹毒誓成当务之急", "https://www.ganjingworld.com/video/1it9hp6l53p18YUlmq65lqQyI1su1c"],
  ["王珊珊：没有共产党 才有更好的新中国", "https://www.ganjingworld.com/video/1it9eodk83pr80ag2nri1SN7h1ip1c"],
  ["周锋锁：加入过中共相关组织的人有义务从中脱离", "https://www.ganjingworld.com/video/1it9ff19n2d6t1aGMeGqwwDn01ti1c"],
  ["纽约民众放鞭炮庆祝恶贯满盈的江泽民死亡", "https://www.ganjingworld.com/video/1it9i1iggk1xsOjWKccNDarh610b1c"],
  ["梁丰收：逃离中共 必须三退", "https://www.ganjingworld.com/video/1it9i5pa5tc4BlqZPgf3Fela91ao1c"]
];

const toEmbed = (url) => {
  const m = String(url).match(
    /ganjingworld\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?(?:video|embed|live)\/([A-Za-z0-9]+)/i
  );
  if (!m) throw new Error(`认不出的干净世界地址: ${url}`);
  return `https://www.ganjingworld.com/embed/${m[1]}`;
};

/* Titles differ between the docx, the film row and the article only in
   punctuation and full/half-width spacing, so they are compared flattened. */
const norm = (t) =>
  String(t ?? "")
    .replace(/[\s　‧·•・：:，,。.、！!？?（）()《》〈〉「」『』“”"‘’\-—–_]/g, "")
    .toLowerCase();

const backupFile = JSON.parse(fs.readFileSync(SOURCE_BACKUP, "utf8"));
const deleted = new Map(backupFile.deletedVideos.map((d) => [norm(d.row.title), d]));

async function all(table, columns) {
  let rows = [];
  for (let page = 0; ; page += 1) {
    const { data, error } = await s.from(table).select(columns).range(page * 1000, page * 1000 + 999);
    if (error) throw error;
    rows = rows.concat(data ?? []);
    if (!data || data.length < 1000) break;
  }
  return rows;
}

const articles = await all("cms_articles", "id,slug,title,body_markdown,published_at");
const articleByTitle = new Map(articles.map((a) => [norm(a.title), a]));

const existingVideos = await all("cms_videos", "id,slug");
const takenSlug = new Set(existingVideos.map((v) => v.slug));
const takenId = new Set(existingVideos.map((v) => String(v.id)));

const plan = [];
const problems = [];
for (const [title, rawUrl] of UPLOADED) {
  const key = norm(title);
  const entry = deleted.get(key);
  const article = articleByTitle.get(key);
  if (!entry) {
    problems.push(`备份里找不到影片：${title}`);
    continue;
  }
  if (!article) {
    problems.push(`文章库里找不到：${title}`);
    continue;
  }
  const row = { ...entry.row };
  /*
   * A film already in the table means an earlier run got this far. That is not
   * a reason to skip the whole entry: the first attempt timed out between
   * inserting a film and editing its article, and skipping on the film alone
   * would leave that article silently without a player. Each piece is checked
   * on its own below instead.
   */
  const videoExists = takenId.has(String(row.id)) || takenSlug.has(row.slug);

  const embed = toEmbed(rawUrl);
  row.source_url = embed;
  row.updated_at = new Date().toISOString();

  /* House style for a player in an article body: a bare block, no caption --
     that is what all 536 of the existing twin articles use. Top of the body,
     as 280 of them do; for these the film is the piece, not an illustration. */
  const body = String(article.body_markdown ?? "");
  const block = `::: video ${embed}\n:::`;
  const alreadyThere = /:::\s*video/i.test(body);
  const newBody = alreadyThere ? body : body.trim() ? `${block}\n\n${body}` : block;

  plan.push({
    video: row,
    videoExists,
    categoryIds: entry.categoryIds,
    article: { id: article.id, slug: article.slug, title: article.title, before: body, after: newBody, skipped: alreadyThere }
  });
}

console.log(`\n=== 准备恢复 ${plan.length} 支影片 ===\n`);
for (const p of plan) {
  const mins = Math.floor((p.video.duration_seconds ?? 0) / 60);
  const secs = String((p.video.duration_seconds ?? 0) % 60).padStart(2, "0");
  console.log(`  ${p.video.title.slice(0, 40)}`);
  console.log(`     ${p.video.source_url}`);
  console.log(`     时长 ${mins}:${secs}   封面 ${p.video.cover_image ? "有" : "无"}   分类 ${p.categoryIds.length} 个   正文 ${String(p.video.body_markdown ?? "").length} 字${p.videoExists ? "   （影片已在库中）" : ""}`);
  console.log(`     文章 /news/${p.article.slug.slice(0, 40)}  正文 ${p.article.before.length} → ${p.article.after.length} 字${p.article.skipped ? "（已有播放块，不动）" : ""}`);
  console.log("");
}
if (problems.length) {
  console.log(`  ⚠ ${problems.length} 条有问题：`);
  for (const p of problems) console.log(`     ${p}`);
  console.log("");
}

if (!APPLY) {
  console.log("  空跑 —— 没有写入。确认后加 --apply。");
  process.exit(0);
}
if (plan.length !== UPLOADED.length) {
  throw new Error(`只排到 ${plan.length}/${UPLOADED.length} 支，先把上面的问题解决再跑`);
}

const backup = { at: new Date().toISOString(), insertedVideos: [], articleEdits: [] };
fs.mkdirSync("backups", { recursive: true });
const file = path.join("backups", `gjw19-${backup.at.replace(/[:.]/g, "-")}.json`);
const save = () => fs.writeFileSync(file, JSON.stringify(backup, null, 2));
save();

/*
 * Saving an article fires the search reindex, and a first attempt died on
 * Postgres's statement timeout (57014) partway through -- four films in, three
 * articles edited. So each write retries, and the loop pauses between rows
 * rather than hammering the database.
 */
async function withRetry(label, run) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const { error } = await run();
    if (!error) return;
    if (error.code !== "57014" || attempt === 4) throw error;
    const wait = attempt * 2500;
    console.log(`     ⟳ ${label} 超时，${wait / 1000}s 后第 ${attempt + 1} 次`);
    await new Promise((r) => setTimeout(r, wait));
  }
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

let films = 0;
let bodies = 0;
let maps = 0;
for (const p of plan) {
  /* Re-read rather than trust the plan: an interrupted run leaves the table
     ahead of what was scanned at start. */
  const { data: already } = await s.from("cms_videos").select("id").eq("id", p.video.id).maybeSingle();
  if (!already) {
    await withRetry(`插入 ${p.video.title.slice(0, 16)}`, () => s.from("cms_videos").insert(p.video));
    backup.insertedVideos.push({ id: p.video.id, slug: p.video.slug, title: p.video.title });
    save();
    films += 1;
  }

  for (const categoryId of p.categoryIds) {
    const { count } = await s
      .from("cms_video_category_map")
      .select("video_id", { count: "exact", head: true })
      .eq("video_id", p.video.id)
      .eq("category_id", categoryId);
    if (count) continue;
    await withRetry("归类", () =>
      s.from("cms_video_category_map").insert({ video_id: p.video.id, category_id: categoryId, position: 0 })
    );
    maps += 1;
  }

  /* The article is checked against the database, not the plan, so a row the
     earlier run already edited is left alone and one it missed is picked up. */
  const { data: liveArticle } = await s
    .from("cms_articles")
    .select("body_markdown")
    .eq("id", p.article.id)
    .maybeSingle();
  const liveBody = String(liveArticle?.body_markdown ?? "");
  if (!/:::\s*video/i.test(liveBody)) {
    const block = `::: video ${p.video.source_url}\n:::`;
    const next = liveBody.trim() ? `${block}\n\n${liveBody}` : block;
    await withRetry(`正文 ${p.article.title.slice(0, 16)}`, () =>
      s.from("cms_articles").update({ body_markdown: next }).eq("id", p.article.id)
    );
    backup.articleEdits.push({ id: p.article.id, slug: p.article.slug, title: p.article.title, before: liveBody });
    save();
    bodies += 1;
  }

  process.stdout.write(`\r  影片 ${films}  正文 ${bodies}  归类 ${maps}   `);
  await pause(600);
}
console.log("");

console.log(`  本次：新增影片 ${films} 支，补归类 ${maps} 条，加播放块 ${bodies} 篇`);
console.log(`\n  备份：${file}`);
console.log(`  撤销：node --env-file=.env.local scripts/restore-19-ganjing-videos.mjs --restore ${file}`);
