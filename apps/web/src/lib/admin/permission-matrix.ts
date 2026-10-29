import {
  OWNER_EMAIL,
  can,
  canManageRole,
  canModifyAccountOfRole,
  type Capability
} from "./permissions";
import type { AdminRole } from "./types";
import { t } from "@/lib/i18n";

/**
 * The permission tables shown in 用户管理, computed rather than written down.
 *
 * A hand-maintained table of who-may-do-what is wrong the first time somebody
 * changes a rule and forgets the documentation -- and a table that disagrees
 * with the code is worse than no table, because people plan around it. Every
 * cell here is produced by calling the same functions the routes call, so the
 * page cannot say one thing while the server does another.
 */

/** The four principals the columns describe. */
export interface MatrixColumn {
  key: string;
  label: string;
  /** What is checked: the role, plus whether this is the owner account. */
  actor: { role: AdminRole; email: string };
  note?: string;
}

const SOMEBODY_ELSE = "another.admin@example.com";

export const MATRIX_COLUMNS: readonly MatrixColumn[] = [
  {
    key: "owner",
    label: t("admin.role.owner"),
    actor: { role: "super_admin", email: OWNER_EMAIL },
    note: t("admin.role.ownerNote", { email: OWNER_EMAIL })
  },
  {
    key: "super_admin",
    label: t("admin.role.superAdmin"),
    actor: { role: "super_admin", email: SOMEBODY_ELSE },
    note: t("admin.role.superAdminNote")
  },
  { key: "content_admin", label: t("admin.role.contentAdmin"), actor: { role: "content_admin", email: SOMEBODY_ELSE } },
  { key: "editor", label: t("admin.role.editor"), actor: { role: "editor", email: SOMEBODY_ELSE } }
];

export interface MatrixRow {
  label: string;
  /** Why the row exists, when the label alone does not say it. */
  note?: string;
  /** Section heading; rendered once, above the first row that carries it. */
  group?: string;
  allow: (actor: { role: AdminRole; email: string }) => boolean;
}

/**
 * Admin pages, and what each one requires.
 *
 * Shared with the sidebar: AdminNav renders from this same list, so a page that
 * is hidden from someone is also a page this table marks 拒绝 for them.
 */
export interface AdminNavLink {
  href: string;
  label: string;
  needs?: Capability;
  /** Sub-pages that should light this entry up in the sidebar. */
  owns?: readonly string[];
  /** Navigation chrome rather than a page with permissions of its own. */
  chrome?: boolean;
}

/*
 * 站点设置 is deliberately absent.
 *
 * It is a raw JSON key/value editor for `site.nav`, `site.homeHero` and
 * `seo.default`, plus a Meilisearch sync button. None of those keys has a row:
 * the site falls back to the navigation written in code, Meilisearch is not
 * deployed, and the only row the table does hold -- `site.theme` -- is written
 * by 主题与排版, not here. Using it means hand-writing JSON into a textarea,
 * where one missing bracket empties the site's navigation.
 *
 * The page still exists at /admin/settings for whoever needs it; it is only off
 * the menu, so an editor cannot wander into it.
 */
export const ADMIN_NAV_LINKS: readonly AdminNavLink[] = [
  { href: "/admin/dashboard", label: t("admin.nav.dashboard") },
  { href: "/admin/content", label: t("admin.nav.content") },
  // 文章分类 lives in the article tab bar now; the sidebar still lights up for
  // it, so the reader is never on a page no section claims.
  { href: "/admin/articles", label: t("admin.nav.articles"), owns: ["/admin/categories"] },
  { href: "/admin/videos", label: t("admin.nav.videos"), owns: ["/admin/video-categories"] },
  { href: "/admin/materials", label: t("admin.nav.materials"), owns: ["/admin/material-categories"] },
  // 常见问答 keeps its categories screen under its own path, so the sidebar
  // stays lit while an editor is in there.
  { href: "/admin/faq", label: t("admin.nav.faq"), owns: ["/admin/faq/categories"] },
  { href: "/admin/media", label: t("admin.nav.media") },
  // Next to the media library, because that is where its output lands.
  { href: "/admin/video-studio", label: t("admin.nav.videoStudio") },
  { href: "/admin/theme", label: t("admin.nav.theme"), needs: "theme.write" },
  { href: "/admin/users", label: t("admin.nav.users"), needs: "users.view" },
  // The owner's decision, 2026-10-15: everyone who can sign in sees this. It
  // was briefly behind `declarations.read`, which happens to cover all three
  // roles anyone actually holds today -- but the point is that monthly
  // certificate counts are the organisation's own headline number, not
  // privileged information, and a `reviewer` or `viewer` account created next
  // year should see it without anybody remembering to come back here.
  { href: "/admin/cert-stats", label: t("admin.nav.certStats") },
  // The owner's decision, 2026-10-29: every editor sees this. Which pieces are
  // read and where readers come from is editorial information, and nothing on
  // the page can point at a person.
  { href: "/admin/stats", label: t("admin.nav.traffic") },
  { href: "/admin/audit", label: t("admin.nav.audit"), needs: "audit.read" },
  // Next to 审计日志 because they are the two "what happened" screens, and
  // deliberately separate: that one is who did what inside the admin, this one
  // is what the public site served. Same permission as the defence panel --
  // an editor can neither act on a 5xx rate nor read it without alarm.
  { href: "/admin/logs", label: t("admin.nav.logs"), needs: "publish.revalidate" },
  { href: "/admin/revisions", label: t("admin.nav.revisions"), needs: "revisions.restore" },
  { href: "/admin/account", label: t("admin.nav.account") },
  { href: "/admin/logout", label: t("admin.nav.logout"), chrome: true }
];

/** Table 1: which admin pages each principal can open. */
export const PAGE_ROWS: readonly MatrixRow[] = ADMIN_NAV_LINKS.filter((link) => !link.chrome).map(
  (link) => ({
    label: link.label,
    allow: (actor) => (link.needs ? can(actor, link.needs) : true)
  })
);

/** Table 2: what each principal can actually do. */
export const ACTION_ROWS: readonly MatrixRow[] = [
  {
    label: t("admin.perm.editContent"),
    group: t("admin.perm.group.content"),
    allow: (actor) => can(actor, "content.write")
  },
  {
    label: t("admin.perm.readDeclarations"),
    note: t("admin.perm.readDeclarationsNote"),
    allow: (actor) => can(actor, "declarations.read")
  },
  {
    // Listed because leaving it out is what let this rule stay invisible until
    // somebody hit it: editors could write anything and publish nothing.
    label: t("admin.perm.publishContent"),
    allow: (actor) => can(actor, "content.publish")
  },
  {
    label: t("admin.perm.manageCategories"),
    allow: (actor) => can(actor, "content.write")
  },
  {
    label: t("admin.perm.editPages"),
    allow: (actor) => can(actor, "content.write")
  },
  {
    label: t("admin.perm.revalidate"),
    note: t("admin.perm.revalidateNote"),
    allow: (actor) => can(actor, "publish.revalidate")
  },
  { label: t("admin.perm.theme"), group: t("admin.perm.group.site"), allow: (actor) => can(actor, "theme.write") },
  { label: t("admin.perm.settings"), allow: (actor) => can(actor, "settings.write") },
  { label: t("admin.perm.audit"), allow: (actor) => can(actor, "audit.read") },
  { label: t("admin.perm.revisions"), allow: (actor) => can(actor, "revisions.restore") },
  { label: t("admin.perm.openUsers"), group: t("admin.perm.group.users"), allow: (actor) => can(actor, "users.view") },
  { label: t("admin.perm.createEditor"), allow: (actor) => canManageRole(actor, "editor") },
  { label: t("admin.perm.createContentAdmin"), allow: (actor) => canManageRole(actor, "content_admin") },
  { label: t("admin.perm.createSuperAdmin"), allow: (actor) => canManageRole(actor, "super_admin") },
  {
    label: t("admin.perm.modifyEditor"),
    allow: (actor) => canModifyAccountOfRole(actor, "editor")
  },
  {
    label: t("admin.perm.modifyContentAdmin"),
    allow: (actor) => canModifyAccountOfRole(actor, "content_admin")
  },
  {
    label: t("admin.perm.modifySuperAdmin"),
    note: t("admin.perm.modifySuperAdminNote"),
    allow: (actor) => canModifyAccountOfRole(actor, "super_admin")
  },
  { label: t("admin.perm.deleteEditor"), allow: (actor) => canModifyAccountOfRole(actor, "editor") },
  { label: t("admin.perm.deleteContentAdmin"), allow: (actor) => canModifyAccountOfRole(actor, "content_admin") },
  {
    label: t("admin.perm.deleteSuperAdmin"),
    note: t("admin.perm.deleteSuperAdminNote"),
    allow: (actor) => canModifyAccountOfRole(actor, "super_admin")
  }
];

/**
 * Rules that hold for everyone, so they have no column of their own.
 *
 * These are the guards that stop the user system destroying itself; they refuse
 * the owner exactly as firmly as they refuse an editor.
 */
export const INVARIANTS: readonly string[] = [
  t("admin.perm.invariant.noSelfDelete"),
  t("admin.perm.invariant.noSelfRole"),
  t("admin.perm.invariant.lastSuperAdmin"),
  t("admin.perm.invariant.noPasswordView"),
  t("admin.perm.invariant.passwordLength")
];
