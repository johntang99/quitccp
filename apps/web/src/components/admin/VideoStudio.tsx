"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ClipPlayer } from "./ClipPlayer";

/**
 * 影片拼接台 — the editing bench, as a page.
 *
 * The work it supports, in the order it actually happens: put a source in,
 * look through it for the moments worth using, collect those moments into a
 * running order, lay music under, watch a rough cut, then render and publish.
 *
 * It holds the same project shape the command line reads, and saves it to
 * `projects/*.json`. Nothing here is a parallel implementation -- every button
 * calls a route that runs `scripts/video-studio.mjs`, so a film made on this
 * page and one made at a terminal are the same film.
 *
 * Deliberately not a timeline with draggable blocks. Every cut here is "this
 * second to that second of that film", which a numbered list states more
 * precisely than pixels do, and which survives being read six months later.
 */

interface Clip {
  source: string;
  from: number;
  to: number;
  note?: string;
}

interface Project {
  output: { name: string; width: number; height: number; fps: number | string; crf: number; alsoWidth?: number; dir?: string; fade?: boolean };
  music?: { from: string; loop?: boolean; bpm?: number; lufs?: number; start?: number } | null;
  clips: Clip[];
  _?: unknown;
}

interface Shot {
  from: number;
  to: number;
  len: number;
}

/*
 * What a blank project starts as.
 *
 * `fps: "source"` keeps whatever the footage runs at. Forcing 25 on 29.97
 * sources drops five frames a second, which on a panning shot is the most
 * visible flaw a cut can have -- and it is free to avoid. crf 18 matches what
 * the clips are encoded at, so the join does not re-compress them.
 */
const EMPTY: Project = {
  output: { name: "new-video", width: 1920, height: 1080, fps: "source", crf: 18, alsoWidth: 1280, dir: "artifacts/hero", fade: false },
  music: null,
  clips: []
};

const fileUrl = (p: string) => `/api/admin/studio/file?path=${encodeURIComponent(p)}`;
const secs = (n: number) => `${n.toFixed(2)}s`;
const clock = (n: number) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;

export function VideoStudio({
  projects,
  available,
  unavailableReason,
  canRenderOnGithub
}: {
  projects: string[];
  available: boolean;
  unavailableReason: string;
  /** No ffmpeg here, but a workflow can do the render for us. */
  canRenderOnGithub: boolean;
}) {
  const [projectList, setProjectList] = useState(projects);
  const [name, setName] = useState(projects[0] ?? "new-video.json");
  /** What this project is called on disk right now -- 改名 needs the old name. */
  const [savedName, setSavedName] = useState(projects[0] ?? "");
  const [project, setProject] = useState<Project>(EMPTY);
  const [busy, setBusy] = useState("");
  const [problem, setProblem] = useState("");

  /* The source being looked through, and whatever we last learned about it. */
  const [source, setSource] = useState("");
  const [info, setInfo] = useState<{ stream: string; duration: number; size: string } | null>(null);
  const [sheet, setSheet] = useState<{ image: string; every: number } | null>(null);
  const [shots, setShots] = useState<Shot[] | null>(null);
  const [lookAt, setLookAt] = useState("");
  const [frames, setFrames] = useState<{ image: string; times: number[] } | null>(null);

  /** Per-row end-frames, so a clip can be checked where it sits. */
  const [rowFrames, setRowFrames] = useState<Record<number, string>>({});
  /** Which row has its player open. One at a time: a page of autoplaying
      videos is noise, and only one clip is ever being judged. */
  const [openRow, setOpenRow] = useState<number | null>(null);
  /** Percent while a music file uploads, 0 when idle. */
  const [musicBusy, setMusicBusy] = useState(0);
  /** What we measured about the chosen track: how long, and how fast. */
  const [musicInfo, setMusicInfo] = useState<import("@/lib/admin/bpm").MusicInfo | null>(null);
  const [musicCheck, setMusicCheck] = useState<"idle" | "busy" | "failed">("idle");
  /** The workflow run doing the rendering, while there is one. */
  const [run, setRun] = useState<{ id: number; status: string; conclusion: string | null; url: string } | null>(null);
  const [runStartedAt, setRunStartedAt] = useState(0);
  /** Whether the run in flight is a 360p sample, which never uploads. */
  const [runPreview, setRunPreview] = useState(false);
  /** Where the finished films ended up, once there are any. */
  const [runFiles, setRunFiles] = useState<Array<{ name: string; url: string }>>([]);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<{ files: string[]; duration: number; uploaded: Record<string, string> | null } | null>(null);
  const logRef = useRef<HTMLPreElement>(null);
  const [log, setLog] = useState("");

  const total = useMemo(
    () => project.clips.reduce((n, c) => n + Math.max(0, (Number(c.to) || 0) - (Number(c.from) || 0)), 0),
    [project.clips]
  );

  /*
   * Measuring the track as soon as there is one.
   *
   * BPM was a bare box asking for a number that an editor has no way to know
   * and no reason to have heard of. It is only ever needed when the music is
   * shorter than the film -- that is the only case where anything gets looped
   * -- so the page now works out both facts itself and fills the number in.
   *
   * Nothing here blocks: a failed measurement leaves the box typeable, which
   * is exactly where it started.
   */
  const musicFrom = project.music?.from ?? "";
  useEffect(() => {
    if (!musicFrom || !/^https?:\/\//i.test(musicFrom)) {
      setMusicInfo(null);
      setMusicCheck("idle");
      return;
    }
    const abort = new AbortController();
    let live = true;
    setMusicCheck("busy");
    setMusicInfo(null);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const { measureMusic } = await import("@/lib/admin/bpm");
          const info = await measureMusic(musicFrom, abort.signal);
          if (!live) return;
          setMusicInfo(info);
          setMusicCheck("idle");
          /* Only a tempo the track actually has gets written in. A vague
             answer from a piece with no steady pulse would be worse than the
             half-second fade the renderer falls back to. */
          if (info.confident) {
            setProject((p) => (p.music ? { ...p, music: { ...p.music, bpm: info.bpm } } : p));
          }
        } catch {
          if (live) setMusicCheck("failed");
        }
      })();
    }, 400);
    return () => {
      live = false;
      abort.abort();
      clearTimeout(timer);
    };
  }, [musicFrom]);

  /** Looping -- and therefore the tempo -- only matters when music runs out. */
  const musicLoops = musicInfo ? musicInfo.duration < total - 0.05 : true;

  /*
   * Rendering somewhere else.
   *
   * Where ffmpeg is missing the work goes to a GitHub workflow, which checks
   * out the repository -- the project was saved there a moment ago -- renders,
   * and uploads. Nothing about the film travels in the request; only its name.
   *
   * A dispatch cannot say which run it started, so the server finds it by
   * time and hands it back. From then on this polls.
   */
  const renderOnGithub = async (preview: boolean) => {
    setProblem("");
    setResult(null);
    setBusy(preview ? "正在叫 GitHub 出小样…" : "正在叫 GitHub 出片…");
    try {
      /* Save first, every time. The workflow renders what is in the
         repository, so an unsaved change would silently not be in the film. */
      const saved = await fetch("/api/admin/studio/project", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, project })
      });
      const savedData = await saved.json();
      if (!saved.ok) throw new Error(savedData.error ?? "存不下来");
      if (savedData.projects) setProjectList(savedData.projects);
      setSavedName(name);

      const response = await fetch("/api/admin/studio/dispatch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, preview })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "起不来");
      setRun(data.run ?? null);
      setRunPreview(preview);
      setRunFiles([]);
      setRunStartedAt(Date.now());
      setElapsed(0);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "起不来");
      setBusy("");
    }
  };

  /* Asking how it is going, every five seconds, until it stops. */
  useEffect(() => {
    if (!run || run.status === "completed") return;
    const tick = setInterval(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/admin/studio/dispatch?run=${run.id}`);
          const data = await response.json();
          if (data.run) setRun(data.run);
          if (Array.isArray(data.files) && data.files.length) setRunFiles(data.files);
        } catch {
          /* a dropped poll is not a failed render; the next one will tell us */
        }
      })();
    }, 5000);
    return () => clearInterval(tick);
  }, [run]);

  /* A clock, so a four-minute wait looks like progress and not a hang. */
  useEffect(() => {
    if (!runStartedAt || (run && run.status === "completed")) return;
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - runStartedAt) / 1000)), 1000);
    return () => clearInterval(tick);
  }, [runStartedAt, run]);

  /* When it finishes, stop saying "busy" and say what happened. */
  useEffect(() => {
    if (!run || run.status !== "completed") return;
    setBusy("");
    if (run.conclusion !== "success") {
      setProblem(`出片没成（${run.conclusion ?? "失败"}）。点下面的链接看 GitHub 上的日志。`);
    }
  }, [run]);

  useEffect(() => {
    if (projects[0]) void load(projects[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function call(url: string, body: unknown, label: string) {
    setBusy(label);
    setProblem("");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        setProblem(String(data.error ?? "没成"));
        setLog(String(data.error ?? ""));
        return null;
      }
      return data;
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "请求失败");
      return null;
    } finally {
      setBusy("");
    }
  }

  async function load(which: string) {
    const res = await fetch(`/api/admin/studio/project?name=${encodeURIComponent(which)}`);
    if (!res.ok) return;
    const data = await res.json();
    setName(which);
    setSavedName(which);
    setProject({ ...EMPTY, ...data.project, output: { ...EMPTY.output, ...(data.project?.output ?? {}) } });
    setResult(null);
    setRowFrames({});
  }

  async function save() {
    const data = await call("/api/admin/studio/project", { name, project }, "存盘");
    if (data?.projects) {
      setProjectList(data.projects);
      setSavedName(name);
    }
  }

  const patchOutput = (patch: Partial<Project["output"]>) =>
    setProject((p) => ({ ...p, output: { ...p.output, ...patch } }));

  const addClip = (clip: Clip) => setProject((p) => ({ ...p, clips: [...p.clips, clip] }));
  const patchClip = (i: number, patch: Partial<Clip>) => {
    setProject((p) => ({ ...p, clips: p.clips.map((c, n) => (n === i ? { ...c, ...patch } : c)) }));
    /* The frames showed the old in and out; leaving them up would say the clip
       is something it no longer is. */
    if ("from" in patch || "to" in patch || "source" in patch) {
      setRowFrames((m) => {
        if (!(i in m)) return m;
        const next = { ...m };
        delete next[i];
        return next;
      });
    }
  };
  const removeClip = (i: number) => {
    setProject((p) => ({ ...p, clips: p.clips.filter((_, n) => n !== i) }));
    setRowFrames({});
  };
  const moveClip = (i: number, by: number) => {
    setRowFrames({});
    setProject((p) => {
      const next = [...p.clips];
      const j = i + by;
      if (j < 0 || j >= next.length) return p;
      [next[i], next[j]] = [next[j], next[i]];
      return { ...p, clips: next };
    });
  };

  async function render(mode: "preview" | "full" | "upload") {
    setResult(null);
    setLog("");
    const data = await call(
      "/api/admin/studio/render",
      { name, project, preview: mode === "preview", upload: mode === "upload" },
      mode === "preview" ? "出小样…" : mode === "upload" ? "出片并上传…" : "出正式版…"
    );
    if (data) {
      setResult({ files: data.files ?? [], duration: data.duration ?? 0, uploaded: data.uploaded ?? null });
      // Rendering writes the project first, so it exists on disk now.
      setProjectList((list) => (list.includes(name) ? list : [...list, name].sort()));
      setSavedName(name);
    }
  }

  /*
   * ffmpeg decides what can be *rendered*, not what can be *edited*.
   *
   * Earlier this whole page refused when ffmpeg was missing, which meant the
   * live site could do nothing at all. But picking the moments -- the half of
   * the job that takes the time and the judgement -- is a video element and a
   * list of numbers. That works anywhere, so only the render controls are
   * gated now.
   */
  return (
    <>
      {!available ? (
        <section className="admin-card" style={{ marginBottom: 14, borderColor: "#f0dca0", background: "#fffbe9" }}>
          <strong style={{ color: "#6b5312" }}>这里可以排片子，但出不了片</strong>
          <p style={{ margin: "6px 0 0", color: "#6b5312", lineHeight: 1.8 }}>
            {unavailableReason}
            挑镜头、定秒数、排顺序、存项目，在这一页上都能做，存好之后
            在装了 ffmpeg 的电脑上打开同一页，选中这个项目按「出片并上传」就行。
          </p>
        </section>
      ) : null}
      {problem ? (
        <section className="admin-card" style={{ marginBottom: 14, borderColor: "#f0b4ac" }}>
          <strong style={{ color: "#b42318" }}>{problem}</strong>
        </section>
      ) : null}

      {/*
        ---- 项目 ----

        A project is one film: its clips, its music, its output settings.
        First on the page because it is first in the work -- every session
        starts by choosing which film is being cut, or starting a new one.
        It used to sit at the bottom, which read as an afterthought.

        `另存一份` also rewrites `output.name`. Without that, duplicating a
        project kept the original's output filename and rendering the copy
        quietly overwrote the first film's files -- a bug only noticed once the
        wrong video is already on the homepage.
      */}
      <section className="admin-card" style={{ marginTop: 14 }}>
        <h3 style={{ marginTop: 0 }}>1 · 选一个项目，或新建一个</h3>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 13, color: "#555" }}>当前</label>
          <select
            className="admin-input"
            style={{ width: 230 }}
            value={projectList.includes(name) ? name : "__unsaved__"}
            onChange={(e) => {
              if (e.target.value !== "__unsaved__") void load(e.target.value);
            }}
          >
            {projectList.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
            {projectList.includes(name) ? null : <option value="__unsaved__">{name}（还没存过）</option>}
          </select>
          <button
            className="admin-btn"
            type="button"
            title="清空，从头做一条新片子"
            onClick={() => {
              setProject(EMPTY);
              setResult(null);
              setRowFrames({});
              setOpenRow(null);
              setName("new-video.json");
            }}
          >
            新建空白
          </button>
          <button
            className="admin-btn admin-btn-danger"
            type="button"
            disabled={!projectList.includes(name) || Boolean(busy)}
            title="删掉这个项目文件。已经出过、上传过的片子不受影响"
            onClick={async () => {
              if (!window.confirm(`删掉项目「${name}」？\n已经出过、上传过的片子不受影响。`)) return;
              setBusy("删除中…");
              setProblem("");
              const res = await fetch(`/api/admin/studio/project?name=${encodeURIComponent(name)}`, { method: "DELETE" });
              const data = await res.json();
              setBusy("");
              if (!res.ok) {
                setProblem(String(data.error ?? "删不掉"));
                return;
              }
              setProjectList(data.projects);
              if (data.projects[0]) void load(data.projects[0]);
              else {
                setProject(EMPTY);
                setName("new-video.json");
              }
            }}
          >
            删除
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
          <label style={{ fontSize: 13, color: "#555" }}>名字</label>
          <input
            className="admin-input"
            style={{ width: 210 }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="hero-30s.json"
          />
          <button
            className="admin-btn"
            type="button"
            disabled={Boolean(busy) || !name.trim()}
            title="用这个名字另存一份，原来那个留着不动——想在旧片子基础上做新的就按它"
            onClick={async () => {
              const base = name.replace(/\.json$/, "");
              const copy = { ...project, output: { ...project.output, name: base } };
              setProject(copy);
              const data = await call("/api/admin/studio/project", { name, project: copy }, "另存一份…");
              if (data?.projects) {
                setProjectList(data.projects);
                /* The copy is now what is open. Without this, 改名 still
                   pointed at the project copied *from* and would rename the
                   original out from under it. */
                setSavedName(name);
              }
            }}
          >
            另存一份
          </button>
          <button
            className="admin-btn"
            type="button"
            disabled={Boolean(busy) || !projectList.includes(savedName) || name === savedName}
            title="把当前项目改成这个名字，不留旧的那份"
            onClick={async () => {
              setBusy("改名…");
              setProblem("");
              const res = await fetch("/api/admin/studio/project", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ from: savedName, to: name })
              });
              const data = await res.json();
              setBusy("");
              if (!res.ok) {
                setProblem(String(data.error ?? "改名失败"));
                return;
              }
              setProjectList(data.projects);
              setSavedName(name);
              /* Keep the films named after the project. 另存一份 already does
                 this; renaming leaving them behind was the inconsistency that
                 made the two names look unrelated. */
              setProject((p) => ({ ...p, output: { ...p.output, name: name.replace(/\.json$/, "") } }));
              void call(
                "/api/admin/studio/project",
                { name, project: { ...project, output: { ...project.output, name: name.replace(/\.json$/, "") } } },
                "存盘"
              );
            }}
          >
            改名
          </button>
        </div>

        <p className="muted" style={{ fontSize: 12, margin: "10px 0 0", lineHeight: 1.85 }}>
          一个项目就是一条片子：用哪些片段、配什么音乐、出多大。文件存在仓库的
          <code> projects/ </code>里，就是命令行读的那个——这一页和
          <code> node scripts/video-studio.mjs projects/xxx.json </code>出来的片子一模一样。
          <br />
          成片的文件名在上面「音乐与出片设置」里另设。<strong>另存一份</strong>会把它一起改成新名字，
          免得两个项目出的片子互相覆盖。
        </p>
      </section>

      {/* ---- 翻片子（可选，要 ffmpeg） ---- */}
      {available ? (
        <>
      <section className="admin-card" style={{ marginBottom: 14 }} id="studio-browse">
        <h3 style={{ marginTop: 0 }}>
          翻片子
          <span style={{ fontWeight: 400, fontSize: 13.5, color: "#777", marginLeft: 10 }}>
            可选 —— 不知道该取第几秒的时候用
          </span>
        </h3>
        <p className="muted" style={{ marginTop: 0, lineHeight: 1.75 }}>
          已经知道秒数的话，这一节可以跳过，直接到下面「播放顺序」里加段、把地址粘上就行。
          不确定的话，把片子放进来翻一翻：总览图看全片，切点列出它自己的镜头，也可以指定几秒单独看。
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            className="admin-input"
            style={{ flex: "1 1 460px", fontFamily: "ui-monospace, Menlo, monospace" }}
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="https://www.ganjingworld.com/embed/…"
          />
          <button
            className="admin-btn admin-btn-primary"
            type="button"
            disabled={!source.trim() || Boolean(busy)}
            onClick={async () => {
              const d = await call("/api/admin/studio/inspect", { action: "resolve", source }, "解析中…");
              if (d) {
                setInfo(d);
                setSheet(null);
                setShots(null);
                setFrames(null);
              }
            }}
          >
            认一下
          </button>
        </div>
        {info ? (
          <p style={{ margin: "10px 0 0", fontSize: 13, color: "#555", lineHeight: 1.8 }}>
            时长 <strong>{clock(info.duration)}</strong>（{info.duration.toFixed(1)}s）· 画面 <strong>{info.size}</strong>
            <span style={{ display: "block", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11.5, color: "#888", wordBreak: "break-all" }}>
              {info.stream}
            </span>
          </p>
        ) : null}
      </section>

      {/* ---- 2. 找镜头 ---- */}
      {info ? (
        <section className="admin-card" style={{ marginBottom: 14 }}>
          <h3 style={{ marginTop: 0 }}>在这条片子里找镜头</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button
              className="admin-btn"
              type="button"
              disabled={Boolean(busy)}
              onClick={async () => {
                const d = await call("/api/admin/studio/inspect", { action: "scan", source, every: 8 }, "出总览图…");
                if (d) setSheet(d);
              }}
            >
              总览图
            </button>
            <button
              className="admin-btn"
              type="button"
              disabled={Boolean(busy)}
              onClick={async () => {
                const d = await call("/api/admin/studio/inspect", { action: "cuts", source }, "找切点…（长片要等）");
                if (d) setShots(d.usable ?? []);
              }}
            >
              它自己的切点
            </button>
            <span style={{ flex: 1 }} />
            <input
              className="admin-input"
              style={{ width: 200 }}
              value={lookAt}
              onChange={(e) => setLookAt(e.target.value)}
              placeholder="看这几秒：28 30 40"
            />
            <button
              className="admin-btn"
              type="button"
              disabled={Boolean(busy) || !lookAt.trim()}
              onClick={async () => {
                const times = lookAt.split(/[\s,，]+/).map(Number).filter((n) => Number.isFinite(n) && n >= 0);
                const d = await call("/api/admin/studio/inspect", { action: "look", source, times }, "抽帧…");
                if (d) setFrames(d);
              }}
            >
              看看
            </button>
          </div>

          {sheet ? (
            <figure style={{ margin: "14px 0 0" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fileUrl(sheet.image)} alt="总览图" style={{ width: "100%", borderRadius: 4, border: "1px solid var(--rule, #ddd)" }} />
              <figcaption className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
                每 {sheet.every} 秒一帧，从 0 秒起，从左到右、从上到下。第 n 格 ≈ 第 {sheet.every}×(n−1) 秒。
              </figcaption>
            </figure>
          ) : null}

          {frames ? (
            <figure style={{ margin: "14px 0 0" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fileUrl(frames.image)} alt="抽帧" style={{ width: "100%", borderRadius: 4, border: "1px solid var(--rule, #ddd)" }} />
              <figcaption className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
                从左到右：{frames.times.join("s · ")}s
              </figcaption>
            </figure>
          ) : null}

          {shots ? (
            <div style={{ marginTop: 14 }}>
              <p style={{ margin: "0 0 8px", fontSize: 13, color: "#555" }}>
                这条片子自己的镜头里，够长可以整段拿来用的有 {shots.length} 个。点一下就加进下面的顺序里。
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                {shots.map((s) => (
                  <button
                    key={`${s.from}-${s.to}`}
                    className="admin-btn admin-btn-sm"
                    type="button"
                    onClick={() => addClip({ source, from: +s.from.toFixed(2), to: +s.to.toFixed(2), note: "" })}
                    title={`加进顺序：${s.from.toFixed(2)} → ${s.to.toFixed(2)}`}
                  >
                    {s.from.toFixed(1)}–{s.to.toFixed(1)} · {s.len.toFixed(1)}s
                  </button>
                ))}
              </div>
            </div>
          ) : null}

        </section>
      ) : null}
        </>
      ) : null}

      {/* ---- 3. 顺序 ---- */}
      <section className="admin-card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>
          2 · 播放顺序
          <span style={{ fontWeight: 400, fontSize: 14, color: "#777", marginLeft: 10 }}>
            {project.clips.length} 段，共 {total.toFixed(2)} 秒
          </span>
        </h3>
        <p className="muted" style={{ margin: "0 0 12px", lineHeight: 1.75 }}>
          每一段就是「某条片子的第几秒到第几秒」。地址直接粘在这一行里——
          干净世界的网址、.mp4 直链都行，<strong>不用上传</strong>。
          粘好之后点「看片定点」，片子就在这一行里放起来：拖到想要的那一帧，按「设为起点」「设为终点」。
          出片时只会去取用到的那几秒。
        </p>
        {project.clips.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            还没有片段。点下面的「＋ 加一段」，把地址粘进去、填上秒数。
          </p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {project.clips.map((c, i) => {
              const len = Math.max(0, (Number(c.to) || 0) - (Number(c.from) || 0));
              const shown = rowFrames[i];
              return (
                <div
                  key={i}
                  style={{
                    padding: "10px 12px",
                    border: "1px solid var(--rule, #e3e3e3)",
                    borderRadius: 6,
                    display: "grid",
                    gap: 8
                  }}
                >
                  {/* 第一行：这一段来自哪条片子 */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "28px minmax(0, 1fr) auto",
                      gap: 8,
                      alignItems: "center"
                    }}
                  >
                    <span style={{ color: "#888", fontVariantNumeric: "tabular-nums", fontSize: 15 }}>{i + 1}</span>
                    <input
                      className="admin-input"
                      style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}
                      value={c.source}
                      onChange={(e) => patchClip(i, { source: e.target.value })}
                      placeholder="https://www.ganjingworld.com/embed/…  或  artifacts/footage/xxx.mp4"
                    />
                    <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      <button
                        className={openRow === i ? "admin-btn admin-btn-sm admin-btn-primary" : "admin-btn admin-btn-sm"}
                        type="button"
                        title="打开播放器，看着画面定起点和终点"
                        disabled={!c.source.trim()}
                        onClick={() => setOpenRow(openRow === i ? null : i)}
                      >
                        {openRow === i ? "收起播放器" : "看片定点"}
                      </button>
                      {available ? (
                        <button
                          className="admin-btn admin-btn-sm"
                          type="button"
                          title="把这条片子拿到上面，翻总览图、找切点"
                          disabled={!c.source.trim() || Boolean(busy)}
                          onClick={async () => {
                            setSource(c.source);
                            const d = await call("/api/admin/studio/inspect", { action: "resolve", source: c.source }, "解析中…");
                            if (d) {
                              setInfo(d);
                              setSheet(null);
                              setShots(null);
                              setFrames(null);
                              document.getElementById("studio-browse")?.scrollIntoView({ behavior: "smooth" });
                            }
                          }}
                        >
                          拿到上面翻
                        </button>
                      ) : null}
                    </span>
                  </div>

                  {/* 第二行：取哪一段，叫什么 */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "28px 84px 84px 56px minmax(0, 1fr) auto",
                      gap: 8,
                      alignItems: "center"
                    }}
                  >
                    <span />
                    <input
                      className="admin-input"
                      value={c.from}
                      onChange={(e) => patchClip(i, { from: Number(e.target.value) })}
                      title="从第几秒"
                      placeholder="从"
                    />
                    <input
                      className="admin-input"
                      value={c.to}
                      onChange={(e) => patchClip(i, { to: Number(e.target.value) })}
                      title="到第几秒"
                      placeholder="到"
                    />
                    <span
                      style={{
                        fontSize: 12.5,
                        color: len > 0 ? "#555" : "#b42318",
                        fontVariantNumeric: "tabular-nums",
                        textAlign: "right"
                      }}
                    >
                      {secs(len)}
                    </span>
                    <input
                      className="admin-input"
                      value={c.note ?? ""}
                      onChange={(e) => patchClip(i, { note: e.target.value })}
                      placeholder="这段是什么（只给人看，不影响出片）"
                    />
                    <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {/* Checking the two ends is how you tell a clip is the shot you
                          meant without rendering the whole film. */}
                      <button
                        className="admin-btn admin-btn-sm"
                        type="button"
                        title="看这一段的头尾两帧"
                        style={{ display: available ? undefined : "none" }}
                        disabled={!c.source.trim() || len <= 0 || Boolean(busy)}
                        onClick={async () => {
                          const d = await call(
                            "/api/admin/studio/inspect",
                            { action: "look", source: c.source, times: [Number(c.from), Math.max(0, Number(c.to) - 0.2)] },
                            `看第 ${i + 1} 段…`
                          );
                          if (d) setRowFrames((m) => ({ ...m, [i]: d.image }));
                        }}
                      >
                        看头尾
                      </button>
                      <button className="admin-btn admin-btn-sm" type="button" onClick={() => moveClip(i, -1)} disabled={i === 0}>
                        ↑
                      </button>
                      <button
                        className="admin-btn admin-btn-sm"
                        type="button"
                        onClick={() => moveClip(i, 1)}
                        disabled={i === project.clips.length - 1}
                      >
                        ↓
                      </button>
                      <button className="admin-btn admin-btn-sm admin-btn-danger" type="button" onClick={() => removeClip(i)}>
                        删
                      </button>
                    </span>
                  </div>

                  {openRow === i && c.source.trim() ? (
                    <div style={{ display: "grid", gridTemplateColumns: "28px minmax(0, 1fr)", gap: 8 }}>
                      <span />
                      <ClipPlayer
                        source={c.source}
                        from={Number(c.from) || 0}
                        to={Number(c.to) || 0}
                        onSetFrom={(t) => patchClip(i, { from: t })}
                        onSetTo={(t) => patchClip(i, { to: t })}
                      />
                    </div>
                  ) : null}

                  {shown ? (
                    <div style={{ display: "grid", gridTemplateColumns: "28px minmax(0, 1fr)", gap: 8 }}>
                      <span />
                      <figure style={{ margin: 0 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={fileUrl(shown)}
                          alt={`第 ${i + 1} 段的头尾`}
                          style={{ width: "100%", maxWidth: 560, borderRadius: 4, border: "1px solid var(--rule, #ddd)" }}
                        />
                        <figcaption className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
                          左：第 {c.from} 秒（这段的开头）　右：第 {c.to} 秒（结尾）
                        </figcaption>
                      </figure>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <button
            className="admin-btn admin-btn-primary"
            type="button"
            onClick={() => addClip({ source: source || "", from: 0, to: 3, note: "" })}
          >
            ＋ 加一段
          </button>
        </div>
      </section>

      {/* ---- 4. 音乐与出片设置 ---- */}
      <section className="admin-card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>3 · 音乐与出片设置</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
              配乐（留空就没有声音）
            </label>
            <input
              className="admin-input"
              style={{ fontFamily: "ui-monospace, Menlo, monospace", width: "100%" }}
              value={project.music?.from ?? ""}
              onChange={(e) =>
                setProject((p) => ({
                  ...p,
                  music: e.target.value.trim() ? { loop: true, bpm: 115.4, lufs: -16, ...(p.music ?? {}), from: e.target.value } : null
                }))
              }
              placeholder="上传一个 mp3，或粘一个地址"
            />
            {/*
              Uploading is the answer to "where does music come from".

              The control is the file input itself, shown, not a styled button
              that forwards a click into a hidden one. Two versions of that
              trick failed here. The <label> wrapper fired the dialog several
              times per press -- the label activates the input, the input's
              click bubbles back to the label, round it goes -- and the
              button-plus-ref version could not be confirmed working at all,
              because the step that breaks is the operating system's dialog,
              which is the one step a browser automation tool never opens.

              A visible input has no forwarding step to break: the press lands
              on the control that opens the dialog. It is plainer than the
              buttons beside it, and that is the trade -- plain and working
              beats matching and unverifiable.
            */}
            <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="file"
                accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/ogg,video/mp4,video/webm,.mp3,.m4a,.wav,.ogg,.mp4,.webm"
                disabled={Boolean(musicBusy)}
                style={{ fontSize: 13, maxWidth: "100%" }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setProblem("");
                  setMusicBusy(1);
                  try {
                    const { uploadFile } = await import("@/lib/admin/upload-client");
                    const result = await uploadFile(file, {
                      folder: "home/music",
                      onProgress: (percent) => setMusicBusy(Math.max(1, percent))
                    });
                    setProject((p) => ({
                      ...p,
                      music: { loop: true, lufs: -16, ...(p.music ?? {}), from: result.url }
                    }));
                  } catch (err) {
                    setProblem(err instanceof Error ? err.message : "音乐上传失败");
                  } finally {
                    setMusicBusy(0);
                  }
                }}
              />
              {musicBusy ? (
                <strong style={{ fontSize: 13 }}>上传中 {musicBusy}%</strong>
              ) : null}
            </div>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 12, lineHeight: 1.7 }}>
              选一个 mp3 / m4a / wav / ogg，或者一个 mp4 / webm（只取声音，画面不要），最大 200MB。
              选完自动上传，上面地址栏会跟着变。也可以不上传，直接把现成的地址粘进上面那一栏。
            </p>
            {project.music?.from && /\.(mp4|webm|mov)(\?|$)/i.test(project.music.from) ? (
              <p style={{ margin: "6px 0 0", fontSize: 12, lineHeight: 1.7, color: "#6b5312", background: "#fffbe9", padding: "7px 9px", borderRadius: 4 }}>
                配乐来自一个<strong>视频</strong>文件——出片时只取它的声音，画面不要。
                这是正常用法：看到哪条片子音乐好听，直接传上来就行。
                现在用的是旧版 13 秒片头的声轨。
              </p>
            ) : null}
            <div style={{ display: "flex", gap: 10, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={Boolean(project.music?.loop)}
                  disabled={!project.music}
                  onChange={(e) => setProject((p) => (p.music ? { ...p, music: { ...p.music, loop: e.target.checked } } : p))}
                />
                music 比片子短时循环
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <span title="每分钟多少拍。只在曲子比片子短、需要循环时才用得上。">每分钟拍数</span>
                <input
                  className="admin-input"
                  style={{ width: 82 }}
                  value={project.music?.bpm ?? ""}
                  disabled={!project.music}
                  placeholder="自动"
                  onChange={(e) => setProject((p) => (p.music ? { ...p, music: { ...p.music, bpm: Number(e.target.value) } } : p))}
                />
              </label>
            </div>
            {/*
              Saying what was measured, and what it is for.

              The old copy explained BPM to someone who already knew what BPM
              was. These lines instead report what the page found out -- how
              long the track is, whether that means looping, and what tempo it
              is running at -- and only mention the number when it is going to
              be used for something.
            */}
            {project.music ? (
              <p style={{ margin: "6px 0 0", fontSize: 12.5, lineHeight: 1.75 }}>
                {musicCheck === "busy" ? <span className="muted">正在听这首曲子，量它多长、多快…</span> : null}
                {musicCheck === "failed" ? (
                  <span className="muted">
                    这首曲子没量成（地址打不开，或者文件太大）。不影响出片，循环接缝会用半秒淡接。
                  </span>
                ) : null}
                {musicInfo ? (
                  <>
                    曲子 <strong>{musicInfo.duration.toFixed(1)} 秒</strong>，片子 {total.toFixed(1)} 秒。
                    {musicLoops ? (
                      <>
                        {" "}曲子短，<strong>要循环接上</strong>——
                        {musicInfo.confident ? (
                          <>
                            量出来是每分钟 <strong>{musicInfo.bpm}</strong> 拍，已经替你填好了，
                            循环会按整拍剪、按一拍交叉淡接，接缝听不出来。
                          </>
                        ) : (
                          <>
                            这首曲子<strong>节拍不明显</strong>，没量准，所以
                            {project.music?.bpm
                              ? `没动你原来填的 ${project.music.bpm}。`
                              : "没替你填。"}
                            不填也能出片，接缝会用半秒淡接；听着别扭的话，自己填个数再试。
                          </>
                        )}
                      </>
                    ) : (
                      <> 曲子够长，<strong>不用循环</strong>，拍数填不填都一样。</>
                    )}
                  </>
                ) : null}
              </p>
            ) : null}
            <p className="muted" style={{ fontSize: 12, margin: "6px 0 0", lineHeight: 1.7 }}>
              音量会自动归一到 −16 LUFS，跟网站上其它视频一条线，不会忽大忽小。
            </p>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>成片文件名</label>
            <input className="admin-input" style={{ width: "100%" }} value={project.output.name} onChange={(e) => patchOutput({ name: e.target.value })} />
            {/*
              Spelling out the files this produces.

              The project file and the output name are two different names, and
              nothing on the page used to say so -- rename the project and the
              films keep the old name, silently. Showing the actual filenames
              makes the difference visible, and the nudge appears only when the
              two have drifted apart, because they are allowed to differ.
            */}
            <p
              className="muted"
              style={{ margin: "5px 0 0", fontSize: 11.5, lineHeight: 1.7, fontFamily: "ui-monospace, Menlo, monospace" }}
            >
              → {project.output.name || "（没填）"}-{project.output.width}.mp4
              {project.output.alsoWidth ? `　${project.output.name}-${project.output.alsoWidth}.mp4` : ""}
            </p>
            {project.output.name && project.output.name !== name.replace(/\.json$/, "") ? (
              <p style={{ margin: "6px 0 0", fontSize: 12, lineHeight: 1.7, color: "#6b5312", background: "#fffbe9", padding: "7px 9px", borderRadius: 4 }}>
                成片名和项目名不一样（项目叫 <strong>{name.replace(/\.json$/, "")}</strong>）。
                只有一个项目时没关系；<strong>但两个项目用同一个成片名，后出的会把先出的覆盖掉。</strong>
                <button
                  className="admin-btn admin-btn-sm"
                  type="button"
                  style={{ marginLeft: 8 }}
                  onClick={() => patchOutput({ name: name.replace(/\.json$/, "") })}
                >
                  改成和项目名一致
                </button>
              </p>
            ) : null}
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              {([["宽", "width"], ["高", "height"], ["帧率", "fps"]] as const).map(([label, key]) => (
                <label key={key} style={{ fontSize: 13 }}>
                  {label}
                  <input
                    className="admin-input"
                    style={{ width: 84, display: "block" }}
                    value={project.output[key]}
                    onChange={(e) => patchOutput({ [key]: Number(e.target.value) } as Partial<Project["output"]>)}
                  />
                </label>
              ))}
            </div>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 10, fontSize: 13, lineHeight: 1.7 }}>
              <input
                type="checkbox"
                checked={Boolean(project.output.fade)}
                onChange={(e) => patchOutput({ fade: e.target.checked })}
                style={{ marginTop: 3 }}
              />
              <span>
                首尾加黑场淡入淡出
                <span style={{ display: "block", color: "#777", fontSize: 12 }}>
                  首页片头是循环播的，别勾——每半分钟黑一下像是坏了。看一遍就停的片子才勾。
                </span>
              </span>
            </label>
          </div>
        </div>
      </section>

      {/*
        ---- 3. 存 / 出片 ----

        存项目 used to sit beside the render buttons as though it were a peer,
        which made it look like a step you had to do first. It is not: every
        render writes the project before it starts. The two are separated now,
        because they belong to two different people -- an editor on the live
        site saves and stops there, and whoever has ffmpeg renders.
      */}
      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>4 · 存起来，出片</h3>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button
            className={available ? "admin-btn" : "admin-btn admin-btn-primary"}
            type="button"
            disabled={Boolean(busy)}
            onClick={save}
          >
            存项目
          </button>
          <span className="muted" style={{ fontSize: 12.5 }}>
            {available
              ? "想先收工、回头再出片时按它。按下面三个出片按钮会自动存一次，不用先按这个。"
              : canRenderOnGithub
                ? "想先收工、回头再出片时按它。按下面的出片按钮会自动存一次，不用先按这个。"
                : "排好了就按它存下。出片要在装了 ffmpeg 的电脑上做。"}
          </span>
        </div>

        {available ? (
          <>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
                marginTop: 14,
                paddingTop: 14,
                borderTop: "1px solid var(--rule, #e3e3e3)"
              }}
            >
              <button className="admin-btn" type="button" disabled={Boolean(busy) || project.clips.length === 0} onClick={() => render("preview")}>
                出小样（快，360p）
              </button>
              <button className="admin-btn" type="button" disabled={Boolean(busy) || project.clips.length === 0} onClick={() => render("full")}>
                出正式版
              </button>
              <button
                className="admin-btn admin-btn-primary"
                type="button"
                disabled={Boolean(busy) || project.clips.length === 0}
                onClick={() => render("upload")}
              >
                出片并上传
              </button>
              {busy ? <strong style={{ color: "#4a3c96" }}>{busy}</strong> : null}
            </div>
            <p className="muted" style={{ fontSize: 12.5, margin: "10px 0 0", lineHeight: 1.8 }}>
              <strong>出小样</strong>：几秒钟，360p，只看剪得对不对——顺序、长短、音乐接得顺不顺。确认了再出正式版。<br />
              <strong>出正式版</strong>：1080p，约半分钟。只存在这台电脑上，网站还看不到。<br />
              <strong>出片并上传</strong>：出正式版，<strong>并且</strong>传到 Storage、登记进图片视频库。
              片子还不会自己上首页——要换，去「页面内容 → 首屏 Hero → 视频地址」把新地址粘上。
            </p>
          </>
        ) : canRenderOnGithub ? (
          /*
            No ffmpeg here, but a workflow has it.

            The same two choices as the local buttons -- a quick look, or the
            real thing -- except the machine is GitHub's and the wait is
            minutes rather than seconds, so the elapsed time is on screen and
            the run is linked for anyone who wants the log.
          */
          <>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
                marginTop: 14,
                paddingTop: 14,
                borderTop: "1px solid var(--rule, #e3e3e3)"
              }}
            >
              <button
                className="admin-btn"
                type="button"
                disabled={Boolean(busy) || project.clips.length === 0}
                onClick={() => void renderOnGithub(true)}
              >
                出小样（360p）
              </button>
              <button
                className="admin-btn admin-btn-primary"
                type="button"
                disabled={Boolean(busy) || project.clips.length === 0}
                onClick={() => void renderOnGithub(false)}
              >
                出片并上传
              </button>
              {busy ? <strong style={{ color: "#4a3c96" }}>{busy}</strong> : null}
            </div>

            {run ? (
              <div
                style={{
                  marginTop: 12,
                  padding: "10px 12px",
                  borderRadius: 4,
                  background: run.status === "completed" && run.conclusion === "success" ? "#f0fbf4" : "#f6f5fb",
                  border: `1px solid ${run.status === "completed" && run.conclusion === "success" ? "#bfe6cf" : "#d8d4ec"}`
                }}
              >
                {run.status === "completed" ? (
                  run.conclusion === "success" ? (
                    /* A sample and a real render end very differently: the
                       sample stops at 360p and is never uploaded, by design.
                       Saying otherwise sent someone to 图片视频库 to look for
                       a file that was never going to be there. */
                    runPreview ? (
                      <>
                        <strong style={{ color: "#1f7a4d" }}>小样出好了。</strong>
                        <p className="muted" style={{ margin: "6px 0 0", fontSize: 12.5, lineHeight: 1.8 }}>
                          用了 {Math.floor(elapsed / 60)} 分 {elapsed % 60} 秒。
                          <strong>小样没有上传</strong>——它只是 360p，用来看剪得对不对。
                          点下面的链接进 GitHub，在页面最下面的 Artifacts 里下载来看。
                          剪对了就按「出片并上传」出 1080p 正式版。
                        </p>
                      </>
                    ) : (
                      <>
                        <strong style={{ color: "#1f7a4d" }}>出好了，已经传上去并登记进图片视频库。</strong>
                        <p className="muted" style={{ margin: "6px 0 0", fontSize: 12.5, lineHeight: 1.8 }}>
                          用了 {Math.floor(elapsed / 60)} 分 {elapsed % 60} 秒。
                          片子不会自己上首页——要换，去「页面内容 → 首屏 Hero → 视频地址」把下面的地址粘上。
                        </p>
                        {runFiles.length ? (
                          <ul style={{ margin: "8px 0 0", paddingLeft: 0, listStyle: "none" }}>
                            {runFiles.map((f) => (
                              <li key={f.url} style={{ marginTop: 6 }}>
                                <strong style={{ fontSize: 12.5 }}>{f.name}</strong>
                                <input
                                  className="admin-input"
                                  readOnly
                                  value={f.url}
                                  onFocus={(e) => e.currentTarget.select()}
                                  style={{
                                    width: "100%",
                                    marginTop: 2,
                                    fontFamily: "ui-monospace, Menlo, monospace",
                                    fontSize: 11.5
                                  }}
                                />
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="muted" style={{ margin: "6px 0 0", fontSize: 12 }}>
                            地址在「图片视频库」里。
                          </p>
                        )}
                      </>
                    )
                  ) : (
                    <strong style={{ color: "#b42318" }}>没出成（{run.conclusion ?? "失败"}）。</strong>
                  )
                ) : (
                  <>
                    <strong style={{ color: "#4a3c96" }}>
                      GitHub 正在出片…… {Math.floor(elapsed / 60)} 分 {elapsed % 60} 秒
                    </strong>
                    <p className="muted" style={{ margin: "6px 0 0", fontSize: 12.5, lineHeight: 1.8 }}>
                      一般三到四分钟。这一页可以关掉，出好了会在「图片视频库」里。
                    </p>
                  </>
                )}
                {run.url ? (
                  <p style={{ margin: "6px 0 0", fontSize: 12 }}>
                    <a
                      href={run.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#4a3c96", textDecoration: "underline" }}
                    >
                      在 GitHub 上看这一次出片 ↗
                    </a>
                  </p>
                ) : null}
              </div>
            ) : null}

            <p className="muted" style={{ fontSize: 12.5, margin: "10px 0 0", lineHeight: 1.8 }}>
              这台机器没有 ffmpeg，所以出片交给 GitHub 跑——按下去会先存项目，再让它出片、上传。
              一次三到四分钟，比在装了 ffmpeg 的电脑上慢（那边约一分钟），但不用你装任何东西。
            </p>
          </>
        ) : (
          <p className="muted" style={{ fontSize: 12.5, margin: "12px 0 0", lineHeight: 1.8 }}>
            出片的三个按钮在这台机器上用不了，所以没有显示。存好项目后，
            在装了 ffmpeg 的电脑上打开这一页、在最下面选中这个项目，按钮就在了。
          </p>
        )}

        {result ? (
          <div style={{ marginTop: 14 }}>
            {result.files.filter((f) => f.endsWith(".mp4")).slice(0, 1).map((f) => (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video key={f} src={fileUrl(f)} controls style={{ width: "100%", maxWidth: 720, borderRadius: 6, background: "#111" }} />
            ))}
            <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.9 }}>
              {result.files.map((f) => (
                <li key={f} style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}>{f}</li>
              ))}
            </ul>
            {result.uploaded ? (
              <div style={{ marginTop: 10, padding: "10px 12px", background: "#f0fbf4", border: "1px solid #bfe6cf", borderRadius: 4 }}>
                <strong style={{ color: "#1f7a4d" }}>已上传并登记进图片视频库</strong>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {Object.entries(result.uploaded).map(([k, v]) => (
                    <li key={k} style={{ fontSize: 12, wordBreak: "break-all" }}>
                      <a href={v} target="_blank" rel="noreferrer">{v}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {log ? (
          <pre
            ref={logRef}
            style={{ marginTop: 12, maxHeight: 200, overflow: "auto", background: "#faf8f4", padding: 10, fontSize: 11.5, borderRadius: 4 }}
          >
            {log}
          </pre>
        ) : null}
      </section>

    </>
  );
}
