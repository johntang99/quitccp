import { pinyin } from "pinyin-pro";
import { createHash } from "node:crypto";
import type { Locale } from "../site-config";

/**
 * 把标题转成网址里能用的那一段，按语言选办法。
 *
 * ## 三层
 *
 * 不给每种语言单独想办法 —— 那样每加一门语言都要从头研究一次。按**书写系统**分：
 *
 *   一、拉丁字母（en de ro fr es…）  折叠变音符 + slugify，不需要词典
 *   二、表音的非拉丁字母（ko ru el…）算法式转写，不需要词典
 *   三、需要词典或词法分析（zh ja）  有转写器就用，没有就退到日期 + 短码
 *
 * 加一门新语言时只问一句：它属于哪一层。拉丁字母写一张十几行的折叠表；表音字母
 * 写一张转写表；需要词典的**直接走兜底**，零工作量。
 *
 * **没有一门语言会卡住上线。** 这是这个框架最重要的性质。
 *
 * ## 日文为什么不转罗马字
 *
 * 不是做不到，是日文读者本来就不指望网址可读。2026-10-21 实测六家日本媒体、
 * 两家韩国媒体，没有一家把标题转成罗马字：
 *
 *   産経      /article/20261021-KKC2HMBAUVBITHUBNMJX6EXY6U/
 *   読売      /election/20261021-GYT1T00169/
 *   NHK       /newsweb/pl/news-nwa-topic-nationwide-E0000000168
 *   大紀元日本 /2026/10/391425.html
 *   大紀元韓国 /2026/10/771583.html
 *
 * 全是日期 + 不透明 ID。给他们一串罗马字，既不合当地习惯，又要背一个 15 MB 的
 * 词典和一套分词的错误率。两家姐妹媒体用的还是同一个形态。
 *
 * 哪天觉得值得补转写器，补上就是 —— 老地址有 cms_redirects 接着，不会断。
 */

/** 变音符折叠：按语言一张表。直接剥离是错的，见下面德语那一行。 */
const FOLD: Record<string, Record<string, string>> = {
  /*
   * 德语的变音符有约定的替代拼法，不是可以丢掉的装饰：
   * Grüße → gruesse，不是 grusse，更不是 gruse。写错了就是另一个词。
   */
  de: { ä: "ae", ö: "oe", ü: "ue", Ä: "Ae", Ö: "Oe", Ü: "Ue", ß: "ss" },
  /* 罗马尼亚语的 ă â î ș ț 去掉附标就是对应的基本字母。 */
  ro: { ă: "a", â: "a", î: "i", ș: "s", ţ: "t", ț: "t", Ă: "A", Â: "A", Î: "I", Ș: "S", Ț: "T" }
};

function fold(text: string, locale: string): string {
  const table = FOLD[locale];
  if (!table) return text;
  let out = "";
  for (const ch of text) out += table[ch] ?? ch;
  return out;
}

/** NFD 之后去掉组合附标 —— 折叠表没覆盖到的欧洲语言字母靠这一层。 */
function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** 小写、非字母数字一律变连字符、首尾和连续的连字符收掉。 */
export function latinSlugify(text: string): string {
  return stripDiacritics(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * 中文：拼音，带词组词典。
 *
 * 繁体原样进去。`pinyin-pro` 两种字形都认，首鋼煉鋼廠 和 首钢炼钢厂 出来都是
 * shougang-liangang-chang，所以标题怎么打的都给同一个地址。
 *
 * 先转简体是看起来对、实际错的做法：zh-variants.ts 的字符表把「么」映到异体
 * 「幺」，于是「是什么」出来是 shi-shen-yao 而不是 shi-shen-me。那张表是为了
 * 放宽搜索而存在的，多一个读音不花钱；地址要的是唯一正确的那个读音，而拼音
 * 词典本来就有。
 */
export function pinyinTransliterate(text: string): string {
  const parts = pinyin(text.trim(), { toneType: "none", type: "array", nonZh: "consecutive" });
  return latinSlugify(parts.join("-"));
}

/** 已登记转写器的语言。没登记的走兜底，不报错。 */
const BY_LOCALE: Partial<Record<Locale, (text: string) => string>> = {
  zh: pinyinTransliterate,
  en: latinSlugify,
  de: (t) => latinSlugify(fold(t, "de")),
  ro: (t) => latinSlugify(fold(t, "ro"))
  /* ja、ko 故意不登记 —— 走兜底，理由见文件开头。 */
};

export function hasTransliterator(locale: string): boolean {
  return Boolean(BY_LOCALE[locale as Locale]);
}

/* 短码用的字母表：去掉了 0/O、1/l/I 这些念出来会混的。 */
const TOKEN_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const TOKEN_LENGTH = 7;

/**
 * 兜底用的短记号，从标题算出来。
 *
 * **确定性的，不是随机的。** 后台的网址栏会随着标题边打边更新；随机记号意味着
 * 每敲一个字它就跳一次，编辑会以为是出了什么毛病。从标题算哈希则是标题不变、
 * 记号不变，标题改了才跟着改 —— 那正是编辑预期的行为。
 *
 * 不复用 short_code：那个值在入库那一刻才发，而网址在表单上就要显示。两者各算
 * 各的，撞车由 (slug, locale) 唯一索引和调用方的 -2 兜底，和拼音地址一样。
 */
export function titleToken(text: string): string {
  const digest = createHash("sha256").update(text.trim()).digest();
  let out = "";
  for (let i = 0; i < TOKEN_LENGTH; i += 1) {
    out += TOKEN_ALPHABET[digest[i] % TOKEN_ALPHABET.length];
  }
  return out;
}

/**
 * 标题转网址主体。
 *
 * 转写器没登记，或者登记了但产出为空（整句生僻字、只有标点的标题），都退到
 * 短记号 —— 地址宁可不可读，也不能没有。
 */
export function transliterate(title: string, locale: string): string {
  const fn = BY_LOCALE[locale as Locale];
  const out = fn ? fn(title) : "";
  return out || titleToken(title);
}
