import { NextRequest, NextResponse } from "next/server";
import { issueServiceSessionToken } from "@/lib/service/auth";
import {
  ensureSeedServiceUser,
  findServiceUserByEmail,
  isAccountLocked,
  recordServiceLoginFailure,
  recordServiceLoginSuccess
} from "@/lib/service/user-repository";
import { isMfaRequired } from "@/lib/security/mfa-policy";
import { verifyPassword } from "@/lib/security/password";
import { verifyTotpCode } from "@/lib/security/totp";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      mfaCode?: string;
    };

    const email = String(body.email ?? "");
    const password = String(body.password ?? "");
    const mfaCode = String(body.mfaCode ?? "");

    await ensureSeedServiceUser();
    const user = await findServiceUserByEmail(email);
    if (!user || !user.isActive) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    if (isAccountLocked(user)) {
      return NextResponse.json({ error: "Account locked" }, { status: 423 });
    }

    const passwordOk = verifyPassword(password, user.passwordHash, user.passwordSalt);
    if (!passwordOk) {
      await recordServiceLoginFailure(user);
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const enforceMfa = isMfaRequired() && user.mfaEnabled;
    if (enforceMfa) {
      const secret = user.mfaSecret || process.env.SEED_SERVICE_MFA_SECRET;
      if (!secret || !verifyTotpCode(secret, mfaCode)) {
        await recordServiceLoginFailure(user);
        return NextResponse.json({ error: "Invalid MFA code" }, { status: 401 });
      }
    }

    await recordServiceLoginSuccess(user.id);
    const token = issueServiceSessionToken(
      {
        id: user.id,
        email: user.email,
        role: user.role
      },
      true
    );

    return NextResponse.json({
      token,
      tokenType: "Bearer",
      expiresIn: 4 * 60 * 60
    });
  } catch {
    return NextResponse.json({ error: "Service auth setup incomplete: run latest migrations" }, { status: 503 });
  }
}
