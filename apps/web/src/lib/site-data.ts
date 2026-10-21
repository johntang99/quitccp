import {
  pageRouteToContentPath,
  prototypePageContentSeeds,
  routeSeeds,
  samplePage,
  type TemplateKind
} from "@quitccp/content-schema";
import { SITE_LOCALE } from "@/lib/site-config";
import { t } from "@/lib/i18n";

export interface RenderablePage {
  section: string;
  slug: string;
  title: string;
  template: TemplateKind;
  summary: string;
  locale?: string;
  contentPath?: string;
  content?: Record<string, unknown>;
}

export const pageCatalog: RenderablePage[] = routeSeeds.map((seed) => ({
  section: seed.section,
  slug: seed.slug,
  title: seed.title,
  template: seed.template,
  summary: `${seed.title} - ${seed.template}`,
  locale: SITE_LOCALE,
  contentPath: pageRouteToContentPath(seed.section, seed.slug),
  content: prototypePageContentSeeds.find((row) => row.section === seed.section && row.slug === seed.slug)?.data ?? {}
}));

/**
 * Header navigation. Ordered by what a visitor most often arrives for: what is
 * new, then what we do, then who we are.
 *
 * Overridable from the CMS via the `site.nav` setting; this is the fallback
 * when that is unset.
 */
export const mainNav = [
  { href: "/", label: t("nav.home") },
  { href: "/news", label: t("nav.news") },
  { href: "/videos", label: t("nav.videos") },
  { href: "/services", label: t("nav.services") },
  { href: "/about", label: t("nav.about") },
  { href: "/involve", label: t("nav.involve") },
  /* 指向本站自己的征签页，不是 endccp.com：主导航其余各项都是站内栏目，
     而 /involve/endccp 本来就有联署说明、进度和「参与联署」按钮。顶栏那个
     同名按钮才是直接送去签名站的那一个。 */
  { href: "/involve/endccp", label: t("nav.endccp") },
  { href: "/resources", label: t("nav.resources") }
];

export function findPage(section: string, slug?: string): RenderablePage | undefined {
  const normalizedSlug = slug ?? "index";
  return pageCatalog.find((page) => page.section === section && page.slug === normalizedSlug);
}

export function getHomepageHero() {
  const heroBlock = samplePage.blocks.find((block) => block.type === "hero");
  return {
    title: heroBlock?.title ?? "让每一个想离开的人，都能留下记录。",
    body:
      heroBlock?.body ??
      "全球退党服务中心为中国民众提供声明登记、证书验证和公开记录服务。"
  };
}
