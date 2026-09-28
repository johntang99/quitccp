import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";

/**
 * Staff-side declaration queue.
 *
 * Lives apart from `repository.ts` because declarations are service-domain
 * data, not CMS content. Per the architecture note the two domains keep
 * independent audit trails, so everything here writes to `service_audit_logs`,
 * never `cms_audit_logs` -- including reads, since listing declarations is
 * itself a sensitive action.
 */

export type DeclarationStatus = "pending_review" | "published" | "rejected";
export type CertificateStatus = "pending" | "issued" | "revoked";

export interface AdminDeclarationRecord {
  id: string;
  sequenceNumber: string | null;
  alias: string;
  organizationScopes: string[];
  statement: string;
  region: string | null;
  wantsCertificate: boolean;
  source: string;
  status: DeclarationStatus;
  createdAt: string;
  certificate: {
    id: string;
    serialNumber: string;
    status: CertificateStatus;
    holderName: string | null;
    issuedAt: string | null;
  } | null;
}

export interface DeclarationListFilters {
  status?: string;
  source?: string;
  wantsCertificate?: boolean;
  page?: number;
  pageSize?: number;
}

async function createServiceAudit(
  actorEmail: string,
  action: string,
  targetType: string,
  targetId: string,
  accessMode: "read" | "write",
  detail: Record<string, unknown> = {}
) {
  const supabase = createSupabaseAdminClient();
  await supabase.from("service_audit_logs").insert({
    actor_email: actorEmail,
    action,
    target_type: targetType,
    target_id: targetId,
    access_mode: accessMode,
    detail
  });
}

const DECLARATION_STATUSES: DeclarationStatus[] = ["pending_review", "published", "rejected"];

export function isDeclarationStatus(value: string): value is DeclarationStatus {
  return (DECLARATION_STATUSES as string[]).includes(value);
}

export async function listDeclarationsForAdmin(
  filters: DeclarationListFilters,
  actorEmail: string
): Promise<{
  rows: AdminDeclarationRecord[];
  total: number;
  page: number;
  pageSize: number;
  pendingCount: number;
}> {
  const supabase = createSupabaseAdminClient();
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.min(Math.max(filters.pageSize ?? 25, 1), 100);
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from("declarations")
    .select(
      "id, sequence_number, alias, organization_scopes, statement, region, wants_certificate, source, status, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (filters.status && isDeclarationStatus(filters.status)) {
    query = query.eq("status", filters.status);
  }
  if (filters.source) {
    query = query.eq("source", filters.source);
  }
  if (filters.wantsCertificate) {
    query = query.eq("wants_certificate", true);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  const rows = data ?? [];

  // Certificates are fetched in one batched query rather than per row, so a
  // page of the queue stays at two round trips regardless of page size.
  const declarationIds = rows.map((row) => String(row.id));
  const certificatesById = new Map<string, AdminDeclarationRecord["certificate"]>();
  if (declarationIds.length > 0) {
    const { data: certs, error: certError } = await supabase
      .from("certificates")
      .select("id, declaration_id, serial_number, status, holder_name, issued_at")
      .in("declaration_id", declarationIds);
    if (certError) throw certError;
    for (const cert of certs ?? []) {
      certificatesById.set(String(cert.declaration_id), {
        id: String(cert.id),
        serialNumber: String(cert.serial_number),
        status: cert.status as CertificateStatus,
        holderName: cert.holder_name ? String(cert.holder_name) : null,
        issuedAt: cert.issued_at ? String(cert.issued_at) : null
      });
    }
  }

  const { count: pendingCount } = await supabase
    .from("declarations")
    .select("id", { head: true, count: "exact" })
    .eq("status", "pending_review");

  // Audits the query shape and the number of records exposed -- never the
  // statements themselves, which would copy the sensitive payload into a
  // second table.
  await createServiceAudit(actorEmail, "declaration.admin_list", "declaration", "query", "read", {
    filters,
    returned: rows.length
  });

  return {
    rows: rows.map((row) => ({
      id: String(row.id),
      sequenceNumber: row.sequence_number ? String(row.sequence_number) : null,
      alias: String(row.alias),
      organizationScopes: (row.organization_scopes ?? []).map(String),
      statement: String(row.statement),
      region: row.region ? String(row.region) : null,
      wantsCertificate: Boolean(row.wants_certificate),
      source: String(row.source),
      status: row.status as DeclarationStatus,
      createdAt: String(row.created_at),
      certificate: certificatesById.get(String(row.id)) ?? null
    })),
    total: count ?? 0,
    page,
    pageSize,
    pendingCount: pendingCount ?? 0
  };
}

export async function reviewDeclaration(
  id: string,
  decision: "publish" | "reject" | "return_to_pending",
  actorEmail: string
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const status: DeclarationStatus =
    decision === "publish" ? "published" : decision === "reject" ? "rejected" : "pending_review";

  const { data, error } = await supabase
    .from("declarations")
    .update({ status })
    .eq("id", id)
    .select("id, sequence_number, status")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Declaration not found");

  await createServiceAudit(
    actorEmail,
    "declaration.review",
    "declaration",
    String(data.sequence_number ?? data.id),
    "write",
    { decision, status }
  );
}

function generateSerialNumber(): string {
  // Format matches what the public verify page tells people to expect
  // (TD-2026-0071824). The random tail is there so a serial cannot be guessed
  // from a neighbouring one.
  const year = new Date().getFullYear();
  const tail = Math.floor(Math.random() * 10_000_000)
    .toString()
    .padStart(7, "0");
  return `TD-${year}-${tail}`;
}

export async function issueCertificate(
  declarationId: string,
  holderName: string,
  actorEmail: string
): Promise<{ serialNumber: string }> {
  const supabase = createSupabaseAdminClient();

  const { data: declaration, error: declarationError } = await supabase
    .from("declarations")
    .select("id, sequence_number, status")
    .eq("id", declarationId)
    .maybeSingle();
  if (declarationError) throw declarationError;
  if (!declaration) throw new Error("Declaration not found");

  // A certificate attests to a declaration we stand behind, so it can only be
  // issued after review. Rejected is an outright no; pending means nobody has
  // read the statement yet, and certifying unvetted text is the failure mode
  // this queue exists to prevent.
  //
  // KNOWN LIMITATION: `status` currently conflates "vetted" with "displayed
  // publicly", so someone who wants a certificate without public display has no
  // representable state. Splitting those into two columns is the real fix.
  if (declaration.status === "rejected") {
    throw new Error("Cannot issue a certificate for a rejected declaration");
  }
  if (declaration.status === "pending_review") {
    throw new Error("Review and publish this declaration before issuing a certificate");
  }

  const { data: existing } = await supabase
    .from("certificates")
    .select("id, serial_number, status")
    .eq("declaration_id", declarationId)
    .maybeSingle();
  if (existing && existing.status !== "revoked") {
    throw new Error("This declaration already has an active certificate");
  }

  const serialNumber = generateSerialNumber();
  const issuedAt = new Date().toISOString();
  const { error } = await supabase.from("certificates").insert({
    declaration_id: declarationId,
    serial_number: serialNumber,
    status: "issued",
    holder_name: holderName.trim() || null,
    issued_at: issuedAt
  });
  if (error) throw error;

  await createServiceAudit(actorEmail, "certificate.issue", "certificate", serialNumber, "write", {
    declarationSequence: declaration.sequence_number ?? null
  });

  return { serialNumber };
}

export async function revokeCertificate(certificateId: string, actorEmail: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("certificates")
    .update({ status: "revoked" })
    .eq("id", certificateId)
    .select("id, serial_number")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Certificate not found");

  await createServiceAudit(
    actorEmail,
    "certificate.revoke",
    "certificate",
    String(data.serial_number),
    "write",
    {}
  );
}
