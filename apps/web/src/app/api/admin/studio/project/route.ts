import { NextResponse } from "next/server";
import { guardMaterialWrite } from "@/lib/admin/material-guard";
import {
  deleteProjectAnywhere,
  listProjectsAnywhere,
  readProjectAnywhere,
  renameProjectAnywhere,
  writeProjectAnywhere
} from "@/lib/admin/studio";

/** Reading and saving a project, without rendering it. */
export async function GET(request: Request) {
  const { error } = await guardMaterialWrite();
  if (error) return error;
  const name = new URL(request.url).searchParams.get("name");
  if (!name) return NextResponse.json({ projects: await listProjectsAnywhere() });
  const data = await readProjectAnywhere(name);
  if (!data) return NextResponse.json({ error: "没有这个项目" }, { status: 404 });
  return NextResponse.json({ name, project: data });
}

export async function POST(request: Request) {
  const { error, user } = await guardMaterialWrite();
  if (error) return error;
  const body = (await request.json().catch(() => ({}))) as { name?: string; project?: unknown };
  try {
    await writeProjectAnywhere(String(body.name ?? ""), body.project, user?.email ?? "admin");
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "存不下来" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, projects: await listProjectsAnywhere() });
}

/**
 * Renaming and deleting.
 *
 * Renaming is a move, not a copy. Saving under a new name used to leave the
 * old file sitting there, so the list filled up with near-identical projects
 * and nobody could tell which one was current.
 */
export async function PATCH(request: Request) {
  const { error, user } = await guardMaterialWrite();
  if (error) return error;
  const body = (await request.json().catch(() => ({}))) as { from?: string; to?: string };
  try {
    await renameProjectAnywhere(String(body.from ?? ""), String(body.to ?? ""), user?.email ?? "admin");
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "改名失败" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, projects: await listProjectsAnywhere() });
}

export async function DELETE(request: Request) {
  const { error, user } = await guardMaterialWrite();
  if (error) return error;
  const name = new URL(request.url).searchParams.get("name") ?? "";
  try {
    await deleteProjectAnywhere(name, user?.email ?? "admin");
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "删除失败" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, projects: await listProjectsAnywhere() });
}
