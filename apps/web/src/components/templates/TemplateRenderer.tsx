import type { TemplatePageData } from "./types";
import { HomeTemplate } from "./HomeTemplate";
import { SectionHomeTemplate } from "./SectionHomeTemplate";
import { ListArchiveTemplate } from "./ListArchiveTemplate";
import { ArticleTemplate } from "./ArticleTemplate";
import { FormTemplate } from "./FormTemplate";
import { VideoLibraryTemplate } from "./VideoLibraryTemplate";
import { LongFormTemplate } from "./LongFormTemplate";
import { LegalTemplate } from "./LegalTemplate";
import { asRecord, asString } from "./content-utils";

export function TemplateRenderer(page: TemplatePageData) {
  const contentTitle = asString(asRecord(page.content).title, "");
  const resolvedPage = contentTitle ? { ...page, title: contentTitle } : page;

  switch (resolvedPage.template) {
    case "home":
      return <HomeTemplate {...resolvedPage} />;
    case "section-home":
      return <SectionHomeTemplate {...resolvedPage} />;
    case "list-archive":
      return <ListArchiveTemplate {...resolvedPage} />;
    case "article":
      return <ArticleTemplate {...resolvedPage} />;
    case "form":
      return <FormTemplate {...resolvedPage} />;
    case "video-library":
      return <VideoLibraryTemplate {...resolvedPage} />;
    case "long-form":
      return <LongFormTemplate {...resolvedPage} />;
    case "legal":
      return <LegalTemplate {...resolvedPage} />;
    default:
      return <LongFormTemplate {...resolvedPage} />;
  }
}
