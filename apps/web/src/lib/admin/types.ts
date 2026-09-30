export type AdminRole = "super_admin" | "content_admin" | "editor" | "reviewer" | "viewer";

export interface AdminUser {
  id: string;
  email: string;
  role: AdminRole;
  mfaEnabled: boolean;
  mfaVerified: boolean;
}

export interface PageRecord {
  id: string;
  section: string;
  slug: string;
  title: string;
  locale: string;
  status: "draft" | "review" | "published" | "archived";
  blocksJson: string;
  updatedAt: string;
}

export interface ArticleRecord {
  id: string;
  slug: string;
  title: string;
  /** Shown under the title; shorter than the summary. */
  subtitle: string;
  section: string;
  locale: string;
  /**
   * `review` is retained because migrated rows may carry it, but the admin
   * offers only 草稿 / 已发布; 归档 is reachable from the delete dialog.
   */
  status: "draft" | "review" | "published" | "archived";
  bodyMarkdown: string;
  bodyPlain: string;
  /** Written by an editor. Falls back to the body's opening when left empty. */
  summary: string;
  /** Primary category name -- the one the breadcrumb uses. */
  category: string;
  /** Additional categories the article also appears under. */
  secondaryCategories: string[];
  tags: string[];
  heroImage: string;
  heroImageAlt: string;
  heroCredit: string;
  author: string;
  translator: string;
  /** Reprint provenance; `sourceUrl` becomes the canonical link. */
  sourceTitle: string;
  sourceUrl: string;
  /** Null while unpublished. */
  publishedAt: string | null;
  /** 重要 — for the places that show a small, current selection. */
  featured: boolean;
  /** 精彩保留 — worth keeping in front of readers after it stops being news. */
  editorArchive: boolean;
  legacyUrl?: string;
  legacyId?: number;
  updatedAt: string;
}

export interface MediaRecord {
  id: string;
  type: "image" | "document" | "video-cover";
  name: string;
  url: string;
  updatedAt: string;
}

export interface CategoryRecord {
  id: string;
  slug: string;
  name: string;
  articleCount: number;
  /** Display order; lower first, name as the tie-break. */
  sortOrder: number;
}

export interface VideoRecord {
  id: string;
  slug: string;
  title: string;
  description: string;
  durationSeconds?: number;
  coverAssetId?: string;
  downloadAssetId?: string;
  platformIdsJson: string;
  status: "draft" | "published" | "archived";
  updatedAt: string;
}

export interface SettingRecord {
  id: string;
  settingKey: string;
  valueJson: string;
  updatedAt: string;
}

export interface RevisionRecord {
  id: string;
  entityType: "page" | "article";
  entityId: string;
  payload: string;
  createdBy: string;
  createdAt: string;
}

export interface AuditRecord {
  id: string;
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  detail: string;
  createdAt: string;
}
