import { AdminShell } from "@/components/admin/AdminShell";
import { VideoStudio } from "@/components/admin/VideoStudio";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { githubSetup } from "@/lib/admin/github";
import { listProjectsAnywhere, studioAvailable } from "@/lib/admin/studio";

/**
 * 影片拼接台.
 *
 * Reads the project list and whether ffmpeg is reachable on the server, then
 * hands both to the client editor. Everything it can do is also one command at
 * a terminal -- this page exists so that making a short film is not a thing
 * only whoever knows the command can do.
 */
export const dynamic = "force-dynamic";

export default async function VideoStudioPage() {
  const user = await requireAdminSessionUser();
  const ready = studioAvailable();
  /* Projects come from the repository either way -- as files here, over the
     API on Vercel -- so the list is never empty just because ffmpeg is not. */
  const projects = await listProjectsAnywhere();
  /* Rendering has somewhere to happen if ffmpeg is here, or if GitHub is
     configured to do it for us. */
  const canRenderOnGithub = !ready.ok && Boolean(githubSetup());

  return (
    <AdminShell user={user}>
      <section className="admin-card" style={{ marginBottom: 14 }}>
        <h2 style={{ marginTop: 0 }}>影片拼接台</h2>
        <p style={{ margin: 0, lineHeight: 1.8 }}>
          把几段素材接起来、铺上音乐、出片。素材可以直接用干净世界的网址——
          只取要用的那几秒，不用先下整片。
        </p>
      </section>
      <VideoStudio
        projects={projects}
        available={ready.ok}
        unavailableReason={ready.reason}
        canRenderOnGithub={canRenderOnGithub}
      />
    </AdminShell>
  );
}
