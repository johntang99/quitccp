/* 相对路径而不是 @/ 别名：这个文件有单元测试，而 `tsx --test` 从仓库根跑，
   解析不到 apps/web/tsconfig.json 里的 paths。 */
import { SITE_LOCALE, type Locale } from "./site-config";

/**
 * 日期和数字怎么显示，按语言。
 *
 * ## 为什么一定要显式传 locale
 *
 * `(1234).toLocaleString()` 不传参数时读的是**运行环境**的区域设置 —— 服务端是
 * Vercel 的容器（UTC/en-US），浏览器是读者自己的系统。两边算出来的字符串不一样，
 * React 水合时就会报 mismatch，而且页面上的数字会在加载后跳一下。
 *
 * 站上原来的写法是到处写死 `"zh-CN"`，这躲开了上面那个坑，但也让德文站的
 * 467,645,280 显示成英式的逗号而不是德式的 467.645.280。所以收口到这里：
 * 仍然显式传，但传的是**本站的**语言。
 *
 * ## 为什么不用「4.67 亿」那种写法
 *
 * 中文站首页那个计数器是特例，它有自己的组件和理由（见 RegistryCounter）。
 * 这里只做通用的千分位和日期，不做各语言的大数缩写 —— 「亿」「Mio.」「million」
 * 各有各的习惯和断句，硬做一套反而每种语言都不地道。
 */

/** HTML lang 属性用的标签。和 Intl 的不完全一样，所以分开列。 */
const HTML_LANG: Record<Locale, string> = {
  zh: "zh-CN",
  en: "en",
  de: "de",
  ja: "ja",
  ko: "ko",
  ro: "ro"
};

/** Intl 用的标签。 */
const INTL_LOCALE: Record<Locale, string> = {
  zh: "zh-CN",
  en: "en-US",
  de: "de-DE",
  ja: "ja-JP",
  ko: "ko-KR",
  ro: "ro-RO"
};

export const siteHtmlLang: string = HTML_LANG[SITE_LOCALE];
export const siteIntlLocale: string = INTL_LOCALE[SITE_LOCALE];

/** 带千分位的整数。中文 1,234,567；德文 1.234.567。 */
export function formatNumber(value: number, locale: string = siteIntlLocale): string {
  return value.toLocaleString(locale);
}

/** 年月日。 */
export function formatDate(value: Date | string | number, locale: string = siteIntlLocale): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale);
}

/** 年月日 + 时分秒。后台的审计、设置、日志用。 */
export function formatDateTime(value: Date | string | number, locale: string = siteIntlLocale): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(locale);
}

/** 排序用的比较函数。中文按拼音，其余按各自语言的规则。 */
/**
 * 只要时分秒，按站的语言。
 *
 * 给「✓ 已保存 · 14:32」这类状态行用。原来那里写的是
 * `toLocaleTimeString("zh-CN", { hour12: false })` —— 英文站会显示中文的
 * 时间格式。hour12 不写死：英文读者习惯 12 小时制，而中文站本来就是 24 小时制，
 * 两边都交给 Intl 按语言决定。
 */
export function formatTime(value: Date | string | number, locale: string = siteIntlLocale): string {
  return new Date(value).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

export function compareText(a: string, b: string, locale: string = siteIntlLocale): number {
  return a.localeCompare(b, locale);
}
