import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";

/**
 * Anonymous public intake.
 *
 * Separate from `repository.ts` on purpose: everything in there runs as an
 * authenticated staff member and audits under their email. These functions run
 * with no identified actor at all, so they audit as `public:anonymous` and are
 * deliberately narrow -- they can create a declaration and confirm a
 * certificate serial, and nothing else. No read path here returns statement
 * text, aliases, or anything else that could identify a submitter.
 */

const PUBLIC_ACTOR = "public:anonymous";

export const ORGANIZATION_SCOPES = ["中国共产党", "共青团", "少先队"] as const;
export type OrganizationScope = (typeof ORGANIZATION_SCOPES)[number];

export const ALIAS_MAX = 60;
export const STATEMENT_MAX = 4000;
export const STATEMENT_MIN = 10;
export const REGION_MAX = 60;

export interface PublicDeclarationInput {
  alias: string;
  organizationScopes: string[];
  statement: string;
  region?: string;
  wantsCertificate: boolean;
}

export interface PublicDeclarationReceipt {
  sequenceNumber: string;
  createdAt: string;
  wantsCertificate: boolean;
}

export type ValidationError = { field: string; message: string };

export function validateDeclaration(input: Partial<PublicDeclarationInput>): ValidationError[] {
  const errors: ValidationError[] = [];

  const alias = (input.alias ?? "").trim();
  if (!alias) {
    errors.push({ field: "alias", message: "请填写署名。可以是真名、化名或代号。" });
  } else if (alias.length > ALIAS_MAX) {
    errors.push({ field: "alias", message: `署名请控制在 ${ALIAS_MAX} 字以内。` });
  }

  const scopes = Array.isArray(input.organizationScopes) ? input.organizationScopes : [];
  const validScopes = scopes.filter((scope): scope is OrganizationScope =>
    (ORGANIZATION_SCOPES as readonly string[]).includes(scope)
  );
  if (validScopes.length === 0) {
    errors.push({ field: "organizationScopes", message: "请至少选择一个要退出的组织。" });
  }

  const statement = (input.statement ?? "").trim();
  if (statement.length < STATEMENT_MIN) {
    errors.push({ field: "statement", message: "请写下你的声明内容，至少十个字。" });
  } else if (statement.length > STATEMENT_MAX) {
    errors.push({ field: "statement", message: `声明内容请控制在 ${STATEMENT_MAX} 字以内。` });
  }

  const region = (input.region ?? "").trim();
  if (region.length > REGION_MAX) {
    errors.push({ field: "region", message: "所在地区填写过长。" });
  }

  return errors;
}

async function auditPublic(
  action: string,
  targetType: string,
  targetId: string,
  accessMode: "read" | "write",
  detail: Record<string, unknown> = {}
) {
  const supabase = createSupabaseAdminClient();
  // Audit failures must never block or leak into a public response, so this is
  // intentionally best-effort.
  try {
    await supabase.from("service_audit_logs").insert({
      actor_email: PUBLIC_ACTOR,
      action,
      target_type: targetType,
      target_id: targetId,
      access_mode: accessMode,
      detail
    });
  } catch {
    // swallowed by design
  }
}

export async function createPublicDeclaration(
  input: PublicDeclarationInput,
  fingerprint: string
): Promise<PublicDeclarationReceipt> {
  const supabase = createSupabaseAdminClient();

  const { data: sequenceData, error: sequenceError } = await supabase.rpc("next_declaration_sequence");
  if (sequenceError) throw sequenceError;

  const scopes = input.organizationScopes.filter((scope) =>
    (ORGANIZATION_SCOPES as readonly string[]).includes(scope)
  );
  const region = (input.region ?? "").trim();

  const { data, error } = await supabase
    .from("declarations")
    .insert({
      alias: input.alias.trim(),
      organization_scopes: scopes,
      statement: input.statement.trim(),
      region: region || null,
      wants_certificate: input.wantsCertificate,
      source: "public",
      // Public submissions are never displayed until a human has looked at
      // them. The public site reads only 'published' rows.
      status: "pending_review",
      sequence_number: sequenceData
    })
    .select("sequence_number, created_at, wants_certificate")
    .single();
  if (error) throw error;

  // The fingerprint goes in the audit detail, not on the declaration row, so
  // the declaration itself carries nothing linking it back to a network origin.
  await auditPublic("declaration.public_create", "declaration", String(data.sequence_number), "write", {
    fingerprint,
    wantsCertificate: input.wantsCertificate
  });

  return {
    sequenceNumber: String(data.sequence_number),
    createdAt: String(data.created_at),
    wantsCertificate: Boolean(data.wants_certificate)
  };
}

export type VerifyOutcome = "valid" | "not_found" | "revoked" | "name_mismatch";

export interface VerifyResult {
  outcome: VerifyOutcome;
  serialNumber: string;
  issuedAt?: string;
}

/**
 * Confirms only what the page promises a receiving institution will see:
 * whether we issued this serial, when, and its current status. Never the
 * declaration text, the alias, or the region.
 */
export async function verifyCertificate(
  serialInput: string,
  nameInput: string,
  fingerprint: string
): Promise<VerifyResult> {
  const supabase = createSupabaseAdminClient();
  const serial = serialInput.trim().toUpperCase();
  const name = nameInput.trim();

  const { data, error } = await supabase
    .from("certificates")
    .select("serial_number, status, issued_at, created_at, holder_name")
    .eq("serial_number", serial)
    .maybeSingle();
  if (error) throw error;

  let outcome: VerifyOutcome;
  if (!data) {
    outcome = "not_found";
  } else if (data.status === "revoked") {
    outcome = "revoked";
  } else if (name && data.holder_name && data.holder_name.trim() !== name) {
    outcome = "name_mismatch";
  } else if (data.status === "issued") {
    outcome = "valid";
  } else {
    outcome = "not_found";
  }

  try {
    await supabase.from("verification_queries").insert({
      certificate_serial: serial,
      query_origin: fingerprint,
      result: outcome
    });
  } catch {
    // Logging a query must not break the lookup for a receiving institution.
  }
  await auditPublic("certificate.public_verify", "certificate", serial, "read", { outcome });

  return {
    outcome,
    serialNumber: serial,
    // Only surfaced on a match -- an issue date for a serial we did not confirm
    // would be an oracle for guessing valid serials.
    issuedAt: outcome === "valid" ? String(data?.issued_at ?? data?.created_at ?? "") : undefined
  };
}
