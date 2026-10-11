import Link from "next/link";
import type { ReactNode } from "react";
import type { Route } from "next";
import { EXTERNAL_LINK_PROPS } from "@/lib/external-services";
import { SECTION_CONFIG, loadSectionNavOverrides, mergeSectionNav, type SectionTab } from "@/lib/section-nav";


function getHref(section: string, slug: string): Route {
  return (slug === "index" ? `/${section}` : `/${section}/${slug}`) as Route;
}

export async function InteriorTabs({ section, slug }: { section: string; slug: string }) {
  const config = mergeSectionNav(SECTION_CONFIG, await loadSectionNavOverrides())[section];
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

export async function InteriorHead({
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
  const config = mergeSectionNav(SECTION_CONFIG, await loadSectionNavOverrides())[section];
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
