import { NextResponse } from "next/server";
import { guardMaterialWrite } from "@/lib/admin/material-guard";
import { runStudio, studioAvailable } from "@/lib/admin/studio";

/**
 * Looking at a source: resolve it, scan it, list its cuts, or sample frames.
 *
 * All four are read-only and quick enough to answer inline, so they share one
 * route rather than four near-identical files.
 */
export async function POST(request: Request) {
  const { error } = await guardMaterialWrite();
  if (error) return error;

  const ready = studioAvailable();
  if (!ready.ok) return NextResponse.json({ error: ready.reason }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    source?: string;
    every?: number;
    times?: number[];
  };
  const source = String(body.source ?? "").trim();
  if (!source) return NextResponse.json({ error: "没有给来源" }, { status: 400 });

  let args: string[];
  switch (body.action) {
    case "resolve":
      args = ["--resolve", source];
      break;
    case "scan":
      args = ["--scan", source, "--every", String(Math.max(2, Math.min(60, Number(body.every) || 8)))];
      break;
    case "cuts":
      args = ["--cuts", source];
      break;
    case "look": {
      const times = (body.times ?? []).filter((t) => Number.isFinite(t) && t >= 0).slice(0, 8);
      if (times.length === 0) return NextResponse.json({ error: "没有给时刻" }, { status: 400 });
      args = ["--look", source, ...times.map((t) => String(t))];
      break;
    }
    default:
      return NextResponse.json({ error: "不认识这个动作" }, { status: 400 });
  }

  const result = await runStudio(args, body.action === "cuts" ? 600000 : 240000);
  if (!result.ok) return NextResponse.json({ error: result.log || "没跑成" }, { status: 500 });
  return NextResponse.json(result.data);
}
