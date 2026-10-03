import type { AdminRole, AdminUser } from "./types";

/**
 * Who may do what.
 *
 * One table, consulted by name, so the answer lives in exactly one place. The
 * alternative -- each route deciding for itself from `user.role` -- is how a
 * capability ends up granted in one handler and refused in another, which is a
 * security bug that reads like a typo.
 *
 * `adminCanWrite()` in ./auth is the older, coarser gate: true for every role
 * that may write *anything*. It stays for content routes; anything narrower than
 * that asks here instead.
 */
export type Capability =
  /** Articles, videos, materials, pages, media, categories. */
  | "content.write"
  /** 三退声明 — the submission queue. */
  | "declarations.read"
  /** 主题与排版. */
  | "theme.write"
  /** 站点设置. */
  | "settings.write"
  /** 审计日志 and 修订历史. */
  | "audit.read"
  | "revisions.restore"
  /** 立即发布 — force the public pages to rebuild. */
  | "publish.revalidate"
  /** The user-management screens, split by the role being acted on. */
  | "users.view"
  | "users.manage.editors"
  | "users.manage.admins"
  | "users.manage.superadmins";

const MATRIX: Record<Capability, readonly AdminRole[]> = {
  "content.write": ["super_admin", "content_admin", "editor"],
  // The owner's decision, 2026-10-03: editors work this queue too. Every read
  // writes an audit row, so who saw what stays answerable.
  "declarations.read": ["super_admin", "content_admin", "editor"],
  "theme.write": ["super_admin", "content_admin"],
  "settings.write": ["super_admin", "content_admin"],
  "audit.read": ["super_admin", "content_admin"],
  "revisions.restore": ["super_admin", "content_admin"],
  "publish.revalidate": ["super_admin", "content_admin", "editor"],
  "users.view": ["super_admin", "content_admin"],
  "users.manage.editors": ["super_admin", "content_admin"],
  // An admin who could mint admins would be a super admin with extra steps.
  "users.manage.admins": ["super_admin"],
  "users.manage.superadmins": ["super_admin"]
};

export function can(user: Pick<AdminUser, "role">, capability: Capability): boolean {
  return MATRIX[capability].includes(user.role);
}

/** Throws, for use in route handlers where a refusal should be a 403. */
export function requireCapability(user: Pick<AdminUser, "role">, capability: Capability) {
  if (!can(user, capability)) throw new Error("Permission denied");
}

/**
 * The capability needed to create or edit someone of this role -- so the check
 * is about the *target*, not just the actor. An admin editing another admin is
 * refused by this and not by `users.view`.
 */
export function capabilityForRole(role: AdminRole): Capability {
  if (role === "super_admin") return "users.manage.superadmins";
  if (role === "content_admin") return "users.manage.admins";
  return "users.manage.editors";
}

/** May this actor create or modify an account holding this role? */
export function canManageRole(actor: Pick<AdminUser, "role">, targetRole: AdminRole): boolean {
  return can(actor, capabilityForRole(targetRole));
}

/**
 * The roles this actor may hand out — what the 角色 dropdown is allowed to
 * offer. Derived from the matrix rather than written out again, so the form can
 * never offer something the server would refuse.
 */
export function assignableRoles(actor: Pick<AdminUser, "role">): AdminRole[] {
  return ROLE_ORDER.filter((role) => canManageRole(actor, role));
}

/**
 * The roles this CMS actually uses, in descending authority.
 *
 * `cms_admin_users` also permits `reviewer` and `viewer`. Nothing creates them
 * and no screen offers them; they are legacy values from the original schema.
 * They are deliberately absent here so neither the UI nor the permission table
 * can grant one by accident -- and because `MATRIX` does not list them, any row
 * that somehow held one would be refused everything rather than silently
 * inheriting an editor's reach.
 */
export const ROLE_ORDER: readonly AdminRole[] = ["super_admin", "content_admin", "editor"];

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "超级管理员",
  content_admin: "管理员",
  editor: "编辑",
  reviewer: "审校（已停用）",
  viewer: "只读（已停用）"
};
