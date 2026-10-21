import { AdminShell } from "@/components/admin/AdminShell";
import { ContentExplorer } from "@/components/admin/ContentExplorer";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { SITE_LOCALE } from "@/lib/site-config";

interface AdminContentPageProps {
  searchParams: Promise<{ path?: string; locale?: string }>;
}

export default async function AdminContentPage({ searchParams }: AdminContentPageProps) {
  const user = await requireAdminSessionUser();
  const query = await searchParams;
  const initialPath = query.path;
  const initialLocale = query.locale ?? SITE_LOCALE;

  return (
    <AdminShell user={user}>
      <ContentExplorer initialLocale={initialLocale} initialPath={initialPath} />
    </AdminShell>
  );
}
