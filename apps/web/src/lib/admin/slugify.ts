/* 相对路径，不是 @/ 别名：这个文件被 scripts/ 下的脚本直接引用，而那些脚本
   从仓库根跑，看不到 apps/web/tsconfig.json 里的 paths 配置。用别名会让
   pinyin-slug-dryrun 这类脚本在 import 阶段就挂掉。 */
import { transliterate, hasTransliterator } from "../slug/transliterate";
import { SITE_LOCALE } from "../site-config";

/**
 * Turns a Chinese title into the slug that becomes its public address.
 *
 * Editors write titles; nobody should have to hand-romanise one. Until now the
 * admin forms kept the Chinese characters in the slug, which produced addresses
 * that are unreadable once a browser encodes them --
 * `/boards/2026-10-10-361%E5%90%8D%E6%B3%95%E8%BC%AA%E5%8A%9F…` -- and cannot
 * be pasted into a chat window in one line.
 *
 * ## Why this runs on the server
 *
 * `pinyin-pro` unpacks to roughly a megabyte. Shipping it to the browser to
 * convert one title per save would be absurd, and the alternative -- a
 * character table, which is how `zh-variants.ts` solves the traditional/
 * simplified problem -- is wrong here for a reason that matters: a table reads
 * one character at a time, and Chinese pronunciation is contextual.
 *
 *     重庆  chong-qing   not  zhong-qing
 *     会计  kuai-ji      not  hui-ji
 *     银行  yin-hang     not  yin-xing
 *
 * `pinyin-pro` carries a phrase dictionary and gets those right. So the
 * conversion stays here and the admin form asks for it over the network.
 */

/**
 * `2026-10-12-`, from the piece's own publish date.
 *
 * It used to read the clock. That is right for a new piece being typed now and
 * wrong for everything else: 把 16,218 条旧内容改成拼音地址时，它会给 2017 年
 * 的文章盖上今天的日期。日期前缀是用来区分同名文章的，而同名的两篇几乎总是
 * 发在不同的日子 —— 全部盖成同一天，前缀就什么也没区分。
 *
 * `when` 读不出日期就退回今天：新建表单没填发布时间时就是这种情况。
 *
 * ## 为什么按 UTC 取年月日
 *
 * 站上已经带日期前缀的 slug，拿它们自己的 `published_at` 比对过：前缀和 UTC
 * 日期 5/5 吻合，和纽约时间只有 4/5。本来就该如此 —— 线上跑在 Vercel，服务器
 * 时区就是 UTC，原来那版读本地时钟的代码在那里等同于 UTC。写明 UTC 是为了让
 * 本地跑批出来的结果和线上一致：用本地时钟，在纽约跑这个迁移会把
 * `2024-10-15T00:00Z` 算成 10-14，16,218 条里有一批日期会整体偏一天。
 */
function datePrefix(when?: Date | string | null): string {
  const at = when ? new Date(when) : new Date();
  const day = Number.isNaN(at.getTime()) ? new Date() : at;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}-`;
}

/**
 * 标题里的集数，抽成一个短记号。
 *
 * 这个站的系列片很多，而集数往往在标题最末尾：
 *
 *     【人物专访】整个社会被共产党掌握着 老百姓完全被胁迫——维权斗士陈祥卫的抗争之路（四）
 *
 * 这一条拼出来远超 80 字符，按长度一截，「（四）」正好是被切掉的那一节 ——
 * 于是（一）到（四）四集拿到同一个地址，四取其一，另外三条进了撞名处理。
 * 集数不是标题的装饰，它是这四条内容之间唯一的区别。
 *
 * 认这几种写法：（三）（上）（下）、第 65 集、第十六期、EP21、(2)。
 * 汉字数字转成阿拉伯数字 —— `-3` 比 `-san` 一眼就懂，而且地址里本来就有数字。
 */
const CN_NUM: Record<string, number> = {
  一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10
};

function cnNumber(text: string): number | null {
  if (/^\d+$/.test(text)) return Number(text);
  /* 十一到九十九：十=10、十二=12、二十=20、二十三=23 */
  const m = text.match(/^([一二两三四五六七八九])?十([一二三四五六七八九])?$/);
  if (m) return (m[1] ? CN_NUM[m[1]] : 1) * 10 + (m[2] ? CN_NUM[m[2]] : 0);
  const single = CN_NUM[text];
  return single ?? null;
}

/** 集数在标题里的原文和它的短记号。跑批时要用原文去验「它到底保住了没有」。 */
export function episodeMatch(title: string): { text: string; token: string } | null {
  /* 第 N 集／期／部／季 */
  const di = title.match(/第\s*([0-9]+|[一二两三四五六七八九十]+)\s*[集期部季]/);
  if (di) {
    const n = cnNumber(di[1]);
    if (n !== null) return { text: di[0], token: String(n) };
  }
  /* EP21 / ep 21 */
  const ep = title.match(/\bEP\s*([0-9]+)/i);
  if (ep) return { text: ep[0], token: `ep${Number(ep[1])}` };
  /* （三）（上）（下）（上集）（下篇）(2) —— 括号里只许是一个数字或方位词，
     后面最多再跟一个 集篇部季期。所以（图文）（视频）（音频）这类不会误判：
     图、视、音 都不在允许的字集里。实测 16,218 条标题，这条规则把 219 条
     「长得像集数」的里面真正是集数的挑了出来，而「第一人」「第一次」「原因
     之一」这些留在了外面。 */
  const paren = title.match(
    /[（(]\s*(?:之\s*)?([0-9]{1,3}|[一二两三四五六七八九十]{1,3}|上|中|下|前|后)\s*[集篇部季期]?\s*[）)]/
  );
  if (paren) {
    const raw = paren[1];
    const named: Record<string, string> = { 上: "shang", 中: "zhong", 下: "xia", 前: "qian", 后: "hou" };
    if (named[raw]) return { text: paren[0], token: named[raw] };
    const n = cnNumber(raw);
    if (n !== null) return { text: paren[0], token: String(n) };
  }

  /* 「……之三」：系列片常用的写法，站上有九十多条。只认结尾处的，因为句中的
     「之一」多半是「原因之一」那种意思，不是第几集。 */
  const zhi = title.match(/之\s*([一二两三四五六七八九十]{1,3}|[0-9]{1,3})\s*$/);
  if (zhi) {
    const n = cnNumber(zhi[1]);
    if (n !== null) return { text: zhi[0], token: String(n) };
  }

  /* 上集／下篇 这类不带括号的 */
  const bare = title.match(/(上|中|下)\s*[集篇部]\s*$/);
  if (bare) {
    const named: Record<string, string> = { 上: "shang", 中: "zhong", 下: "xia" };
    return { text: bare[0], token: named[bare[1]] };
  }

  return null;
}

export function episodeToken(title: string): string {
  return episodeMatch(title)?.token ?? "";
}

/**
 * ü has no place in a URL. Hanyu Pinyin only puts it after n and l (虐 nüe,
 * 绿 lü), and dropping the diaeresis is what every Chinese site does: nue, lu.
 */
export interface SlugOptions {
  /** Prepend `YYYY-MM-DD-`. The 资料 form offers this as a checkbox. */
  withDate?: boolean;
  /** 用哪一天。留空就是今天 —— 旧内容改名时必须传它自己的发布日。 */
  date?: Date | string | null;
  /** 长度上限，默认 80。传 Infinity 可以拿到没截断的样子，跑批时用来统计。 */
  limit?: number;
  /**
   * 截断时保住标题末尾那一段。
   *
   * 平时不用。它是给撞名准备的第二次尝试：两条标题前 80 个字符一样、区别在
   * 最末尾时，按长度一截就成了同一个地址。站上真有这种 —— 同一场集会的五篇
   * 报导，区别只在结尾的发言人名字：
   *
   *   8千多法轮功学员…退出中共(吴文昕发言）
   *   8千多法轮功学员…退出中共(张锦华发言）
   *
   * 退而求其次给它们 `-2`、`-3` 是合规的，但那样的地址等于没信息，正是我们
   * 做这次改名要消灭的东西。打开这个开关，头部让出位置，把末尾接回来。
   */
  keepTail?: boolean;
  /**
   * 用哪种语言的转写办法。默认当前站。
   *
   * 显式传它的场合只有一个：跑批脚本在另一个站的内容上操作。日常走默认。
   */
  locale?: string;
}

/**
 * The slug for a title. Returns "" when nothing survives, which the caller
 * should treat as "leave the field alone" rather than writing an empty slug.
 */
export function slugifyTitle(title: string, options: SlugOptions = {}): string {
  const locale = options.locale ?? SITE_LOCALE;
  /* 转写办法按语言选，见 lib/slug/transliterate.ts 的三层框架。中文仍然是拼音，
     行为和改造前一字不差。 */
  const base = transliterate(title, locale);

  if (!base) return "";

  /*
   * 没有转写器的语言（日、韩）拿到的是一个七位短记号 —— 它本来就短，截断和
   * 「保住集数」这些规则对它没有意义，截了反而会毁掉它的唯一性。
   */
  const body = hasTransliterator(locale)
    ? trim(base, options.limit ?? 80, episodeToken(title), options.keepTail ?? false)
    : base;
  return options.withDate ? `${datePrefix(options.date)}${body}` : body;
}

/**
 * Keeps a slug to a readable length.
 *
 * Per-character pinyin is long: a 39-character headline romanises to 164. That
 * is not broken -- browsers and Postgres take it -- but it is unreadable in a
 * chat window and pointless, since nothing past the first few words tells a
 * reader anything they did not already get.
 *
 * Cut at a hyphen so the slug never ends mid-syllable: `…-zhong-guo` rather
 * than `…-zhong-gu`.
 */
function cutAtHyphen(base: string, room: number): string {
  if (base.length <= room) return base.replace(/-+$/, "");
  const cut = base.slice(0, room);
  const lastBreak = cut.lastIndexOf("-");
  return (lastBreak > room / 2 ? cut.slice(0, lastBreak) : cut).replace(/-+$/, "");
}

/** 末尾的几节，凑够能区分开就停 —— 整节整节地取，不切断音节。 */
function lastSegments(base: string, budget: number): string {
  const seg = base.split("-");
  let tail = "";
  for (let i = seg.length - 1; i >= 0; i -= 1) {
    const next = tail ? `${seg[i]}-${tail}` : seg[i];
    if (next.length > budget) break;
    tail = next;
    /* 够长到能区分就停。12 太短，人名会被切成半个（吴文昕只剩 wen-xin）；
       16 够装下「wu-wen-xin-fa-yan」这种整段。头部让出的那几节本来就是两条
       标题共有的部分，缩短它不损失任何信息。 */
    if (tail.length >= 16) break;
  }
  return tail;
}

function trim(base: string, limit = 80, episode = "", keepTail = false): string {
  if (base.length <= limit) return base;

  /*
   * 末尾必须保住的那一段：要么是用来区分的尾巴（撞名时的第二次尝试），要么
   * 是集数。两者都落在标题末尾，而末尾正是按长度一截最先被切掉的地方。
   */
  const suffix = keepTail ? lastSegments(base, 26) : episode;
  if (!suffix) return cutAtHyphen(base, limit);

  const head = cutAtHyphen(base, limit - suffix.length - 1);

  /* 按「整节」比对，不是按子串 —— 否则标题里随便一个 3 都会让我们以为集数
     还在。尾巴是多节的，就看 head 是不是已经以它结尾。 */
  const already = suffix.includes("-")
    ? head.endsWith(suffix)
    : head.split("-").includes(suffix);
  return already ? head : `${head}-${suffix}`;
}
