import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import type { CertificateRecord, DeclarationRecord, ServiceAudit } from "./types";

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

export async function listDeclarations(actorEmail: string): Promise<DeclarationRecord[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("declarations")
    .select("id, alias, organization_scopes, statement, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  await createServiceAudit(actorEmail, "declaration.list", "declaration", "all", "read");
  return (data ?? []).map((row) => ({
    id: String(row.id),
    alias: String(row.alias),
    organizationScopes: (row.organization_scopes ?? []).map(String),
    statement: String(row.statement),
    createdAt: String(row.created_at)
  }));
}

export async function createDeclarationRecord(
  input: {
    id?: string;
    alias: string;
    organizationScopes: string[];
    statement: string;
  },
  actorEmail: string
): Promise<DeclarationRecord> {
  const supabase = createSupabaseAdminClient();
  const id = input.id?.trim() || randomUUID();
  const { data, error } = await supabase
    .from("declarations")
    .insert({
      id,
      alias: input.alias,
      organization_scopes: input.organizationScopes,
      statement: input.statement
    })
    .select("id, alias, organization_scopes, statement, created_at")
    .single();
  if (error) throw error;
  await createServiceAudit(actorEmail, "declaration.create", "declaration", String(data.id), "write");
  return {
    id: String(data.id),
    alias: String(data.alias),
    organizationScopes: (data.organization_scopes ?? []).map(String),
    statement: String(data.statement),
    createdAt: String(data.created_at)
  };
}

export async function createCertificateRecord(
  input: {
    id?: string;
    declarationId: string;
    serialNumber?: string;
    status: "pending" | "issued" | "revoked";
  },
  actorEmail: string
): Promise<CertificateRecord & { serialNumber: string }> {
  const supabase = createSupabaseAdminClient();
  const id = input.id?.trim() || randomUUID();
  const serialNumber = input.serialNumber?.trim() || `TD-${new Date().getFullYear()}-${Date.now()}`;
  const { data, error } = await supabase
    .from("certificates")
    .insert({
      id,
      declaration_id: input.declarationId,
      serial_number: serialNumber,
      status: input.status
    })
    .select("id, declaration_id, serial_number, status, created_at")
    .single();
  if (error) throw error;
  await createServiceAudit(actorEmail, "certificate.create", "certificate", String(data.id), "write");
  return {
    id: String(data.id),
    declarationId: String(data.declaration_id),
    status: data.status as "pending" | "issued" | "revoked",
    createdAt: String(data.created_at),
    serialNumber: String(data.serial_number)
  };
}

export async function findCertificateByIdOrSerial(key: string, actorEmail: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("certificates")
    .select("id, declaration_id, serial_number, status, created_at")
    .or(`id.eq.${key},serial_number.eq.${key}`)
    .maybeSingle();
  if (error) throw error;
  await createServiceAudit(actorEmail, "certificate.read", "certificate", key, "read");
  if (!data) return null;
  return {
    id: String(data.id),
    declarationId: String(data.declaration_id),
    serialNumber: String(data.serial_number),
    status: data.status as "pending" | "issued" | "revoked",
    createdAt: String(data.created_at)
  };
}

export async function listServiceAudits(actorEmail: string): Promise<ServiceAudit[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("service_audit_logs")
    .select("id, actor_email, action, target_id, access_mode, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  await createServiceAudit(actorEmail, "audit.list", "service_audit", "all", "read");
  return (data ?? []).map((row) => ({
    id: String(row.id),
    actor: String(row.actor_email),
    action: String(row.action),
    target: String(row.target_id),
    mode: row.access_mode as "read" | "write",
    createdAt: String(row.created_at)
  }));
}
