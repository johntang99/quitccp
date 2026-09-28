export type ServiceRole = "service_admin" | "service_editor" | "service_viewer";

export interface ServiceUser {
  id: string;
  email: string;
  role: ServiceRole;
  mfaPassed: boolean;
  mfaEnabled: boolean;
}

export interface DeclarationRecord {
  id: string;
  alias: string;
  organizationScopes: string[];
  statement: string;
  createdAt: string;
}

export interface CertificateRecord {
  id: string;
  declarationId: string;
  status: "pending" | "issued" | "revoked";
  createdAt: string;
}

export interface ServiceAudit {
  id: string;
  actor: string;
  action: string;
  target: string;
  mode: "read" | "write";
  createdAt: string;
}
