export type SiteSection =
  | "about"
  | "services"
  | "involve"
  | "news"
  | "videos"
  | "resources";

/**
 * Every section a page can live in.
 *
 * Wider than `SiteSection`: "root" is the homepage, which has no section of its
 * own, and "legal" holds the privacy policy and terms of service -- real pages
 * with no slot in the site navigation.
 */
export type PageSection = SiteSection | "root" | "legal";

export type TemplateKind =
  | "home"
  | "section-home"
  | "list-archive"
  | "article"
  | "form"
  | "video-library"
  | "long-form"
  /** A single Markdown document: the privacy policy and the terms of service. */
  | "legal";

export type ContentStatus = "draft" | "review" | "published" | "archived";

export interface PageBlock {
  id: string;
  type: string;
  variant?: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}

export interface PageDocument {
  id: string;
  slug: string;
  section: SiteSection | "root";
  title: string;
  template: TemplateKind;
  status: ContentStatus;
  locale: string;
  blocks: PageBlock[];
  seo?: {
    title?: string;
    description?: string;
  };
  updatedAt: string;
}

export interface ArticleDocument {
  id: string;
  slug: string;
  title: string;
  summary: string;
  bodyMarkdown: string;
  bodyPlain: string;
  locale: string;
  status: ContentStatus;
  category: string;
  tags: string[];
  legacyUrl?: string;
  legacyId?: number;
  publishedAt?: string;
  updatedAt: string;
}
