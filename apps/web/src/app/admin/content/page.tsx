import { AdminShell } from "@/components/admin/AdminShell";
import { ContentExplorer } from "@/components/admin/ContentExplorer";
import { requireAdminSessionUser } from "@/lib/admin/auth";

interface AdminContentPageProps {
  searchParams: Promise<{ path?: string; locale?: string }>;
}

export default async function AdminContentPage({ searchParams }: AdminContentPageProps) {
  const user = await requireAdminSessionUser();
  const query = await searchParams;
  const initialPath = query.path;
  const initialLocale = query.locale ?? "zh";

  return (
    <AdminShell user={user}>
      <ContentExplorer initialLocale={initialLocale} initialPath={initialPath} />
    </AdminShell>
  );
}
