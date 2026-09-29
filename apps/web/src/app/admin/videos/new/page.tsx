import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { VideoForm } from "@/components/admin/VideoForm";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { listVideoCategories } from "@/lib/admin/video-repository";

export default async function NewVideoPage() {
  const user = await requireAdminSessionUser();
  const categories = await listVideoCategories();

  return (
    <AdminShell user={user}>
      <section className="admin-card" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>新建视频</h2>
        <Link className="admin-btn" href="/admin/videos" style={{ marginLeft: "auto" }}>
          ← 返回列表
        </Link>
      </section>

      <VideoForm
        mode="new"
        categories={categories.map((category) => ({ name: category.name, slug: category.slug }))}
        initial={{
          slug: "",
          title: "",
          episode: "",
          description: "",
          bodyMarkdown: "",
          sourceUrl: "",
          backupUrl: "",
          coverImage: "",
          coverImageAlt: "",
          speaker: "",
          sourceCredit: "",
          legacyUrl: "",
          status: "published",
          publishedAt: new Date().toISOString(),
          category: ""
        }}
      />
    </AdminShell>
  );
}
