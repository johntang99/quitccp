import { Barlow_Condensed, Noto_Serif, Noto_Serif_SC } from "next/font/google";
import { SITE_LOCALE } from "@/lib/site-config";

// Headings only. The CSS has always *asked* for Noto Serif SC, but nothing ever
// shipped it, so headings fell back to Songti SC on a Mac and SimSun on Windows,
// where the old 900 weight was synthesised and smeared the strokes.
//
// Body text deliberately does NOT load a webfont: it uses the reader's own CJK
// UI face (PingFang SC / Microsoft YaHei), which is well hinted on both
// platforms and was never the broken part. Serving body text from a webfont
// meant ~2.8MB of unicode-range slices on a long article, because a CJK face is
// delivered as ~100 slices and long Chinese prose touches most of them.
//
// preload:false for the same reason: let the browser fetch only the slices whose
// glyphs are actually on screen.
const serifSC = Noto_Serif_SC({
  weight: ["700"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-serif-sc",
  fallback: ["Songti SC", "serif"],
});

/**
 * 拉丁文字的站用这一款。
 *
 * 英文、德文、罗马尼亚文的标题里没有汉字，用 Noto Serif SC 等于背着一套中日韩
 * 字形去排拉丁字母。Noto Serif 是同一个家族的拉丁版，字形风格接轨，但没有那
 * 上百个 unicode-range 分片 —— 对这些站是净收益，可以放心 preload。
 *
 * 用的是同一个 CSS 变量 --font-serif-sc：主题系统（theme-css.ts 和各个预设）
 * 按这个名字取值，换个名字就要同步改四五个 JSON。变量名对非中文站略有误导，
 * 但那是注释能解决的问题，而改名要动的是数据。
 */
const serifLatin = Noto_Serif({
  weight: ["700"],
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-serif-sc",
  fallback: ["Georgia", "serif"],
});

/**
 * 本站标题用的衬线体。
 *
 * next/font/google 要求在模块顶层用字面量参数调用，不能按运行时的值去选字体，
 * 所以两款都声明、在这里挑一款。没被选中的那款不会有任何文字去用它，浏览器
 * 也就不会下载它的字体文件。
 *
 * 日文和韩文站将来需要 Noto_Serif_JP / Noto_Serif_KR。现在不加 —— 那两个站还
 * 不存在，加进来既没法验证，又让每一次构建多拉两套 CJK 字体。等站开起来，
 * 在这里多两行即可。
 */
export const notoSerifSC = SITE_LOCALE === "zh" ? serifSC : serifLatin;

/**
 * The registry figure on the homepage, and nothing else.
 *
 * It has one job: carry 467,293,946 at ~160px in the space 4.67 亿 used to
 * occupy, while a count-up animation runs through it. That rules out the faces
 * already loaded here -- Noto Serif SC's digits are not the same width (nine
 * `1`s are 422px where nine `0`s are 537px, and `tabular-nums` cannot fix it
 * because the face carries no tabular set), so every frame of the animation
 * would be a different width and the whole line would jitter.
 *
 * Barlow Condensed is tabular once `font-variant-numeric` asks for it, and is
 * the narrowest of the condensed faces that are -- which is what lets eleven
 * characters fit a column that previously held four.
 *
 * Latin only, one weight, and in practice only twelve glyphs (0-9 , and the
 * digits' spacing), so this costs a few kilobytes rather than the megabytes a
 * CJK webfont would.
 */
export const barlowCondensed = Barlow_Condensed({
  weight: ["300"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-cond",
  fallback: ["Noto Sans SC", "sans-serif"],
});
