import { SITE_LOCALE, type Locale } from "@/lib/site-config";
import { zh } from "./zh";
import { en } from "./en";

/**
 * 界面文案，按语言。
 *
 * ## 为什么不用 next-intl 之类的库
 *
 * 那类库的大半能力在这里用不上：路由不需要语言前缀（域名已经区分了站），
 * 没有语言协商（一个部署只服务一种语言），时区和复数规则各自有更合适的去处。
 * 剩下的就是「一个 key 查一张表」，而那是下面这二十行。
 *
 * 依赖少一个，就少一处将来要跟着升级的东西。
 *
 * ## 回退到中文，而不是显示 key
 *
 * 英文表里缺一条，页面上出现的是中文原文，不是 `nav.news` 这样的占位符。
 * 缺翻译是遗漏，显示 key 是故障 —— 前者读者还能看懂，后者只会让人以为网站坏了。
 * 漏了哪些由 `npm run i18n:check` 报出来，不靠页面上的乱码提醒。
 *
 * ## key 怎么起名
 *
 * `区域.含义`，按出现的地方分组：nav、footer、news、video、share、form、admin。
 * 不要按英文原文起名 —— 文案一改 key 就得跟着改，而 key 是散落在代码里的。
 */

export type Messages = Record<string, string>;

const TABLES: Partial<Record<Locale, Messages>> = { zh, en };

/* 德文、罗马尼亚文等暂时跟英文走：有英文总比有中文好懂，而且上线前一定会
   先补上自己的表。 */
function tableFor(locale: Locale): Messages {
  return TABLES[locale] ?? TABLES.en ?? zh;
}

const active = tableFor(SITE_LOCALE);

/**
 * 取一条文案。
 *
 * `vars` 里的值替换文案里的 `{name}`。数字先用 formatNumber 处理好再传进来 ——
 * 这里不做格式化，免得同一个数字在两个地方长得不一样。
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  const raw = active[key] ?? zh[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole
  );
}

/** 这条文案在当前语言里有没有。给需要「没有就不渲染」的地方用。 */
export function has(key: string): boolean {
  return key in active;
}
