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
  section: string;
  locale: string;
  status: "draft" | "review" | "published" | "archived";
  bodyMarkdown: string;
  bodyPlain: string;
  category: string;
  tags: string[];
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
