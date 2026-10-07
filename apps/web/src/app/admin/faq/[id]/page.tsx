import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { FaqForm } from "@/components/admin/FaqForm";
import { canBulkPublish, requireAdminSessionUser } from "@/lib/admin/auth";
import { getFaq, listFaqCategories } from "@/lib/admin/faq-repository";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function EditFaqPage({ params, searchParams }: PageProps) {
  const user = await requireAdminSessionUser();
  const { id } = await params;
  const query = await searchParams;

  const [faq, { rows: categories }] = await Promise.all([getFaq(id), listFaqCategories()]);
  if (!faq) notFound();

  return (
    <AdminShell user={user}>
      <h2 style={{ margin: "0 0 6px" }}>{faq.question}</h2>
      {query.msg === "saved" ? (
        <p style={{ margin: "0 0 14px", color: "#2f7d32", fontSize: 14 }}>已保存。</p>
      ) : null}
      {faq.legacyUrl ? (
        <p style={{ margin: "0 0 14px", color: "#777", fontSize: 13 }}>
          从老站导入：<code>{faq.legacyUrl}</code>
        </p>
      ) : null}
      <FaqForm faq={faq} categories={categories} canPublish={canBulkPublish(user)} />
    </AdminShell>
  );
}
