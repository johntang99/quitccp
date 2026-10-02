import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { MaterialForm } from "@/components/admin/MaterialForm";
import { MaterialTabs } from "@/components/admin/MaterialTabs";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { getMaterial, listMaterialCategories } from "@/lib/admin/material-repository";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function EditMaterialPage({ params, searchParams }: PageProps) {
  const user = await requireAdminSessionUser();
  const { id } = await params;
  const query = await searchParams;

  const [material, categories] = await Promise.all([getMaterial(id), listMaterialCategories()]);
  if (!material) notFound();

  return (
    <AdminShell user={user}>
      <MaterialTabs active="search" />
      <h2 style={{ margin: "0 0 6px" }}>{material.title}</h2>
      {query.msg === "saved" ? (
        <p style={{ margin: "0 0 14px", color: "#2f7d32", fontSize: 14 }}>已保存。</p>
      ) : null}
      <MaterialForm
        mode="edit"
        categories={categories.rows.map((row) => ({ id: row.id, name: row.name, slug: row.slug }))}
        initial={material}
      />
    </AdminShell>
  );
}
