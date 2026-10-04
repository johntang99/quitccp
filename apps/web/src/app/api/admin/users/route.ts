import { NextResponse } from "next/server";
import { getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import {
  OWNER_EMAIL,
  can,
  canManageRole,
  canModifyAccountOfRole
} from "@/lib/admin/permissions";
import { recordAdminAudit } from "@/lib/admin/repository";
import {
  countActiveSuperAdmins,
  createAdminUser,
  deleteAdminUser,
  findManagedUserById,
  setUserPassword,
  updateAdminUser,
  validateEmail,
  validatePassword
} from "@/lib/admin/user-admin-repository";
import type { AdminRole } from "@/lib/admin/types";

const ROLES: AdminRole[] = ["super_admin", "content_admin", "editor"];

function back(request: Request, error?: string) {
  const url = new URL("/admin/users", request.url);
  if (error) url.searchParams.set("error", error);
  else url.searchParams.set("ok", "1");
  return NextResponse.redirect(url, 303);
}

/**
 * Create, change and remove admin accounts.
 *
 * Every rule is checked here and not only in the form. The form hides what you
 * may not do; this refuses it. The two that matter most:
 *
 *  - authority is checked against the *target's* role, both the one it has and
 *    the one it is being given, so an admin cannot promote an editor into an
 *    admin and thereby mint a peer;
 *  - the last active super admin cannot be demoted, deactivated or deleted,
 *    including by themselves, because the first person to do it would lock
 *    everyone out of user management permanently.
 */
export async function POST(request: Request) {
  const actor = await getAdminSessionUser();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(actor, "users.view")) return back(request, "没有权限管理用户。");
  requireAdminMfa(actor);

  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  try {
    if (intent === "create") {
      const email = String(form.get("email") ?? "").trim();
      const name = String(form.get("name") ?? "").trim();
      const password = String(form.get("password") ?? "");
      const role = String(form.get("role") ?? "") as AdminRole;

      if (!ROLES.includes(role)) return back(request, "角色无效。");
      if (!canManageRole(actor, role)) return back(request, "你没有权限创建这个角色。");
      const emailError = validateEmail(email);
      if (emailError) return back(request, emailError);
      const passwordError = validatePassword(password);
      if (passwordError) return back(request, passwordError);
      if (!name) return back(request, "请填写姓名。");

      const result = await createAdminUser({ email, name, password, role, actorEmail: actor.email });
      if (!result.ok) return back(request, result.error);
      await recordAdminAudit(actor.email, "users.create", "admin_user", email, "write", { role, name });
      return back(request);
    }

    const id = String(form.get("id") ?? "");
    const target = id ? await findManagedUserById(id) : null;
    if (!target) return back(request, "账号不存在。");
    // Authority over the account as it stands today. Acting on your own row is
    // allowed through here and then refused per intent below, so the message you
    // get is the specific one ("不能修改自己的角色") rather than a generic denial.
    if (target.id !== actor.id && !canModifyAccountOfRole(actor, target.role)) {
      return back(
        request,
        target.role === "super_admin"
          ? `超级管理员之间不能互相修改，只有所有者账号（${OWNER_EMAIL}）可以。`
          : "你没有权限修改这个账号。"
      );
    }

    if (intent === "role") {
      const role = String(form.get("role") ?? "") as AdminRole;
      if (!ROLES.includes(role)) return back(request, "角色无效。");
      // ...and over the role it would become.
      if (!canManageRole(actor, role)) return back(request, "你没有权限授予这个角色。");
      if (target.id === actor.id) return back(request, "不能修改自己的角色。");
      if (
        target.role === "super_admin" &&
        target.isActive &&
        role !== "super_admin" &&
        (await countActiveSuperAdmins()) <= 1
      ) {
        return back(request, "这是最后一个超级管理员，不能降级。");
      }
      const result = await updateAdminUser(id, { role });
      if (!result.ok) return back(request, result.error);
      await recordAdminAudit(actor.email, "users.role", "admin_user", target.email, "write", {
        from: target.role,
        to: role
      });
      return back(request);
    }

    if (intent === "active") {
      const isActive = String(form.get("isActive") ?? "") === "1";
      if (target.id === actor.id) return back(request, "不能停用自己的账号。");
      if (
        !isActive &&
        target.role === "super_admin" &&
        target.isActive &&
        (await countActiveSuperAdmins()) <= 1
      ) {
        return back(request, "这是最后一个超级管理员，不能停用。");
      }
      const result = await updateAdminUser(id, { isActive });
      if (!result.ok) return back(request, result.error);
      await recordAdminAudit(actor.email, isActive ? "users.activate" : "users.deactivate", "admin_user", target.email, "write");
      return back(request);
    }

    if (intent === "password") {
      const password = String(form.get("password") ?? "");
      const passwordError = validatePassword(password);
      if (passwordError) return back(request, passwordError);
      const result = await setUserPassword(target.email, password);
      if (!result.ok) return back(request, result.error);
      // The password itself is never written to the audit row.
      await recordAdminAudit(actor.email, "users.password", "admin_user", target.email, "write");
      return back(request);
    }

    if (intent === "name") {
      const name = String(form.get("name") ?? "").trim();
      const result = await updateAdminUser(id, { name });
      if (!result.ok) return back(request, result.error);
      await recordAdminAudit(actor.email, "users.rename", "admin_user", target.email, "write", { name });
      return back(request);
    }

    if (intent === "delete") {
      // Nobody deletes their own account -- not an editor, not an admin, not the
      // owner. It is the one destructive act with no second pair of eyes, and
      // the usual reason to want it (leaving) is served by deactivation, which
      // keeps the audit trail attached to a real row.
      if (target.id === actor.id) return back(request, "不能删除自己的账号。");
      if (target.role === "super_admin" && target.isActive && (await countActiveSuperAdmins()) <= 1) {
        return back(request, "这是最后一个超级管理员，不能删除。");
      }
      const result = await deleteAdminUser(id);
      if (!result.ok) return back(request, result.error);
      await recordAdminAudit(actor.email, "users.delete", "admin_user", target.email, "write", {
        role: target.role
      });
      return back(request);
    }

    return back(request, "未知操作。");
  } catch (err) {
    return back(request, err instanceof Error ? err.message : String(err));
  }
}
