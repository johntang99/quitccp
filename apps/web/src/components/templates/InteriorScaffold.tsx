import Link from "next/link";
import type { ReactNode } from "react";
import type { Route } from "next";
import {
  EXTERNAL_LINK_PROPS,
  EXTERNAL_SERVICES
} from "@/lib/external-services";

interface SectionTab {
  slug: string;
  label: string;
  href?: string;
  /**
   * When set, the tab leaves this site for the production service on
   * tuidang.org instead of routing to the local page.
   */
  externalHref?: string;
}

const sectionConfig: Record<string, { label: string; baseHref: string; tabs: SectionTab[] }> = {
  services: {
    label: "我们的服务",
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
      { slug: "privacy", label: "安全与隐私" },
      // Our own 信息变更与联系我们 page, which hands off to the subdomain's
      // cert-modify form. The tab used to jump straight to the old site's
      // contact form, skipping the page.
      { slug: "contact", label: "信息变更" }
    ]
  },
  resources: {
    label: "资源馆",
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
    label: "关于我们",
    baseHref: "/about",
    tabs: [
      { slug: "index", label: "机构简介" },
      { slug: "numbers", label: "数字与统计方法" },
      { slug: "network", label: "全球网络" },
      { slug: "accountability", label: "公开与问责" },
      { slug: "team", label: "理事会与团队" },
      { slug: "history", label: "退党大事记" },
      { slug: "contact", label: "联系我们", href: "/services/contact" }
    ]
  },
  involve: {
    label: "参与支持",
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
    label: "新闻与报告",
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
    label: "视频",
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

function getHref(section: string, slug: string): Route {
  return (slug === "index" ? `/${section}` : `/${section}/${slug}`) as Route;
}

export function InteriorTabs({ section, slug }: { section: string; slug: string }) {
  const config = sectionConfig[section];
  if (!config) return null;

  return (
    <div className="tabs">
      <div className="wrap tabs-in">
        {config.tabs.map((tab) =>
          tab.externalHref ? (
            <a
              key={tab.slug}
              href={tab.externalHref}
              className={slug === tab.slug ? "on" : undefined}
              {...EXTERNAL_LINK_PROPS}
            >
              {tab.label}
            </a>
          ) : (
            <Link
              key={tab.slug}
              href={(tab.href ?? getHref(section, tab.slug)) as Route}
              className={slug === tab.slug ? "on" : undefined}
            >
              {tab.label}
            </Link>
          )
        )}
      </div>
    </div>
  );
}

export function InteriorHead({
  section,
  slug,
  title,
  subtitle,
  slim = true,
  actions
}: {
  section: string;
  slug: string;
  title: string;
  subtitle?: string;
  slim?: boolean;
  actions?: ReactNode;
}) {
  const config = sectionConfig[section];
  const sectionLabel = config?.label ?? title;

  return (
    <section className={`phead${slim ? " phead--slim" : ""}`}>
      <div className="wrap">
        <p className="crumb">
          <Link href="/">首页</Link>
          <span>/</span>
          {slug === "index" || !config ? (
            <span>{sectionLabel}</span>
          ) : (
            <>
              <Link href={config.baseHref as Route}>{sectionLabel}</Link>
              <span>/</span>
              <span>{title}</span>
            </>
          )}
        </p>
        <h1>{title}</h1>
        {subtitle ? <p className="sub">{subtitle}</p> : null}
        {actions ? <div className="phead-cta">{actions}</div> : null}
      </div>
    </section>
  );
}
