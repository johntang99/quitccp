function parseBoolean(value: string): boolean {
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

/**
 * MFA is enabled by default only in production.
 * You can override this in any environment with MFA_REQUIRED=true/false.
 */
export function isMfaRequired(): boolean {
  const raw = process.env.MFA_REQUIRED;
  if (typeof raw === "string") {
    return parseBoolean(raw);
  }
  return process.env.NODE_ENV === "production";
}
