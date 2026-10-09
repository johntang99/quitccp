import { Buffer } from "node:buffer";

/**
 * The repository, as somewhere the live site can read and write.
 *
 * 影片拼接台 keeps its projects in `projects/*.json`. On a laptop that is just
 * a folder, which is why the local page can list and save them with `fs`. On
 * Vercel there is no such folder -- the repository is not part of what gets
 * deployed -- so before this, an editor on the live site opened the page to an
 * empty project list and could do nothing at all.
 *
 * Reading and writing them through GitHub keeps one source of truth rather
 * than adding a second copy in a database that would immediately drift from
 * the one the command line reads. It also means 出片 needs nothing passed to
 * it: the workflow checks out the repository and the project is already there.
 *
 * Saving from the live site is a commit, so every version of a film is kept
 * and attributable, which a JSON blob in a table would not have been.
 */

const API = "https://api.github.com";

export interface GithubSetup {
  token: string;
  owner: string;
  repo: string;
  branch: string;
}

/** The workflow that renders. Must match the filename in .github/workflows. */
export const RENDER_WORKFLOW = "render-video.yml";

/**
 * Configuration, or null when this deployment has none.
 *
 * Null is a normal state, not an error: a laptop running the site renders
 * locally and never needs a token.
 */
export function githubSetup(): GithubSetup | null {
  const token = process.env.GITHUB_RENDER_TOKEN?.trim();
  const slug = process.env.GITHUB_RENDER_REPO?.trim();
  if (!token || !slug) return null;
  const [owner, repo] = slug.split("/");
  if (!owner || !repo) return null;
  return { token, owner, repo, branch: process.env.GITHUB_RENDER_BRANCH?.trim() || "main" };
}

async function gh(
  setup: GithubSetup,
  path: string,
  init: RequestInit & { expect?: number[] } = {}
): Promise<unknown> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${setup.token}`,
      "x-github-api-version": "2022-11-28",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers
    },
    cache: "no-store"
  });

  const ok = init.expect ?? [200, 201, 204];
  if (!ok.includes(response.status)) {
    const detail = await response.text();
    /* GitHub's own message is the useful part; the rest is a stack of URLs. */
    let message = detail.slice(0, 300);
    try {
      message = (JSON.parse(detail) as { message?: string }).message ?? message;
    } catch {
      /* not JSON -- keep the raw text */
    }
    throw new Error(`GitHub ${response.status}：${message}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

/** Names stay a single plain filename, the same rule the local store uses. */
function safeName(name: string): string {
  const clean = String(name ?? "").trim();
  if (!/^[A-Za-z0-9_-]+\.json$/.test(clean)) throw new Error("项目名不合法");
  return clean;
}

export async function listProjectsOnGithub(setup: GithubSetup): Promise<string[]> {
  const body = (await gh(setup, `/repos/${setup.owner}/${setup.repo}/contents/projects?ref=${setup.branch}`, {
    expect: [200, 404]
  })) as Array<{ name: string; type: string }> | null;
  if (!Array.isArray(body)) return [];
  return body
    .filter((entry) => entry.type === "file" && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();
}

export async function readProjectFromGithub(
  setup: GithubSetup,
  name: string
): Promise<{ data: unknown; sha: string } | null> {
  const file = safeName(name);
  const body = (await gh(setup, `/repos/${setup.owner}/${setup.repo}/contents/projects/${file}?ref=${setup.branch}`, {
    expect: [200, 404]
  })) as { content?: string; sha?: string } | null;
  if (!body?.content || !body.sha) return null;
  return { data: JSON.parse(Buffer.from(body.content, "base64").toString("utf8")), sha: body.sha };
}

/**
 * Write a project back as a commit.
 *
 * The blob's sha has to come with an update, which is GitHub's way of
 * refusing a write that was based on something stale -- two editors on the
 * same film get a clear conflict instead of one silently overwriting the
 * other. A missing sha means "create".
 */
export async function writeProjectToGithub(
  setup: GithubSetup,
  name: string,
  data: unknown,
  message: string
): Promise<void> {
  const file = safeName(name);
  const existing = await readProjectFromGithub(setup, file);
  await gh(setup, `/repos/${setup.owner}/${setup.repo}/contents/projects/${file}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: Buffer.from(`${JSON.stringify(data, null, 2)}\n`, "utf8").toString("base64"),
      branch: setup.branch,
      ...(existing ? { sha: existing.sha } : {})
    })
  });
}

export async function deleteProjectOnGithub(setup: GithubSetup, name: string, message: string): Promise<void> {
  const file = safeName(name);
  const existing = await readProjectFromGithub(setup, file);
  if (!existing) return;
  await gh(setup, `/repos/${setup.owner}/${setup.repo}/contents/projects/${file}`, {
    method: "DELETE",
    body: JSON.stringify({ message, sha: existing.sha, branch: setup.branch })
  });
}

export interface RenderRun {
  id: number;
  status: string;
  conclusion: string | null;
  url: string;
  startedAt: string;
}

/**
 * Start a render.
 *
 * A dispatch answers 204 with no body, so it cannot tell us which run it
 * started. The caller notes the time first and then looks for the newest run
 * created after it -- see `findRenderRun`.
 */
export async function dispatchRender(setup: GithubSetup, project: string, preview: boolean): Promise<void> {
  await gh(setup, `/repos/${setup.owner}/${setup.repo}/actions/workflows/${RENDER_WORKFLOW}/dispatches`, {
    method: "POST",
    expect: [204],
    body: JSON.stringify({
      ref: setup.branch,
      inputs: { project: safeName(project), preview: String(preview) }
    })
  });
}

export async function findRenderRun(setup: GithubSetup, since: Date): Promise<RenderRun | null> {
  const body = (await gh(
    setup,
    `/repos/${setup.owner}/${setup.repo}/actions/workflows/${RENDER_WORKFLOW}/runs?per_page=10&created=%3E%3D${since
      .toISOString()
      .slice(0, 19)}Z`
  )) as { workflow_runs?: Array<Record<string, unknown>> };

  const runs = body.workflow_runs ?? [];
  if (!runs.length) return null;
  const newest = runs[0];
  return {
    id: Number(newest.id),
    status: String(newest.status ?? ""),
    conclusion: (newest.conclusion as string) ?? null,
    url: String(newest.html_url ?? ""),
    startedAt: String(newest.created_at ?? "")
  };
}

export async function renderRunStatus(setup: GithubSetup, id: number): Promise<RenderRun> {
  const run = (await gh(setup, `/repos/${setup.owner}/${setup.repo}/actions/runs/${id}`)) as Record<string, unknown>;
  return {
    id: Number(run.id),
    status: String(run.status ?? ""),
    conclusion: (run.conclusion as string) ?? null,
    url: String(run.html_url ?? ""),
    startedAt: String(run.created_at ?? "")
  };
}
