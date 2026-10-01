import { AdminShell } from "@/components/admin/AdminShell";
import { VideoForm } from "@/components/admin/VideoForm";
import { VideoTabs } from "@/components/admin/VideoTabs";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { listVideoCategories } from "@/lib/admin/video-repository";

export default async function NewVideoPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireAdminSessionUser();
  const categories = await listVideoCategories();
  // Why a save was refused comes back here rather than as a raw JSON page.
  const error = (await searchParams).error;

  return (
    <AdminShell user={user}>
      <VideoTabs active="new" />

      {error ? (
        <section className="admin-card" style={{ background: "#fdf1f0", borderColor: "#f2c9c4" }}>
          <strong style={{ color: "#b42318" }}>{error}</strong>
        </section>
      ) : null}


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
          category: "",
          featured: false,
          editorArchive: false
        }}
      />
    </AdminShell>
  );
}
