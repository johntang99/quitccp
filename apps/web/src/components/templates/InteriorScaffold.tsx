import Link from "next/link";
import type { ReactNode } from "react";
import type { Route } from "next";
import { EXTERNAL_LINK_PROPS } from "@/lib/external-services";
import { FigureZoom } from "@/components/public/FigureZoom";
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

/** The optional photograph-and-figure treatment of a section head. */
export interface InteriorHeadFigure {
  /** Photograph behind the band. The brand gradient stays on top of it. */
  image?: string;
  imageAlt?: string;
  /** The object shown beside the words -- a certificate, a cover, a screen. */
  figure?: string;
  figureAlt?: string;
}

export async function InteriorHead({
  section,
  slug,
  title,
  subtitle,
  slim = true,
  actions,
  hero
}: {
  section: string;
  slug: string;
  title: string;
  subtitle?: string;
  slim?: boolean;
  actions?: ReactNode;
  hero?: InteriorHeadFigure;
}) {
  const config = mergeSectionNav(SECTION_CONFIG, await loadSectionNavOverrides())[section];
  const sectionLabel = config?.label ?? title;
  const photo = hero?.image?.trim();
  const figure = hero?.figure?.trim();
  /*
   * The words keep the left, where the breadcrumb already sits and where the
   * eye starts; the figure takes the right, which on this page was empty.
   * The old site had them the other way round, but its band carried no
   * breadcrumb to anchor.
   */
  const dressed = Boolean(photo || figure);

  return (
    <section
      className={`phead${slim ? " phead--slim" : ""}${dressed ? " phead--figure" : ""}`}
    >
      {photo ? (
        <div className="phead-photo" aria-hidden="true">
          <img src={photo} alt="" />
        </div>
      ) : null}
      <div className={`wrap${dressed ? " phead-split" : ""}`}>
        <div className={dressed ? "phead-copy" : undefined}>
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
        {figure ? (
          <div className="phead-figure">
            <FigureZoom src={figure} alt={hero?.figureAlt ?? ""} caption={hero?.figureAlt} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
