import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabasePublicClient } from "@/lib/supabase/admin-client";
import { SITE_CHROME_TAG, SITE_CHROME_TTL_SECONDS } from "@/lib/site-chrome-cache";
import { EXTERNAL_SERVICES } from "@/lib/external-services";
import { t } from "@/lib/i18n";
import { SITE_LOCALE } from "@/lib/site-config";

/**
 * The tab row under each section's masthead, as something an editor can change.
 *
 * These labels used to live only in `InteriorScaffold.tsx`. Renaming one meant
 * editing code -- and renaming 历史阿革 to 退党大事记 turned out to touch eleven
 * places across four files and two tables, because the same words were also
 * typed into the "related" panels and the seed content. A name that appears in
 * eleven places is data wearing a code costume.
 *
 * So the row is read from the content entry below, which shows up in 页面内容
 * like any other, and falls back to the table shipped here when the entry is
 * missing or malformed. The fallback is not a nicety: this renders on every
 * interior page, and a bad row of JSON must not take the site down.
 *
 * Only labels and order are editable. `slug` is what the tab points at, and
 * changing it would break the link rather than rename it -- so a slug that is
 * not already known is ignored.
 */

export const SECTION_NAV_PATH = "nav/section-tabs.json";

export interface SectionTab {
  slug: string;
  label: string;
  href?: string;
  /** Leaves this site for the production service on another subdomain. */
  externalHref?: string;
}

export interface SectionNav {
  label: string;
  baseHref: string;
  tabs: SectionTab[];
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Overlay the stored labels onto the shipped table.
 *
 * A merge rather than a replacement, so the entry only has to carry what an
 * editor changed. Anything it does not mention keeps the built-in value, and
 * an entry naming a section or slug that no longer exists is skipped instead
 * of creating a tab that points nowhere.
 */
export function mergeSectionNav(
  base: Record<string, SectionNav>,
  stored: unknown
): Record<string, SectionNav> {
  const overrides = asRecord(asRecord(stored).sections);
  if (Object.keys(overrides).length === 0) return base;

  const merged: Record<string, SectionNav> = {};
  for (const [section, config] of Object.entries(base)) {
    const override = asRecord(overrides[section]);
    const labels = asRecord(override.tabs);
    const order = Array.isArray(override.order) ? override.order.map(String) : null;

    /*
     * 标签留空 = 这个站没有这一项，整条去掉。
     *
     * 原来只有「改名」没有「去掉」：代码里写死的那排子菜单对每个站都一样，
     * 而英文站没有「退一步海阔天空」「文化艺术」这两个视频栏目 —— 标签栏里
     * 挂着它们，点下去 404。改名改不掉一个不存在的栏目。
     *
     * 用空字符串表示，而不是另起一个字段：编辑在后台把名字删空，意思本来
     * 就是「不要这一项」。
     */
    let tabs = config.tabs
      .filter((tab) => !(tab.slug in labels && typeof labels[tab.slug] === "string" && !String(labels[tab.slug]).trim()))
      .map((tab) => {
        const label = labels[tab.slug];
        return typeof label === "string" && label.trim() ? { ...tab, label: label.trim() } : tab;
      });

    if (order) {
      const known = new Map(tabs.map((tab) => [tab.slug, tab]));
      const reordered = order.map((slug) => known.get(slug)).filter((tab): tab is SectionTab => Boolean(tab));
      /* Anything the order forgot stays, at the end: losing a tab because
         somebody edited a list is worse than an unexpected position. */
      const missing = tabs.filter((tab) => !order.includes(tab.slug));
      if (reordered.length > 0) tabs = [...reordered, ...missing];
    }

    const sectionLabel = typeof override.label === "string" && override.label.trim()
      ? override.label.trim()
      : config.label;

    merged[section] = { ...config, label: sectionLabel, tabs };
  }
  return merged;
}

/**
 * Read once per request.
 *
 * `cache` dedupes this across the several places on a page that ask -- the tab
 * row and the breadcrumb both do -- so a page costs one query, not six.
 */
/*
 * Cached across requests as well. `error` is separated from "no row": a
 * missing entry is a real answer worth caching, a failed query is not -- see
 * site-chrome-cache.ts.
 */
const loadSectionNavOverridesUncached = unstable_cache(
  async (): Promise<unknown> => {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("cms_content_entries")
      .select("data")
      .eq("path", SECTION_NAV_PATH)
      .eq("locale", SITE_LOCALE)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return (data as { data?: unknown }).data ?? null;
  },
  /* 缓存键带上 locale：四个站跑在各自的部署里，本来不会共用一个进程内的缓存，
     但 unstable_cache 的键是写进构建产物的 —— 键相同的两份代码一旦跑在同一个
     实例上（比如本地同时开中英两个预览站），就会互相拿到对方的导航。 */
  ["section-nav-overrides", SITE_LOCALE],
  { tags: [SITE_CHROME_TAG], revalidate: SITE_CHROME_TTL_SECONDS }
);

export const loadSectionNavOverrides = cache(async (): Promise<unknown> => {
  try {
    return await loadSectionNavOverridesUncached();
  } catch {
    /* A missing table or a database hiccup leaves the shipped labels in
       place, which is the right answer: the menu is not worth a 500. */
    return null;
  }
});

/*
 * The labels shipped with the code, and the fallback when the editable entry
 * is missing. Editors change these in 页面内容 -> nav/section-tabs.json.
 *
 * It lives here rather than beside the page that renders the tab row because
 * the top menu reads the section names from it too -- see `getPublicNav`.
 * When the two had their own copies, an editor renamed 我们的服务 to
 * 三退登记与证明 and the site spent a day saying one in the menu and the other
 * on the page it led to.
 */
export const SECTION_CONFIG: Record<string, SectionNav> = {
  services: {
    label: t("nav.services"),
    baseHref: "/services",
    // Services are not implemented here -- every tab goes to the production
    // service or reference page on tuidang.org.
    tabs: [
      { slug: "declare", label: "声明三退", externalHref: EXTERNAL_SERVICES.declare },
      { slug: "cert", label: "退党证书", externalHref: EXTERNAL_SERVICES.certApply },
      { slug: "verify", label: "查询验证", externalHref: EXTERNAL_SERVICES.certVerify },
      // Our own page lists the policy documents; the tab used to jump straight
      // to one of them on the old site, skipping the page entirely.
      { slug: "immigration", label: "移民相关政策" },
      // No externalHref: the FAQ lives here now. All 45 answers were imported
      // from tuidang.org/faq/ on 2026-10-07, so sending readers to the old site
      // would send them to a copy that is about to stop being the master.
      { slug: "faq", label: "三退问答" },
      /*
       * The 相关报道 FAQ category, which is the largest of the six (23 entries)
       * and had no way in from the menu -- a reader reached it only by opening
       * 三退问答 and noticing the category list. It lives under /services/faq
       * rather than as a page of its own, so the tab carries an href.
       */
      { slug: "coverage", label: "退党与移民相关报道", href: "/services/faq/c/xgbd" },
      { slug: "privacy", label: "安全与隐私" },
      // Our own 信息变更与联系我们 page, which hands off to the subdomain's
      // cert-modify form. The tab used to jump straight to the old site's
      // contact form, skipping the page.
      { slug: "contact", label: "信息变更" }
    ]
  },
  resources: {
    label: t("nav.resources"),
    baseHref: "/resources",
    tabs: [
      { slug: "index", label: "书籍与文集" },
      /* 资源馆's own page, unrelated to the video category of the same slug. */
      { slug: "culture", label: "中华传统文化" },
      { slug: "downloads", label: "资料下载" },
      { slug: "tools", label: "免翻墙链接" },
      { slug: "magazine", label: "杂志《回归》" },
      { slug: "press", label: "媒体与记者" }
    ]
  },
  about: {
    label: t("nav.about"),
    baseHref: "/about",
    tabs: [
      { slug: "index", label: "机构简介" },
      { slug: "numbers", label: "数字与统计方法" },
      { slug: "network", label: "全球网络" },
      /* 公开与问责 (/about/accountability) was here until 2026-10-14. Removed
         from the tab strip and the footer at the board's request: the page is a
         directory of the places a hostile party would go to file something
         false about the centre -- the IRS exempt-organization search,
         ProPublica, Charity Navigator -- and they would rather not advertise
         them while the site is under attack.

         The page is still published and still answers at its address, and nine
         content pages still link to it where the link means something in
         context. Note that removing it from `order` in nav/section-tabs.json
         would NOT have hidden it: mergeSectionNav keeps any tab the order
         forgot, on purpose. The list here is the one that decides. */
      { slug: "team", label: "理事会与团队" },
      { slug: "history", label: "退党大事记" },
      /* 中文站指向 service 子域上的联系表单（2026-10-28 应要求改）；那个页面是
         中文的，其他语言的站仍用本站的 /services/contact。 */
      {
        slug: "contact",
        label: "联系我们",
        href: SITE_LOCALE === "zh" ? EXTERNAL_SERVICES.serviceContact : "/services/contact"
      }
    ]
  },
  involve: {
    label: t("nav.involve"),
    baseHref: "/involve",
    tabs: [
      { slug: "index", label: "捐助我们" },
      { slug: "volunteer", label: "成为义工" },
      { slug: "endccp", label: "ENDCCP 征签" },
      { slug: "stories", label: "义工故事" },
      { slug: "other-ways", label: "其他支持方式" }
    ]
  },
  news: {
    label: t("nav.news"),
    baseHref: "/news",
    tabs: [
      { slug: "index", label: "全部" },
      { slug: "announcements", label: "机构公告与声明" },
      { slug: "investigations", label: "追查国际调查报告" },
      { slug: "commentary", label: "专题报导与时政评论" },
      { slug: "solidarity", label: "国际声援行动" },
      { slug: "stories", label: "三退新闻与故事" },
      { slug: "notable", label: "名人退党" }
    ]
  },
  videos: {
    label: t("nav.videos"),
    baseHref: "/videos",
    tabs: [
      { slug: "index", label: "全部" },
      { slug: "frontline", label: "三退前线" },
      { slug: "party-culture", label: "破除党文化" },
      { slug: "step-back", label: "退一步海阔天空" },
      { slug: "jiuping", label: "九评系列" },
      { slug: "ironclad", label: "铁证如山" },
      { slug: "awakening", label: "觉醒之旅" },
      // 希望的路 was missing here even though it has 101 films and its own page.
      { slug: "hope-road", label: "希望的路" },
      /* Hardcoded labels: renaming a category in the admin does not reach them.
         文化艺术 was renamed from 中华传统文化 there and this had to follow. The
         video homepage reads the names from the database and needed no change. */
      { slug: "culture", label: "文化艺术" }
    ]
  }
};
