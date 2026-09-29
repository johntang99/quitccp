import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { VideoForm } from "@/components/admin/VideoForm";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { getVideo, listVideoCategories } from "@/lib/admin/video-repository";

export default async function EditVideoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdminSessionUser();
  const { id } = await params;
  const [video, categories] = await Promise.all([getVideo(id), listVideoCategories()]);
  if (!video) notFound();

  return (
    <AdminShell user={user}>
      <section className="admin-card" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>编辑视频</h2>
        <Link className="admin-btn" href="/admin/videos" style={{ marginLeft: "auto" }}>
          ← 返回列表
        </Link>
      </section>

      <VideoForm
        mode="edit"
        initial={video}
        categories={categories.map((category) => ({ name: category.name, slug: category.slug }))}
      />
    </AdminShell>
  );
}
