import type { NextRequest } from "next/server";
import { verifyJwt, signJwt } from "@/lib/security/jwt";
import { getAdminJwtSecret } from "@/lib/supabase/admin-client";
import { findServiceUserById } from "./user-repository";
import type { ServiceRole, ServiceUser } from "./types";

const SERVICE_TOKEN_TTL_SECONDS = 4 * 60 * 60;

interface ServiceSessionClaims {
  sub: string;
  email: string;
  role: ServiceRole;
  mfa: boolean;
  scope: "service";
  exp: number;
  iat: number;
}

function parseBearerToken(request: NextRequest): string | null {
  const auth = request.headers.get("authorization");
  if (!auth) return null;
  const [scheme, token] = auth.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;
  return token;
}

export async function getServiceUserFromHeaders(request: NextRequest): Promise<ServiceUser | null> {
  const token = parseBearerToken(request);
  if (!token) return null;

  const claims = verifyJwt<ServiceSessionClaims>(token, getAdminJwtSecret());
  if (!claims || claims.scope !== "service") return null;

  let user = null;
  try {
    user = await findServiceUserById(claims.sub);
  } catch {
    return null;
  }
  if (!user || !user.isActive) return null;
  if (user.email !== claims.email || user.role !== claims.role) return null;

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    mfaPassed: claims.mfa && user.mfaEnabled,
    mfaEnabled: user.mfaEnabled
  };
}

export function serviceCanWrite(role: ServiceRole) {
  return role === "service_admin" || role === "service_editor";
}

export function issueServiceSessionToken(
  user: Pick<ServiceUser, "id" | "email" | "role">,
  mfaPassed: boolean
): string {
  return signJwt<{
    sub: string;
    email: string;
    role: ServiceRole;
    mfa: boolean;
    scope: "service";
  }>(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      mfa: mfaPassed,
      scope: "service"
    },
    getAdminJwtSecret(),
    SERVICE_TOKEN_TTL_SECONDS
  );
}
