import fs from "node:fs";
import { NextResponse } from "next/server";
import { guardMaterialWrite } from "@/lib/admin/material-guard";
import { resolveArtifact } from "@/lib/admin/studio";

/**
 * Serves one file out of `artifacts/` so the page can show contact sheets and
 * play back what was just cut.
 *
 * `resolveArtifact` refuses anything outside that folder, so a path from the
 * query string cannot reach the rest of the disk.
 */
const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4"
};

export async function GET(request: Request) {
  const { error } = await guardMaterialWrite();
  if (error) return error;

  const rel = new URL(request.url).searchParams.get("path") ?? "";
  const full = resolveArtifact(rel);
  if (!full) return NextResponse.json({ error: "找不到这个文件" }, { status: 404 });

  const ext = full.slice(full.lastIndexOf(".")).toLowerCase();
  const type = TYPES[ext];
  if (!type) return NextResponse.json({ error: "不支持这种文件" }, { status: 400 });

  return new NextResponse(new Uint8Array(fs.readFileSync(full)), {
    headers: { "content-type": type, "cache-control": "no-store" }
  });
}
