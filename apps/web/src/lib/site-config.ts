/**
 * 这个部署是哪个语言的站。
 *
 * 一套代码部署 N 次，每次连同一个数据库、挂不同的域名，靠 SITE_LOCALE 区分。
 * 所有和语言有关的行为 —— 读写哪些内容、网址怎么转写、搜索要不要繁简互通、
 * 加载哪套字体、日期怎么格式化 —— 都从这里出发，而不是散落在各处的 if 判断。
 *
 * ## 为什么默认是 zh 而不是必填
 *
 * 中文站是第一个、也是唯一一个在这套代码上跑了几个月的站。如果这个变量设成必填，
 * 任何一次忘配环境变量的部署都会让它整站起不来 —— 而它是流量最大、正在被攻击的
 * 那一个。默认 zh 意味着「忘配」的后果是新站行为不对（上线前一测就发现），
 * 而不是老站崩掉。
 *
 * 新站上线清单里有一条就是核对这个值，见 docs/implementation/multilingual-plan.md。
 */

/** 现在有站的语言。加一门语言就在这里加一项，其余地方查表。 */
export const LOCALES = ["zh", "en", "de", "ja", "ko", "ro"] as const;
export type Locale = (typeof LOCALES)[number];

function readLocale(): Locale {
  const raw = (process.env.SITE_LOCALE ?? "zh").trim().toLowerCase();
  if ((LOCALES as readonly string[]).includes(raw)) return raw as Locale;
  /*
   * 配错了就退回 zh 并喊一声，而不是抛异常。理由同上：一个拼错的环境变量不该让
   * 整站起不来。日志里这一行是上线前能看到的，而 500 页面是读者先看到的。
   */
  console.warn(`[site-config] SITE_LOCALE="${raw}" 不在 ${LOCALES.join("/")} 里，按 zh 处理`);
  return "zh";
}

/** 当前站的语言。整份代码里判断语言只认这一个来源。 */
export const SITE_LOCALE: Locale = readLocale();

/** 人类可读的名字，给后台界面和报警邮件用。 */
export const LOCALE_LABELS: Record<Locale, string> = {
  zh: "中文",
  en: "English",
  de: "Deutsch",
  ja: "日本語",
  ko: "한국어",
  ro: "Română"
};
