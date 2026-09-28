import {
  pageRouteToContentPath,
  prototypePageContentSeeds,
  routeSeeds,
  samplePage,
  type TemplateKind
} from "@quitccp/content-schema";

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
  locale: "zh",
  contentPath: pageRouteToContentPath(seed.section, seed.slug),
  content: prototypePageContentSeeds.find((row) => row.section === seed.section && row.slug === seed.slug)?.data ?? {}
}));

export const mainNav = [
  { href: "/about", label: "关于我们" },
  { href: "/services", label: "我们的服务" },
  { href: "/involve", label: "参与支持" },
  { href: "/news", label: "新闻与报告" },
  { href: "/videos", label: "视频" },
  { href: "/resources", label: "资源馆" }
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
