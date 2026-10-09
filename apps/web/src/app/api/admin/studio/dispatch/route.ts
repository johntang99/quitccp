import { NextResponse } from "next/server";
import { dispatchRender, findRenderRun, githubSetup, renderRunStatus } from "@/lib/admin/github";
import { guardMaterialWrite } from "@/lib/admin/material-guard";
import { listProjectsAnywhere } from "@/lib/admin/studio";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";

/**
 * 出片, on GitHub's machines rather than this one.
 *
 * The live site has no ffmpeg, so the render runs as a workflow. This route is
 * the button: it starts the run, and then answers "is it done yet" while the
 * page waits. The editor sees a progress line, not GitHub.
 *
 * POST  -> start a render, come back with the run to watch
 * GET   -> how is run <id> doing
 */

export async function POST(request: Request) {
  const { error } = await guardMaterialWrite();
  if (error) return error;

  const setup = githubSetup();
  if (!setup) {
    return NextResponse.json(
      { error: "这个站点没有配置 GitHub 出片（缺 GITHUB_RENDER_TOKEN / GITHUB_RENDER_REPO）。" },
      { status: 501 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as { name?: string; preview?: boolean };
  const name = String(body.name ?? "");

  /* Checked here rather than left to the runner: a typo should come back in a
     second, not as a failed workflow four minutes later. */
  const projects = await listProjectsAnywhere();
  if (!projects.includes(name)) {
    return NextResponse.json({ error: `仓库里没有「${name}」。先按「存项目」。` }, { status: 400 });
  }

  /* A dispatch answers 204 with no body, so the run has to be found by time.
     A minute back absorbs any clock difference between here and GitHub. */
  const since = new Date(Date.now() - 60_000);
  try {
    await dispatchRender(setup, name, Boolean(body.preview));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "起不来" }, { status: 502 });
  }

  /* The run takes a moment to exist. Not finding it is not a failure -- the
     page can keep asking -- so this answers either way. */
  let run = null;
  for (let attempt = 0; attempt < 6 && !run; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    try {
      run = await findRenderRun(setup, since);
    } catch {
      /* transient; keep trying */
    }
  }

  return NextResponse.json({ ok: true, run, since: since.toISOString() });
}

export async function GET(request: Request) {
  const { error } = await guardMaterialWrite();
  if (error) return error;

  const setup = githubSetup();
  if (!setup) return NextResponse.json({ error: "没有配置 GitHub 出片。" }, { status: 501 });

  const params = new URL(request.url).searchParams;
  const id = Number(params.get("run") ?? 0);

  try {
    if (id > 0) {
      const run = await renderRunStatus(setup, id);
      /* Once it is done, say *where* the film is. Sending someone off to
         图片视频库 to find it themselves is a worse answer than the address. */
      const files = run.conclusion === "success" ? await uploadedSince(run.startedAt) : [];
      return NextResponse.json({ run, files });
    }
    const since = params.get("since");
    const run = await findRenderRun(setup, since ? new Date(since) : new Date(Date.now() - 600_000));
    return NextResponse.json({ run });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "问不到" }, { status: 502 });
  }
}

/**
 * What the run uploaded, read back from the media library.
 *
 * The workflow writes the addresses into its own run summary, which the page
 * cannot read. The registry it writes to, it can -- so the films are found by
 * when they were registered rather than by parsing someone else's log.
 */
async function uploadedSince(startedAt: string): Promise<Array<{ name: string; url: string }>> {
  if (!startedAt) return [];
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("cms_media_assets")
      .select("name, storage_path, created_at")
      .eq("asset_type", "video")
      .gte("created_at", startedAt)
      .order("created_at", { ascending: false })
      .limit(6);
    return (data ?? []).map((row) => ({ name: String(row.name), url: String(row.storage_path) }));
  } catch {
    /* The render is what matters; not finding the rows must not look like a
       failed render. */
    return [];
  }
}
