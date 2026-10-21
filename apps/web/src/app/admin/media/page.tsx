import { AdminShell } from "@/components/admin/AdminShell";
import { t } from "@/lib/i18n";
import { MediaLibrary } from "@/components/admin/MediaLibrary";
import { adminCanWrite, requireAdminSessionUser } from "@/lib/admin/auth";
import { listMediaPage } from "@/lib/admin/repository";

export default async function AdminMediaPage() {
  const user = await requireAdminSessionUser();
  // Both tabs' first page is fetched up front so switching between them is
  // instant; everything beyond that is loaded on demand.
  const [images, videos] = await Promise.all([
    listMediaPage(user.email, { type: "image", limit: 60 }),
    listMediaPage(user.email, { type: "video", limit: 60 })
  ]);

  return (
    <AdminShell user={user}>
      <section className="admin-card">
        <h2 style={{ marginTop: 0 }}>{t("admin.media.title")}</h2>
        <p style={{ marginBottom: 0 }}>
          {t("admin.media.intro")}
        </p>
      </section>
      <MediaLibrary
        initialRows={{ image: images.rows, video: videos.rows }}
        initialTotals={{ image: images.total, video: videos.total }}
        canWrite={adminCanWrite(user)}
      />
    </AdminShell>
  );
}
