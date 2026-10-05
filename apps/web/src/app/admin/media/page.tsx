import { AdminShell } from "@/components/admin/AdminShell";
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
        <h2 style={{ marginTop: 0 }}>图片视频库</h2>
        <p style={{ marginBottom: 0 }}>
          站内已上传的图片与视频，按时间从新到旧。点开可看大图或播放，并填写说明；弹窗里可以复制地址。
          文档与压缩包不在这里，它们跟着各自的资料走。
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
