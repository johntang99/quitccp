import { AdminShell } from "@/components/admin/AdminShell";
import { t } from "@/lib/i18n";
import { FaqForm } from "@/components/admin/FaqForm";
import { canBulkPublish, requireAdminSessionUser } from "@/lib/admin/auth";
import { listFaqCategories } from "@/lib/admin/faq-repository";

export default async function NewFaqPage() {
  const user = await requireAdminSessionUser();
  const { rows: categories } = await listFaqCategories();

  return (
    <AdminShell user={user}>
      <h2 style={{ margin: "0 0 12px" }}>{t("admin.faq.newTitle")}</h2>
      <FaqForm faq={null} categories={categories} canPublish={canBulkPublish(user)} />
    </AdminShell>
  );
}
