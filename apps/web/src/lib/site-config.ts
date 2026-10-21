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

/**
 * 把环境变量的原始值变成一个语言代码，并说明要不要抱怨。
 *
 * 单独抽出来是为了能测：readLocale 读的是 process.env，而模块级的求值只发生
 * 一次，测试里改环境变量已经来不及了。
 */
export function pickLocale(raw: string | undefined | null): { locale: Locale; warn: string | null } {
  const value = (raw ?? "").trim().toLowerCase();
  /*
   * 没配 ≠ 配错了。
   *
   * 中文站本来就不设这个变量（它是默认语言），而 next.config 为了让客户端包
   * 也拿到这个值，没配时传的是空字符串 —— 要是把空值也当「配错」，中文站
   * 每个请求都会在日志里喊一声，真正配错的那一声就淹在里面了。
   */
  if (!value) return { locale: "zh", warn: null };
  if ((LOCALES as readonly string[]).includes(value)) return { locale: value as Locale, warn: null };
  /*
   * 配错了就退回 zh 并喊一声，而不是抛异常。一个拼错的环境变量不该让整站起
   * 不来：日志里这一行是上线前能看到的，而 500 页面是读者先看到的。
   */
  return {
    locale: "zh",
    warn: `[site-config] SITE_LOCALE="${value}" 不在 ${LOCALES.join("/")} 里，按 zh 处理`
  };
}

function readLocale(): Locale {
  const { locale, warn } = pickLocale(process.env.SITE_LOCALE);
  if (warn) console.warn(warn);
  return locale;
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

/**
 * 页头那张横幅 logo。
 *
 * 它是整套标识 —— 印章加字标，而字标上印着组织名。中文站那张写的是
 * 「全球退黨服務中心」，放在英文站的页头上就成了一句读者看不懂的话，而且它是
 * 整页最显眼的东西。
 *
 * 所以按语言选图。素材还没有的语言先用中文那张 —— 一张外文 logo 不好看，
 * 但比一个破图标好：破图标会让人以为整个站坏了。
 *
 * 新站上线清单里有一条就是「把这一语言的 logo 放进 public/logo/」。
 */
const LOGO_BY_LOCALE: Partial<Record<Locale, string>> = {
  zh: "/logo/banner-2022-1.webp"
  // en / de / ja / ko / ro：素材到位后在这里加一行
};

export const SITE_LOGO: string = LOGO_BY_LOCALE[SITE_LOCALE] ?? "/logo/banner-2022-1.webp";

/** 这个站有没有自己的 logo。没有的话值得在上线清单上提醒一次。 */
export const HAS_OWN_LOGO: boolean = Boolean(LOGO_BY_LOCALE[SITE_LOCALE]);
