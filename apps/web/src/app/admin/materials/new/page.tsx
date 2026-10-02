import { AdminShell } from "@/components/admin/AdminShell";
import { MaterialForm } from "@/components/admin/MaterialForm";
import { MaterialTabs } from "@/components/admin/MaterialTabs";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { listMaterialCategories } from "@/lib/admin/material-repository";

export default async function NewMaterialPage() {
  const user = await requireAdminSessionUser();
  const categories = await listMaterialCategories();

  return (
    <AdminShell user={user}>
      <MaterialTabs active="new" />
      <h2 style={{ margin: "0 0 14px" }}>新建资料</h2>
      <MaterialForm
        mode="new"
        categories={categories.rows.map((row) => ({ id: row.id, name: row.name, slug: row.slug }))}
        initial={{
          slug: "",
          title: "",
          summary: "",
          bodyMarkdown: "",
          coverImage: "",
          coverImageAlt: "",
          files: [],
          status: "draft",
          featured: false,
          publishedAt: null,
          categoryIds: []
        }}
      />
    </AdminShell>
  );
}
