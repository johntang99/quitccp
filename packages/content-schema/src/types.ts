export type SiteSection =
  | "about"
  | "services"
  | "involve"
  | "news"
  | "videos"
  | "resources";

export type TemplateKind =
  | "home"
  | "section-home"
  | "list-archive"
  | "article"
  | "form"
  | "video-library"
  | "long-form";

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
