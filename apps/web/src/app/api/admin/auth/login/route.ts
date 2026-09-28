import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuthCookieName, issueAdminSessionToken } from "@/lib/admin/auth";
import {
  ensureSeedAdminUser,
  findAdminUserByEmail,
  isAccountLocked,
  recordAdminLoginFailure,
  recordAdminLoginSuccess
} from "@/lib/admin/user-repository";
import { isMfaRequired } from "@/lib/security/mfa-policy";
import { verifyPassword } from "@/lib/security/password";
import { verifyTotpCode } from "@/lib/security/totp";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (
    !contentType.includes("multipart/form-data") &&
    !contentType.includes("application/x-www-form-urlencoded")
  ) {
    // request.formData() throws on anything else, which surfaced as a 500.
    redirect("/admin/login?error=1");
  }

  const formData = await request.formData();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const mfaCode = String(formData.get("mfaCode") ?? "");

  let user = null;
  try {
    await ensureSeedAdminUser();
    user = await findAdminUserByEmail(email);
  } catch {
    redirect("/admin/login?error=setup");
  }

  if (!user || !user.isActive) {
    redirect("/admin/login?error=1");
  }
  if (isAccountLocked(user)) redirect("/admin/login?error=locked");

  const passwordOk = verifyPassword(password, user.passwordHash, user.passwordSalt);
  if (!passwordOk) {
    await recordAdminLoginFailure(user);
    redirect("/admin/login?error=1");
  }

  const enforceMfa = isMfaRequired() && user.mfaEnabled;
  if (enforceMfa) {
    const secret = user.mfaSecret || process.env.SEED_ADMIN_MFA_SECRET;
    if (!secret || !verifyTotpCode(secret, mfaCode)) {
      await recordAdminLoginFailure(user);
      redirect("/admin/login?error=2");
    }
  }

  try {
    await recordAdminLoginSuccess(user.id);
  } catch {
    redirect("/admin/login?error=setup");
  }

  const token = issueAdminSessionToken(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    // Only claim MFA when a TOTP code was actually checked above. Hardcoding
    // this to true meant a session minted while MFA_REQUIRED=false still
    // asserted mfa:true, so flipping that flag on would have silently admitted
    // every existing session past the MFA gate.
    enforceMfa
  );

  const cookieStore = await cookies();
  cookieStore.set(adminAuthCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8
  });
  redirect("/admin/dashboard");
}
