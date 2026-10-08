import { NextResponse } from "next/server";
import { guardMaterialWrite } from "@/lib/admin/material-guard";
import { runStudio, studioAvailable, writeProject } from "@/lib/admin/studio";

/**
 * Cutting the film.
 *
 * The project is written to disk first and then rendered from that file, so
 * what the UI shows and what a person would get running the command by hand
 * are the same thing -- and the project stays behind as the record of how the
 * film was made.
 *
 * A preview is a few seconds; a full 1080p cut is around half a minute and an
 * upload adds more, hence the generous ceiling.
 */
export async function POST(request: Request) {
  const { error } = await guardMaterialWrite();
  if (error) return error;

  const ready = studioAvailable();
  if (!ready.ok) return NextResponse.json({ error: ready.reason }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    project?: unknown;
    preview?: boolean;
    upload?: boolean;
  };
  const name = String(body.name ?? "").trim();
  if (!/^[A-Za-z0-9_-]+\.json$/.test(name)) {
    return NextResponse.json({ error: "项目名只能用英文、数字、- 和 _，并以 .json 结尾" }, { status: 400 });
  }
  const project = body.project as { clips?: unknown[] } | null;
  if (!project || !Array.isArray(project.clips) || project.clips.length === 0) {
    return NextResponse.json({ error: "片段是空的，没法出片" }, { status: 400 });
  }

  try {
    writeProject(name, project);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "项目存不下来" }, { status: 400 });
  }

  const args = [`projects/${name}`];
  if (body.preview) args.push("--preview");
  if (body.upload && !body.preview) args.push("--upload");

  const result = await runStudio(args, body.preview ? 300000 : 1800000);
  if (!result.ok) return NextResponse.json({ error: result.log || "出片失败" }, { status: 500 });
  return NextResponse.json(result.data);
}
