import type { TemplateKind } from "@quitccp/content-schema";

export interface TemplatePageData {
  section: string;
  slug: string;
  title: string;
  template: TemplateKind;
  summary?: string;
  locale?: string;
  contentPath?: string;
  content?: Record<string, unknown>;
  query?: Record<string, string | string[] | undefined>;
  /** Only /services/faq: the question library, read from its own tables. */
  faqGroups?: {
    slug: string;
    name: string;
    summary: string;
    items: { slug: string; question: string; answerMarkdown: string }[];
  }[];
}
