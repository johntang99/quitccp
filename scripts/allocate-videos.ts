/**
 * Works out which new video category each piece of old video content belongs to.
 *
 * The old site has no video content type -- videos are posts, and "which posts
 * are videos" has no single answer. Three groups exist and they need to be kept
 * apart, because sweeping them together buries the series under news reports:
 *
 *   series   the 365 posts filed under the seven 【视频系列】-style categories.
 *            This is the video library proper. 九评共产党 is in here and is
 *            mostly text -- per instruction it still counts as video.
 *   tagged   posts elsewhere whose title carries （视频） *and* whose body still
 *            has a working player. Genuine video items that were filed as news.
 *   orphan   posts titled （视频） whose player is gone, and posts with a player
 *            but no such title (a news report that happens to embed a clip).
 *
 * Reads the normalized full pull and writes artifacts/phase5/video-allocation.json.
 * Read-only -- it touches no database.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

interface Row {
  slug: string;
  title: string;
  bodyMarkdown: string;
  wpCategories: string[];
  publishedAt: string;
  legacyUrl: string;
  legacyId: number;
  heroImage?: string;
}

/** The seven old categories that are explicitly video sections. */
const SERIES_CATEGORIES = ["spjx", "stdc", "xwdl", "tdhl", "9ping", "qtsp", "zxgb"];

const hasPlayer = (row: Row) => /::: video/.test(row.bodyMarkdown || "");
/** A bare platform link counts too -- it is still a video we can embed. */
const hasLink = (row: Row) =>
  /(?:youtube\.com|youtu\.be|ganjing(?:world)?\.com|vimeo\.com)\/\S/i.test(row.bodyMarkdown || "");
const playable = (row: Row) => hasPlayer(row) || hasLink(row);
const titledVideo = (row: Row) => /（视频）|\(视频\)|【视频/.test(row.title || "");
const inSeriesCategory = (row: Row) => row.wpCategories.some((c) => SERIES_CATEGORIES.includes(c));

export type VideoGroup = "series" | "tagged" | "rescue" | "orphan";

/**
 * 破除党文化, 退一步海阔天空 and 觉醒之旅 get nothing from the series or tagged
 * groups -- they are new sections, not renamed old ones. Rather than opening
 * them empty, `rescue` pulls in the posts that do play and do belong to one of
 * those three. It is deliberately narrow: only those three categories, and only
 * with a working player. Widening it to every orphan would drag several hundred
 * news reports into the video library.
 */
const NEEDS_CONTENT = new Set(["破除党文化", "退一步海阔天空", "觉醒之旅"]);

export type VideoGroup2 = VideoGroup;

export function groupOf(row: Row): VideoGroup | null {
  if (inSeriesCategory(row)) return "series";
  if (titledVideo(row) && hasPlayer(row)) return "tagged";
  if (playable(row) && NEEDS_CONTENT.has(allocate(row).category)) return "rescue";
  if (titledVideo(row) || hasPlayer(row)) return "orphan";
  return null;
}

/**
 * Assigns one new category.
 *
 * Order matters: the specific series win over the general ones, because a post
 * can sit in several old categories at once (every one of the 245 视频精选 posts
 * also carries another category -- that is how 视频精选 gets resolved rather
 * than becoming a dumping ground). Anything left over goes to 其它系列, which is
 * the instruction rather than a fallback I invented.
 */
export function allocate(row: Row): { category: string; reason: string } {
  const cats = row.wpCategories;
  const title = row.title || "";

  if (cats.includes("9ping") || /九评|解体党文化|魔鬼在统治|共产主义的终极目的/.test(title))
    return { category: "九评系列", reason: "九评原著及其衍生系列" };

  if (cats.includes("xwdl") || /希望的路/.test(title))
    return { category: "希望的路", reason: "《希望的路》分集" };

  if (cats.includes("tzrs") || /铁证如山|活摘|活体摘取|摘取.*器官/.test(title))
    return { category: "铁证如山", reason: "活摘器官调查" };

  if (cats.includes("jtdwh") || /党文化/.test(title))
    return { category: "破除党文化", reason: "党文化专题" };

  // 三退大潮 and 退党洪流 both fold into 三退前线, as you specified.
  if (cats.includes("stdc") || cats.includes("tdhl") || /三退大潮|退党洪流/.test(title))
    return { category: "三退前线", reason: "三退大潮／退党洪流" };

  if (cats.includes("srjx") || cats.includes("syrjx") || /觉醒/.test(title))
    return { category: "觉醒之旅", reason: "世人觉醒／四亿人的觉醒" };

  if (cats.includes("stgs") || cats.includes("tdjsgs") || /专访|访谈|自述|口述|我为什么/.test(title))
    return { category: "退一步海阔天空", reason: "退党人物专访" };

  if (
    cats.includes("tddt") || cats.includes("ygfc") || cats.includes("styg") || cats.includes("sths") ||
    /真相点|义工|征签|游行|集会|车游|服务中心/.test(title)
  )
    return { category: "三退前线", reason: "一线活动与义工" };

  return { category: "其它系列", reason: "没有对应的系列" };
}

const CATEGORY_ORDER = [
  "三退前线", "破除党文化", "退一步海阔天空", "九评系列",
  "铁证如山", "觉醒之旅", "希望的路", "其它系列"
];

function main() {
  const source = process.argv[2] ?? "artifacts/phase5/normalized-full.json";
  const outPath = process.argv[3] ?? "artifacts/phase5/video-allocation.json";
  const parsed = JSON.parse(readFileSync(source, "utf8"));
  const rows: Row[] = parsed.rows ?? parsed;

  const assigned = rows
    .map((row) => ({ row, group: groupOf(row) }))
    .filter((entry): entry is { row: Row; group: VideoGroup } => entry.group !== null)
    .map(({ row, group }) => {
      const { category, reason } = allocate(row);
      return {
        group,
        category,
        reason,
        slug: row.slug,
        title: row.title,
        publishedAt: row.publishedAt,
        legacyId: row.legacyId,
        legacyUrl: row.legacyUrl,
        hasPlayer: hasPlayer(row),
        playable: playable(row),
        oldCategories: row.wpCategories
      };
    });

  for (const group of ["series", "tagged", "rescue", "orphan"] as VideoGroup[]) {
    const list = assigned.filter((entry) => entry.group === group);
    process.stderr.write(`\n【${group}】${list.length} 篇\n`);
    for (const category of CATEGORY_ORDER) {
      const inCategory = list.filter((entry) => entry.category === category);
      if (inCategory.length === 0) continue;
      const withPlayer = inCategory.filter((entry) => entry.playable).length;
      process.stderr.write(`  ${category.padEnd(8)} ${String(inCategory.length).padStart(4)}  （可播放 ${withPlayer}）\n`);
    }
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), items: assigned }, null, 2));
  process.stderr.write(`\n已写入 ${outPath}（${assigned.length} 条）\n`);
}

main();
