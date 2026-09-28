import { redirect } from "next/navigation";
import { requireAdminSessionUser } from "@/lib/admin/auth";

interface EditorPageProps {
  searchParams: Promise<{ path?: string; locale?: string }>;
}

export default async function AdminContentEditorPage({ searchParams }: EditorPageProps) {
  await requireAdminSessionUser();
  const query = await searchParams;
  const next = new URLSearchParams();
  if (query.path) next.set("path", query.path);
  if (query.locale) next.set("locale", query.locale);
  const suffix = next.toString();
  redirect(`/admin/content${suffix ? `?${suffix}` : ""}`);
  return null;
}
