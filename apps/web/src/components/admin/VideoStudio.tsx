"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { tRich } from "@/lib/i18n/rich";
import { AspectRatioHelp } from "./AspectRatioHelp";
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
  output: {
    name: string;
    width: number;
    height: number;
    fps: number | string;
    crf: number;
    alsoWidth?: number;
    /** 裁哪一块：0 贴上 / 0.5 居中 / 1 贴下。见下面 CROPS 的说明。 */
    cropY?: number;
    /** 额外出的别的比例，目前只用来出手机方形版。 */
    also?: { width: number; height: number; name?: string }[];
    dir?: string;
    fade?: boolean;
  };
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
  /* 新项目默认就按首屏的规格来 —— 这个台子十有八九是为首屏开的。 */
  output: { name: "new-video", width: 1920, height: 816, cropY: 0.85, fps: "source", crf: 18, dir: "artifacts/hero", fade: false },
  music: null,
  clips: []
};

/**
 * 出片比例的几个预设。
 *
 * 以前这里是两个空白的宽高输入框，填什么都行、填错了也没人说。问题不在于
 * 编辑会填错数字，而在于那两个框**什么也没告诉他** —— 1920×1080 和
 * 1920×816 的区别不是两个数，是「谁来决定画面哪一块被砍掉」。
 *
 * 两条路最终被砍掉的像素一样多，因为首屏的框是按 2.35 排的：
 *
 * - 出 2.35：出片时切掉上下 24%，**编辑挑哪 24%**，而且出完就能看见。
 * - 出 16:9：出片时一个像素不少，但贴到首屏上浏览器照样切掉 24%，
 *   永远从正中间切，编辑在这个页面上看不出来 —— 而字幕恰恰在正中间往下。
 *
 * 所以 2.35 是推荐项，理由不是「画质好」，是「裁哪儿由你说了算」。
 */
const RATIOS = [
  {
    key: "235",
    label: "2.35:1",
    dims: "1920×816",
    width: 1920,
    height: 816,
    note: t("studio.ratio.235.note")
  },
  {
    key: "169",
    label: "16:9",
    dims: "1920×1080",
    width: 1920,
    height: 1080,
    note: t("studio.ratio.169.note")
  }
] as const;

/**
 * 裁切位置。
 *
 * 只有出 2.35 时才用得上 —— 出 16:9 时不裁，没什么可挑的。
 *
 * 默认「偏下」不是随便定的：2026-10-18 把现有素材抽帧量过，字幕压在
 * 距下边约 80px 的地方，而居中裁的下刀位置正好落在字上，会把
 * 「退出中共党 团 队声明的人数为115万4744人」从字的中间切断。偏下只切掉
 * 下边 40px、上边 224px，而上边那 224px 在六个采样帧里全是空天。
 */
const CROPS = [
  { key: "top", label: t("studio.crop.top"), value: 0.15, note: t("studio.crop.topNote") },
  { key: "center", label: t("studio.crop.center"), value: 0.5, note: t("studio.crop.centerNote") },
  { key: "bottom", label: t("studio.crop.bottom"), value: 0.85, note: t("studio.crop.bottomNote") }
] as const;

/** 手机版的规格：方形。首屏在手机上的框接近 1:1，方形放进去几乎不裁。 */
const MOBILE = { width: 1080, height: 1080 };

/** 预设按钮：选中的描金边，没选中的是普通边框。 */
const ratioBtn = (on: boolean): React.CSSProperties => ({
  textAlign: "left",
  padding: "8px 11px",
  borderRadius: 5,
  cursor: "pointer",
  minWidth: 168,
  font: "inherit",
  fontSize: 13,
  border: `1px solid ${on ? "#b8912f" : "var(--rule, #ddd)"}`,
  background: on ? "#fdf7e8" : "#fff",
  color: on ? "#6b5312" : "inherit"
});

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
  /* 手动展开宽高输入框。尺寸本来就不是预设里那两档时，下面会自己展开，
     不需要这个开关 —— 它只管「尺寸是预设、但我就是想改」那种情况。 */
  const [custom, setCustom] = useState(false);

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
    setBusy(t(preview ? "studio.busy.githubPreview" : "studio.busy.githubRender"));
    try {
      /* Save first, every time. The workflow renders what is in the
         repository, so an unsaved change would silently not be in the film. */
      const saved = await fetch("/api/admin/studio/project", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, project })
      });
      const savedData = await saved.json();
      if (!saved.ok) throw new Error(savedData.error ?? t("studio.err.cannotSave"));
      if (savedData.projects) setProjectList(savedData.projects);
      setSavedName(name);

      const response = await fetch("/api/admin/studio/dispatch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, preview })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? t("studio.err.cannotStart"));
      setRunPreview(preview);
      setRunFiles([]);
      setRunStartedAt(Date.now());
      setElapsed(0);
      /*
       * A dispatch that started nothing we can see.
       *
       * The server looks for the run by time and usually finds it within a few
       * seconds, but not always -- GitHub can be slow, or the month's Actions
       * minutes can be used up, in which case nothing ever starts. Leaving the
       * button spinning forever is the one answer that tells an editor
       * nothing, so say what happened and where to look.
       */
      if (!data.run) {
        setRun(null);
        setBusy("");
        setProblem(
          t("studio.err.runNotFound")
        );
        return;
      }
      setRun(data.run);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : t("studio.err.cannotStart"));
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
      setProblem(t("studio.err.renderFailed", { reason: run.conclusion ?? t("studio.label.failed") }));
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
        setProblem(String(data.error ?? t("studio.err.failed")));
        setLog(String(data.error ?? ""));
        return null;
      }
      return data;
    } catch (err) {
      setProblem(err instanceof Error ? err.message : t("studio.err.requestFailed"));
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
    const data = await call("/api/admin/studio/project", { name, project }, t("studio.busy.save"));
    if (data?.projects) {
      setProjectList(data.projects);
      setSavedName(name);
    }
  }

  const patchOutput = (patch: Partial<Project["output"]>) =>
    setProject((p) => ({ ...p, output: { ...p.output, ...patch } }));

  /* 当前尺寸是不是正好等于某个预设。不是的话，宽高框一直开着 —— 老项目是
     手填的数字，把它们藏起来等于让人看不见自己的片子要出多大。 */
  const presetMatched = RATIOS.some((r) => r.width === project.output.width && r.height === project.output.height);
  const mobileOn = (project.output.also ?? []).length > 0;

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
      t(mode === "preview" ? "studio.busy.preview" : mode === "upload" ? "studio.busy.upload" : "studio.busy.render")
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
          <strong style={{ color: "#6b5312" }}>{t("studio.noFfmpeg.title")}</strong>
          <p style={{ margin: "6px 0 0", color: "#6b5312", lineHeight: 1.8 }}>
            {unavailableReason}
            {t("studio.noFfmpeg.body")}
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
        <h3 style={{ marginTop: 0 }}>{t("studio.step1")}</h3>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 13, color: "#555" }}>{t("studio.current")}</label>
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
            {projectList.includes(name) ? null : <option value="__unsaved__">{t("studio.unsaved", { name })}</option>}
          </select>
          <button
            className="admin-btn"
            type="button"
            title={t("studio.newBlankTitle")}
            onClick={() => {
              setProject(EMPTY);
              setResult(null);
              setRowFrames({});
              setOpenRow(null);
              setName("new-video.json");
            }}
          >
            {t("studio.newBlank")}
          </button>
          <button
            className="admin-btn admin-btn-danger"
            type="button"
            disabled={!projectList.includes(name) || Boolean(busy)}
            title={t("studio.deleteTitle")}
            onClick={async () => {
              if (!window.confirm(t("studio.deleteConfirm", { name }))) return;
              setBusy(t("studio.busy.deleting"));
              setProblem("");
              const res = await fetch(`/api/admin/studio/project?name=${encodeURIComponent(name)}`, { method: "DELETE" });
              const data = await res.json();
              setBusy("");
              if (!res.ok) {
                setProblem(String(data.error ?? t("studio.err.cannotDelete")));
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
            {t("studio.delete")}
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
          <label style={{ fontSize: 13, color: "#555" }}>{t("studio.nameLabel")}</label>
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
            title={t("studio.saveAsTitle")}
            onClick={async () => {
              const base = name.replace(/\.json$/, "");
              const copy = { ...project, output: { ...project.output, name: base } };
              setProject(copy);
              const data = await call("/api/admin/studio/project", { name, project: copy }, t("studio.busy.saveAs"));
              if (data?.projects) {
                setProjectList(data.projects);
                /* The copy is now what is open. Without this, 改名 still
                   pointed at the project copied *from* and would rename the
                   original out from under it. */
                setSavedName(name);
              }
            }}
          >
            {t("studio.saveAs")}
          </button>
          <button
            className="admin-btn"
            type="button"
            disabled={Boolean(busy) || !projectList.includes(savedName) || name === savedName}
            title={t("studio.renameTitle")}
            onClick={async () => {
              setBusy(t("studio.busy.rename"));
              setProblem("");
              const res = await fetch("/api/admin/studio/project", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ from: savedName, to: name })
              });
              const data = await res.json();
              setBusy("");
              if (!res.ok) {
                setProblem(String(data.error ?? t("studio.err.renameFailed")));
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
            {t("studio.rename")}
          </button>
        </div>

        <p className="muted" style={{ fontSize: 12, margin: "10px 0 0", lineHeight: 1.85 }}>
          {tRich("studio.projectNote", {
            dir: <code> projects/ </code>,
            cmd: <code> node scripts/video-studio.mjs projects/xxx.json </code>
          })}
          <br />
          {tRich("studio.projectNote2", { saveAs: <strong>{t("studio.saveAs")}</strong> })}
        </p>
      </section>

      {/* ---- 翻片子（可选，要 ffmpeg） ---- */}
      {available ? (
        <>
      <section className="admin-card" style={{ marginBottom: 14 }} id="studio-browse">
        <h3 style={{ marginTop: 0 }}>
          {t("studio.browse")}
          <span style={{ fontWeight: 400, fontSize: 13.5, color: "#777", marginLeft: 10 }}>
            {t("studio.browseOptional")}
          </span>
        </h3>
        <p className="muted" style={{ marginTop: 0, lineHeight: 1.75 }}>
          {t("studio.browseNote")}
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
              const d = await call("/api/admin/studio/inspect", { action: "resolve", source }, t("studio.busy.resolving"));
              if (d) {
                setInfo(d);
                setSheet(null);
                setShots(null);
                setFrames(null);
              }
            }}
          >
            {t("studio.recognise")}
          </button>
        </div>
        {info ? (
          <p style={{ margin: "10px 0 0", fontSize: 13, color: "#555", lineHeight: 1.8 }}>
            {tRich("studio.durationSize", {
              duration: <strong>{clock(info.duration)}</strong>,
              seconds: info.duration.toFixed(1),
              size: <strong>{info.size}</strong>
            })}
            <span style={{ display: "block", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11.5, color: "#888", wordBreak: "break-all" }}>
              {info.stream}
            </span>
          </p>
        ) : null}
      </section>

      {/* ---- 2. 找镜头 ---- */}
      {info ? (
        <section className="admin-card" style={{ marginBottom: 14 }}>
          <h3 style={{ marginTop: 0 }}>{t("studio.step2")}</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button
              className="admin-btn"
              type="button"
              disabled={Boolean(busy)}
              onClick={async () => {
                const d = await call("/api/admin/studio/inspect", { action: "scan", source, every: 8 }, t("studio.busy.sheet"));
                if (d) setSheet(d);
              }}
            >
              {t("studio.sheet")}
            </button>
            <button
              className="admin-btn"
              type="button"
              disabled={Boolean(busy)}
              onClick={async () => {
                const d = await call("/api/admin/studio/inspect", { action: "cuts", source }, t("studio.busy.cuts"));
                if (d) setShots(d.usable ?? []);
              }}
            >
              {t("studio.ownCuts")}
            </button>
            <span style={{ flex: 1 }} />
            <input
              className="admin-input"
              style={{ width: 200 }}
              value={lookAt}
              onChange={(e) => setLookAt(e.target.value)}
              placeholder={t("studio.lookPlaceholder")}
            />
            <button
              className="admin-btn"
              type="button"
              disabled={Boolean(busy) || !lookAt.trim()}
              onClick={async () => {
                const times = lookAt.split(/[\s,，]+/).map(Number).filter((n) => Number.isFinite(n) && n >= 0);
                const d = await call("/api/admin/studio/inspect", { action: "look", source, times }, t("studio.busy.frames"));
                if (d) setFrames(d);
              }}
            >
              {t("studio.look")}
            </button>
          </div>

          {sheet ? (
            <figure style={{ margin: "14px 0 0" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fileUrl(sheet.image)} alt={t("studio.sheetAlt")} style={{ width: "100%", borderRadius: 4, border: "1px solid var(--rule, #ddd)" }} />
              <figcaption className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
                {t("studio.sheetNote", { every: sheet.every })}
              </figcaption>
            </figure>
          ) : null}

          {frames ? (
            <figure style={{ margin: "14px 0 0" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fileUrl(frames.image)} alt={t("studio.framesAlt")} style={{ width: "100%", borderRadius: 4, border: "1px solid var(--rule, #ddd)" }} />
              <figcaption className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
                {t("studio.framesNote", { times: frames.times.join("s · ") })}
              </figcaption>
            </figure>
          ) : null}

          {shots ? (
            <div style={{ marginTop: 14 }}>
              <p style={{ margin: "0 0 8px", fontSize: 13, color: "#555" }}>
                {t("studio.shotsNote", { n: shots.length })}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                {shots.map((s) => (
                  <button
                    key={`${s.from}-${s.to}`}
                    className="admin-btn admin-btn-sm"
                    type="button"
                    onClick={() => addClip({ source, from: +s.from.toFixed(2), to: +s.to.toFixed(2), note: "" })}
                    title={t("studio.addShotTitle", { from: s.from.toFixed(2), to: s.to.toFixed(2) })}
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
          {t("studio.step3")}
          <span style={{ fontWeight: 400, fontSize: 14, color: "#777", marginLeft: 10 }}>
            {t("studio.clipCount", { n: project.clips.length, seconds: total.toFixed(2) })}
          </span>
        </h3>
        <p className="muted" style={{ margin: "0 0 12px", lineHeight: 1.75 }}>
          {tRich("studio.sequenceNote", {
            noUpload: <strong>{t("studio.sequenceNoteNoUpload")}</strong>
          })}
        </p>
        {project.clips.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {t("studio.noClips")}
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
                      placeholder={t("studio.sourcePlaceholder")}
                    />
                    <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      <button
                        className={openRow === i ? "admin-btn admin-btn-sm admin-btn-primary" : "admin-btn admin-btn-sm"}
                        type="button"
                        title={t("studio.playerTitle")}
                        disabled={!c.source.trim()}
                        onClick={() => setOpenRow(openRow === i ? null : i)}
                      >
                        {t(openRow === i ? "studio.playerClose" : "studio.playerOpen")}
                      </button>
                      {available ? (
                        <button
                          className="admin-btn admin-btn-sm"
                          type="button"
                          title={t("studio.toTopTitle")}
                          disabled={!c.source.trim() || Boolean(busy)}
                          onClick={async () => {
                            setSource(c.source);
                            const d = await call("/api/admin/studio/inspect", { action: "resolve", source: c.source }, t("studio.busy.resolving"));
                            if (d) {
                              setInfo(d);
                              setSheet(null);
                              setShots(null);
                              setFrames(null);
                              document.getElementById("studio-browse")?.scrollIntoView({ behavior: "smooth" });
                            }
                          }}
                        >
                          {t("studio.toTop")}
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
                      title={t("studio.fromTitle")}
                      placeholder={t("studio.from")}
                    />
                    <input
                      className="admin-input"
                      value={c.to}
                      onChange={(e) => patchClip(i, { to: Number(e.target.value) })}
                      title={t("studio.toTitle")}
                      placeholder={t("studio.to")}
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
                      placeholder={t("studio.clipLabelPlaceholder")}
                    />
                    <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {/* Checking the two ends is how you tell a clip is the shot you
                          meant without rendering the whole film. */}
                      <button
                        className="admin-btn admin-btn-sm"
                        type="button"
                        title={t("studio.endsTitle")}
                        style={{ display: available ? undefined : "none" }}
                        disabled={!c.source.trim() || len <= 0 || Boolean(busy)}
                        onClick={async () => {
                          const d = await call(
                            "/api/admin/studio/inspect",
                            { action: "look", source: c.source, times: [Number(c.from), Math.max(0, Number(c.to) - 0.2)] },
                            t("studio.busy.lookClip", { n: i + 1 })
                          );
                          if (d) setRowFrames((m) => ({ ...m, [i]: d.image }));
                        }}
                      >
                        {t("studio.ends")}
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
                        {t("studio.removeClip")}
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
                          alt={t("studio.endsAlt", { n: i + 1 })}
                          style={{ width: "100%", maxWidth: 560, borderRadius: 4, border: "1px solid var(--rule, #ddd)" }}
                        />
                        <figcaption className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
                          {t("studio.endsNote", { from: c.from, to: c.to })}
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
            {t("studio.addClip")}
          </button>
        </div>
      </section>

      {/* ---- 4. 音乐与出片设置 ---- */}
      <section className="admin-card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>{t("studio.step4")}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
              {t("studio.music")}
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
              placeholder={t("studio.musicPlaceholder")}
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
                    setProblem(err instanceof Error ? err.message : t("studio.err.musicUpload"));
                  } finally {
                    setMusicBusy(0);
                  }
                }}
              />
              {musicBusy ? (
                <strong style={{ fontSize: 13 }}>{t("studio.musicUploading", { n: musicBusy })}</strong>
              ) : null}
            </div>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 12, lineHeight: 1.7 }}>
              {t("studio.musicPickNote")}
            </p>
            {project.music?.from && /\.(mp4|webm|mov)(\?|$)/i.test(project.music.from) ? (
              <p style={{ margin: "6px 0 0", fontSize: 12, lineHeight: 1.7, color: "#6b5312", background: "#fffbe9", padding: "7px 9px", borderRadius: 4 }}>
                {tRich("studio.musicFromVideo", {
                  video: <strong>{t("studio.musicFromVideoWord")}</strong>
                })}
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
                {t("studio.loopMusic")}
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <span title={t("studio.bpmTitle")}>{t("studio.bpm")}</span>
                <input
                  className="admin-input"
                  style={{ width: 82 }}
                  value={project.music?.bpm ?? ""}
                  disabled={!project.music}
                  placeholder={t("studio.bpmAuto")}
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
                {musicCheck === "busy" ? <span className="muted">{t("studio.musicMeasuring")}</span> : null}
                {musicCheck === "failed" ? (
                  <span className="muted">
                    {t("studio.musicUnmeasured")}
                  </span>
                ) : null}
                {musicInfo ? (
                  <>
                    {tRich("studio.musicLengths", {
                      music: <strong>{musicInfo.duration.toFixed(1)}s</strong>,
                      film: total.toFixed(1)
                    })}
                    {musicLoops ? (
                      <>
                        {tRich("studio.musicShort", {
                          needLoop: <strong>{t("studio.musicShortNeedLoop")}</strong>
                        })}
                        {musicInfo.confident ? (
                          <>
                            {tRich("studio.musicBpmFound", { bpm: <strong>{musicInfo.bpm}</strong> })}
                          </>
                        ) : (
                          <>
                            {tRich("studio.musicBpmWeak", {
                              weak: <strong>{t("studio.musicBpmWeakWord")}</strong>,
                              kept: project.music?.bpm
                                ? t("studio.musicBpmKept", { bpm: project.music.bpm })
                                : t("studio.musicBpmNotFilled")
                            })}
                          </>
                        )}
                      </>
                    ) : (
                      tRich("studio.musicLongEnough", {
                        noLoop: <strong>{t("studio.musicLongEnoughNoLoop")}</strong>
                      })
                    )}
                  </>
                ) : null}
              </p>
            ) : null}
            <p className="muted" style={{ fontSize: 12, margin: "6px 0 0", lineHeight: 1.7 }}>
              {t("studio.loudnessNote")}
            </p>
            {/*
              Saying what the numbers cost.

              These defaults used to be 1920 at CRF 18, which produced a 19.3MB
              film for a thirty-second muted loop -- six times what the 首屏
              Hero editor itself advises, and every visitor downloads it. The
              quality was being bought with somebody else's bandwidth, and
              nothing on this page said so.
            */}
            <p className="muted" style={{ fontSize: 12, margin: "6px 0 0", lineHeight: 1.7 }}>
              {tRich("studio.resolutionNote", { cap: <strong>{t("studio.resolutionCap")}</strong> })}
            </p>
            {/*
              文件大小只能给实测值，不能给公式。

              这里原来写「1920 + 画质 18 约 19MB」，是拿某一支片子量出来的，然后
              被当成了通则。2026-10-18 实测的两支 31 秒成片：16:9 那支 11MB，
              2.35 那支 9MB —— 差得远。同样的分辨率和画质，画面动得厉害的片子
              可以是静片的好几倍。给一个范围并说清楚它取决于什么，比给一个看着
              精确的假数字有用。
            */}
            <p className="muted" style={{ fontSize: 12, margin: "6px 0 0", lineHeight: 1.7 }}>
              {tRich("studio.sizeNote", {
                what: <strong>{t("studio.sizeNoteWhat")}</strong>,
                range: <strong>{t("studio.sizeNoteRange")}</strong>
              })}
            </p>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>{t("studio.outputName")}</label>
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
              → {project.output.name || t("studio.outputNameEmpty")}-{project.output.width}.mp4
              {project.output.alsoWidth ? `　${project.output.name}-${project.output.alsoWidth}.mp4` : ""}
              {mobileOn
                ? `　${project.output.name}-${MOBILE.width}x${MOBILE.height}.mp4`
                : ""}
            </p>
            {project.output.name && project.output.name !== name.replace(/\.json$/, "") ? (
              <p style={{ margin: "6px 0 0", fontSize: 12, lineHeight: 1.7, color: "#6b5312", background: "#fffbe9", padding: "7px 9px", borderRadius: 4 }}>
                {tRich("studio.outputNameMismatch", {
                  project: <strong>{name.replace(/\.json$/, "")}</strong>,
                  warn: <strong>{t("studio.outputNameMismatchWarn")}</strong>
                })}
                <button
                  className="admin-btn admin-btn-sm"
                  type="button"
                  style={{ marginLeft: 8 }}
                  onClick={() => patchOutput({ name: name.replace(/\.json$/, "") })}
                >
                  {t("studio.outputNameFix")}
                </button>
              </p>
            ) : null}
            <div style={{ marginTop: 12 }}>
              <span style={{ display: "block", fontSize: 13, marginBottom: 5 }}>
                {t("studio.ratioLabel")}
                <AspectRatioHelp />
              </span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {RATIOS.map((r) => {
                  /* 三个按钮是单选关系。`自定义` 一旦选中，哪怕尺寸正好还等于某个
                     预设，那个预设也不该亮着 —— 不然两个一起高亮，看不出当前到底
                     是哪一种。 */
                  const on = !custom && project.output.width === r.width && project.output.height === r.height;
                  return (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => {
                        setCustom(false);
                        patchOutput({
                          width: r.width,
                          height: r.height,
                          /* 切到要裁的比例、而这个项目还没选过裁哪儿时，直接落在
                             推荐值上。不这么做的话 cropY 是空的，下面会显示成
                             「居中」—— 偏偏那个值会把字幕从中间切断。推荐项应该
                             是你什么都不做就踩到的那个，不是要再点一下才有的。 */
                          ...(r.height < r.width / 1.9 && project.output.cropY === undefined
                            ? { cropY: 0.85 }
                            : {})
                        });
                      }}
                      style={ratioBtn(on)}
                    >
                      <span style={{ fontWeight: 600 }}>
                        {r.label}
                        <span style={{ fontWeight: 400, opacity: 0.6, marginLeft: 6, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}>
                          {r.dims}
                        </span>
                      </span>
                      <span style={{ display: "block", fontSize: 11.5, opacity: 0.75, marginTop: 3, lineHeight: 1.5 }}>{r.note}</span>
                    </button>
                  );
                })}
                {/* 只负责选中，不做开关 —— 单选组里点第二下把自己关掉，会落到
                    「一个都没选」那种没有意义的状态。要离开自定义，点某个预设。 */}
                <button type="button" onClick={() => setCustom(true)} style={ratioBtn(custom || !presetMatched)}>
                  <span style={{ fontWeight: 600 }}>{t("studio.custom")}</span>
                  <span style={{ display: "block", fontSize: 11.5, opacity: 0.75, marginTop: 3, lineHeight: 1.5 }}>
                    {t("studio.customNote")}
                  </span>
                </button>
              </div>
            </div>

            {custom || !presetMatched ? (
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {(
                  [
                    [t("studio.width"), "width"],
                    [t("studio.height"), "height"]
                  ] as const
                ).map(([label, key]) => (
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
            ) : null}

            {/* 出 16:9 时不裁，没什么可挑的；只有裁了才问裁哪儿。 */}
            {project.output.height < project.output.width / 1.9 ? (
              <div style={{ marginTop: 12 }}>
                <span style={{ display: "block", fontSize: 13, marginBottom: 5 }}>
                  {t("studio.cropLabel")}
                  <span style={{ color: "#777", fontSize: 12, marginLeft: 6 }}>{t("studio.cropHint")}</span>
                </span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {CROPS.map((c) => {
                    const on = (project.output.cropY ?? 0.5) === c.value;
                    return (
                      <button key={c.key} type="button" onClick={() => patchOutput({ cropY: c.value })} style={ratioBtn(on)}>
                        <span style={{ fontWeight: 600 }}>{c.label}</span>
                        <span style={{ display: "block", fontSize: 11.5, opacity: 0.75, marginTop: 3, lineHeight: 1.5 }}>{c.note}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="muted" style={{ fontSize: 12, margin: "6px 0 0", lineHeight: 1.7 }}>
                  {t("studio.cropAdvice")}
                </p>
              </div>
            ) : null}

            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 12, fontSize: 13, lineHeight: 1.7 }}>
              <input
                type="checkbox"
                checked={(project.output.also ?? []).length > 0}
                onChange={(e) => patchOutput({ also: e.target.checked ? [{ ...MOBILE }] : [] })}
                style={{ marginTop: 3 }}
              />
              <span>
                {t("studio.alsoSquare", { w: MOBILE.width, h: MOBILE.height })}
                <span style={{ display: "block", color: "#777", fontSize: 12 }}>
                  {tRich("studio.alsoSquareNote", {
                    warn: <strong>{t("studio.alsoSquareWarn")}</strong>
                  })}
                </span>
              </span>
            </label>

            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <label style={{ fontSize: 13 }}>
                {t("studio.fps")}
                <input
                  className="admin-input"
                  style={{ width: 84, display: "block" }}
                  value={project.output.fps}
                  onChange={(e) => patchOutput({ fps: e.target.value })}
                />
              </label>
            </div>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 10, fontSize: 13, lineHeight: 1.7 }}>
              <input
                type="checkbox"
                checked={Boolean(project.output.fade)}
                onChange={(e) => patchOutput({ fade: e.target.checked })}
                style={{ marginTop: 3 }}
              />
              <span>
                {t("studio.fade")}
                <span style={{ display: "block", color: "#777", fontSize: 12 }}>
                  {t("studio.fadeNote")}
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
        <h3 style={{ marginTop: 0 }}>{t("studio.step5")}</h3>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button
            className={available ? "admin-btn" : "admin-btn admin-btn-primary"}
            type="button"
            disabled={Boolean(busy)}
            onClick={save}
          >
            {t("studio.saveProject")}
          </button>
          <span className="muted" style={{ fontSize: 12.5 }}>
            {available
              ? t("studio.saveHintGithub")
              : canRenderOnGithub
                ? t("studio.saveHintLocal")
                : t("studio.saveHintNoFfmpeg")}
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
                {t("studio.renderPreview")}
              </button>
              <button className="admin-btn" type="button" disabled={Boolean(busy) || project.clips.length === 0} onClick={() => render("full")}>
                {t("studio.renderFinal")}
              </button>
              <button
                className="admin-btn admin-btn-primary"
                type="button"
                disabled={Boolean(busy) || project.clips.length === 0}
                onClick={() => render("upload")}
              >
                {t("studio.renderUpload")}
              </button>
              {busy ? <strong style={{ color: "#4a3c96" }}>{busy}</strong> : null}
            </div>
            <p className="muted" style={{ fontSize: 12.5, margin: "10px 0 0", lineHeight: 1.8 }}>
              {tRich("studio.renderNote", { preview: <strong>{t("studio.renderPreviewName")}</strong> })}
              <br />
              {tRich("studio.renderNoteFinal", { final: <strong>{t("studio.renderFinal")}</strong> })}
              <br />
              {tRich("studio.renderNoteUpload", {
                upload: <strong>{t("studio.renderUpload")}</strong>,
                and: <strong>{t("studio.renderNoteUploadAnd")}</strong>
              })}
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
                {t("studio.renderPreviewShort")}
              </button>
              <button
                className="admin-btn admin-btn-primary"
                type="button"
                disabled={Boolean(busy) || project.clips.length === 0}
                onClick={() => void renderOnGithub(false)}
              >
                {t("studio.renderUpload")}
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
                        <strong style={{ color: "#1f7a4d" }}>{t("studio.previewDone")}</strong>
                        <p className="muted" style={{ margin: "6px 0 0", fontSize: 12.5, lineHeight: 1.8 }}>
                          {t("studio.elapsed", { m: Math.floor(elapsed / 60), s: elapsed % 60 })}
                          {tRich("studio.previewNotUploaded", {
                            notUploaded: <strong>{t("studio.previewNotUploadedStrong")}</strong>
                          })}
                        </p>
                      </>
                    ) : (
                      <>
                        <strong style={{ color: "#1f7a4d" }}>{t("studio.uploadDone")}</strong>
                        <p className="muted" style={{ margin: "6px 0 0", fontSize: 12.5, lineHeight: 1.8 }}>
                          {t("studio.elapsed", { m: Math.floor(elapsed / 60), s: elapsed % 60 })}
                          {t("studio.uploadDoneNote")}
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
                            {t("studio.addressInLibrary")}
                          </p>
                        )}
                      </>
                    )
                  ) : (
                    <strong style={{ color: "#b42318" }}>
                      {t("studio.renderFailedTitle", { reason: run.conclusion ?? t("studio.label.failed") })}
                    </strong>
                  )
                ) : (
                  <>
                    <strong style={{ color: "#4a3c96" }}>
                      {t("studio.rendering", { m: Math.floor(elapsed / 60), s: elapsed % 60 })}
                    </strong>
                    <p className="muted" style={{ margin: "6px 0 0", fontSize: 12.5, lineHeight: 1.8 }}>
                      {t("studio.renderingNote")}
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
                      {t("studio.viewOnGithub")}
                    </a>
                  </p>
                ) : null}
              </div>
            ) : null}

            <p className="muted" style={{ fontSize: 12.5, margin: "10px 0 0", lineHeight: 1.8 }}>
              {t("studio.githubNote")}
            </p>
          </>
        ) : (
          <p className="muted" style={{ fontSize: 12.5, margin: "12px 0 0", lineHeight: 1.8 }}>
            {t("studio.noRenderButtons")}
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
                <strong style={{ color: "#1f7a4d" }}>{t("studio.uploadedToLibrary")}</strong>
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
