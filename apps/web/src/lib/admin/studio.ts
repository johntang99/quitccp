import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Runs the 拼接台 CLI on behalf of the admin UI.
 *
 * The page does not re-implement any of the editing -- it drives
 * `scripts/video-studio.mjs --json`, the same script a person runs by hand.
 * One implementation means the UI and the command line can never disagree
 * about what a project file produces.
 *
 * ## It only works where ffmpeg is
 *
 * Rendering is ffmpeg, and ffmpeg is not on Vercel: no binary, and a 1080p cut
 * takes half a minute of several cores, which is not what a serverless function
 * is for. So these routes answer on a machine running the site locally and
 * refuse clearly anywhere else, rather than failing in a way that looks like a
 * bug.
 */

/** The monorepo root, found by walking up from wherever Next happens to run. */
export function repoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    if (fs.existsSync(path.join(dir, "scripts", "video-studio.mjs"))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return process.cwd();
}

export function studioAvailable(): { ok: boolean; reason: string } {
  if (process.env.VERCEL) {
    return { ok: false, reason: "线上（Vercel）没有 ffmpeg，剪片只能在本机跑着网站时使用。" };
  }
  if (!fs.existsSync(path.join(repoRoot(), "scripts", "video-studio.mjs"))) {
    return { ok: false, reason: "找不到 scripts/video-studio.mjs。" };
  }
  return { ok: true, reason: "" };
}

export interface StudioResult {
  ok: boolean;
  data: unknown;
  log: string;
}

/**
 * One CLI run.
 *
 * `--json` puts the result on stdout as a single object and leaves ffmpeg's own
 * chatter on stderr, so the two never get mixed up. stderr is kept and handed
 * back regardless, because when something fails that is the only thing that
 * explains why.
 */
export function runStudio(args: string[], timeoutMs = 600000): Promise<StudioResult> {
  const root = repoRoot();
  return new Promise((resolve) => {
    const child = spawn("node", [path.join("scripts", "video-studio.mjs"), ...args, "--json"], {
      cwd: root,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", (b) => {
      out += String(b);
    });
    child.stderr.on("data", (b) => {
      err += String(b);
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ ok: false, data: null, log: `起不来：${e.message}` });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        resolve({ ok: false, data: null, log: (err || out).trim().slice(-1500) });
        return;
      }
      try {
        resolve({ ok: true, data: JSON.parse(out.trim().split("\n").pop() ?? "{}"), log: err.trim().slice(-1500) });
      } catch {
        resolve({ ok: false, data: null, log: `读不懂输出：${out.trim().slice(-800)}` });
      }
    });
  });
}

/**
 * A file the studio produced, as something the browser can load.
 *
 * Contact sheets and renders live under `artifacts/`, which Next does not
 * serve. Rather than copying them into `public/`, the preview route streams
 * them -- and only from inside `artifacts/`, so a crafted path cannot read
 * the rest of the disk.
 */
export function resolveArtifact(relative: string): string | null {
  const root = repoRoot();
  const full = path.resolve(root, relative);
  const base = path.resolve(root, "artifacts");
  if (!full.startsWith(base + path.sep)) return null;
  if (!fs.existsSync(full)) return null;
  return full;
}

const PROJECTS = "projects";

export function listProjects(): string[] {
  const dir = path.join(repoRoot(), PROJECTS);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();
}

export function readProject(name: string): unknown {
  const file = projectPath(name);
  if (!file || !fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function writeProject(name: string, data: unknown): void {
  const file = projectPath(name);
  if (!file) throw new Error("项目名不合法");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

/** Names stay a single plain filename: no slashes, no walking out of projects/. */
function projectPath(name: string): string | null {
  const clean = String(name ?? "").trim();
  if (!clean || !/^[A-Za-z0-9_-]+\.json$/.test(clean)) return null;
  return path.join(repoRoot(), PROJECTS, clean);
}
