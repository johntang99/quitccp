import {
  OWNER_EMAIL,
  can,
  canManageRole,
  canModifyAccountOfRole,
  type Capability
} from "./permissions";
import type { AdminRole } from "./types";

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
    label: "所有者",
    actor: { role: "super_admin", email: OWNER_EMAIL },
    note: `超级管理员中的 ${OWNER_EMAIL}`
  },
  {
    key: "super_admin",
    label: "超级管理员",
    actor: { role: "super_admin", email: SOMEBODY_ELSE },
    note: "所有者以外的超级管理员"
  },
  { key: "content_admin", label: "管理员", actor: { role: "content_admin", email: SOMEBODY_ELSE } },
  { key: "editor", label: "编辑", actor: { role: "editor", email: SOMEBODY_ELSE } }
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
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/content", label: "页面内容" },
  // 文章分类 lives in the article tab bar now; the sidebar still lights up for
  // it, so the reader is never on a page no section claims.
  { href: "/admin/articles", label: "文章管理", owns: ["/admin/categories"] },
  { href: "/admin/videos", label: "视频管理", owns: ["/admin/video-categories"] },
  { href: "/admin/materials", label: "资料管理", owns: ["/admin/material-categories"] },
  { href: "/admin/media", label: "图片视频库" },
  { href: "/admin/theme", label: "主题与排版", needs: "theme.write" },
  { href: "/admin/users", label: "用户管理", needs: "users.view" },
  { href: "/admin/audit", label: "审计日志", needs: "audit.read" },
  { href: "/admin/revisions", label: "修订历史", needs: "revisions.restore" },
  { href: "/admin/account", label: "我的账号" },
  { href: "/admin/logout", label: "退出", chrome: true }
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
    label: "编辑文章 / 视频 / 资料",
    group: "内容与发布",
    allow: (actor) => can(actor, "content.write")
  },
  {
    label: "查看三退声明",
    note: "每次查看都会写入审计日志",
    allow: (actor) => can(actor, "declarations.read")
  },
  {
    // Listed because leaving it out is what let this rule stay invisible until
    // somebody hit it: editors could write anything and publish nothing.
    label: "把内容设为「已发布」或「已归档」",
    allow: (actor) => can(actor, "content.publish")
  },
  {
    label: "管理文章 / 视频 / 资料分类",
    allow: (actor) => can(actor, "content.write")
  },
  {
    label: "编辑页面内容（首页头图等）",
    allow: (actor) => can(actor, "content.write")
  },
  {
    label: "立即发布（重建公开页面）",
    note: "让已发布的改动立刻出现在公开页面，不改变任何内容的状态",
    allow: (actor) => can(actor, "publish.revalidate")
  },
  { label: "修改主题与排版", group: "站点与记录", allow: (actor) => can(actor, "theme.write") },
  { label: "修改站点设置", allow: (actor) => can(actor, "settings.write") },
  { label: "查看审计日志", allow: (actor) => can(actor, "audit.read") },
  { label: "恢复历史版本", allow: (actor) => can(actor, "revisions.restore") },
  { label: "打开用户管理", group: "用户管理", allow: (actor) => can(actor, "users.view") },
  { label: "新建：编辑", allow: (actor) => canManageRole(actor, "editor") },
  { label: "新建：管理员", allow: (actor) => canManageRole(actor, "content_admin") },
  { label: "新建：超级管理员", allow: (actor) => canManageRole(actor, "super_admin") },
  {
    label: "改名 / 改角色 / 停用 / 重设密码：编辑",
    allow: (actor) => canModifyAccountOfRole(actor, "editor")
  },
  {
    label: "改名 / 改角色 / 停用 / 重设密码：管理员",
    allow: (actor) => canModifyAccountOfRole(actor, "content_admin")
  },
  {
    label: "改名 / 改角色 / 停用 / 重设密码：超级管理员",
    note: "超级管理员之间不能互相修改，只有所有者可以",
    allow: (actor) => canModifyAccountOfRole(actor, "super_admin")
  },
  { label: "删除编辑", allow: (actor) => canModifyAccountOfRole(actor, "editor") },
  { label: "删除管理员", allow: (actor) => canModifyAccountOfRole(actor, "content_admin") },
  {
    label: "删除超级管理员",
    note: "只有所有者可以",
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
  "任何人都不能删除自己的账号——包括所有者。要离开请改用「停用」，这样审计记录仍然挂在一个真实的账号上。",
  "任何人都不能修改自己的角色，也不能停用自己的账号。",
  "最后一个还能登录的超级管理员不能被降级、停用或删除，否则没有人能再进入用户管理。",
  "任何人都看不到别人的密码，包括超级管理员。密码只能重设，不能查看。",
  "密码至少 8 位。重设密码后，该账号在其他设备上的登录会被全部退出。"
];
