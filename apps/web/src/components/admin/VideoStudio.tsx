"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  output: { name: string; width: number; height: number; fps: number; crf: number; alsoWidth?: number; dir?: string; fade?: boolean };
  music?: { from: string; loop?: boolean; bpm?: number; lufs?: number; start?: number } | null;
  clips: Clip[];
  _?: unknown;
}

interface Shot {
  from: number;
  to: number;
  len: number;
}

const EMPTY: Project = {
  output: { name: "new-video", width: 1920, height: 1080, fps: 25, crf: 21, alsoWidth: 1280, dir: "artifacts/hero", fade: false },
  music: null,
  clips: []
};

const fileUrl = (p: string) => `/api/admin/studio/file?path=${encodeURIComponent(p)}`;
const secs = (n: number) => `${n.toFixed(2)}s`;
const clock = (n: number) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;

export function VideoStudio({
  projects,
  available,
  unavailableReason
}: {
  projects: string[];
  available: boolean;
  unavailableReason: string;
}) {
  const [projectList, setProjectList] = useState(projects);
  const [name, setName] = useState(projects[0] ?? "new-video.json");
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
  const [result, setResult] = useState<{ files: string[]; duration: number; uploaded: Record<string, string> | null } | null>(null);
  const logRef = useRef<HTMLPreElement>(null);
  const [log, setLog] = useState("");

  const total = useMemo(
    () => project.clips.reduce((n, c) => n + Math.max(0, (Number(c.to) || 0) - (Number(c.from) || 0)), 0),
    [project.clips]
  );

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
    setProject({ ...EMPTY, ...data.project, output: { ...EMPTY.output, ...(data.project?.output ?? {}) } });
    setResult(null);
    setRowFrames({});
  }

  async function save() {
    const data = await call("/api/admin/studio/project", { name, project }, "存盘");
    if (data?.projects) setProjectList(data.projects);
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
      setProjectList((list) => (list.includes(name) ? list : [...list, name].sort()));
    }
  }

  if (!available) {
    return (
      <section className="admin-card">
        <h2 style={{ marginTop: 0 }}>影片拼接台</h2>
        <p style={{ margin: "8px 0 0", color: "#b42318", background: "#fef3f2", padding: "10px 12px", borderRadius: 4, lineHeight: 1.7 }}>
          {unavailableReason}
        </p>
        <p style={{ margin: "10px 0 0", color: "#555", lineHeight: 1.8 }}>
          剪片靠的是 ffmpeg，它在本机上，不在 Vercel 上。要用这一页，在装了 ffmpeg 的电脑上跑
          <code style={{ margin: "0 4px" }}>npm run dev</code>，然后打开
          <code style={{ margin: "0 4px" }}>localhost:4020/admin/video-studio</code>。
        </p>
      </section>
    );
  }

  return (
    <>
      {problem ? (
        <section className="admin-card" style={{ marginBottom: 14, borderColor: "#f0b4ac" }}>
          <strong style={{ color: "#b42318" }}>{problem}</strong>
        </section>
      ) : null}

      {/* ---- 1. 翻片子（可选） ---- */}
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

      {/* ---- 3. 顺序 ---- */}
      <section className="admin-card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>
          1 · 播放顺序
          <span style={{ fontWeight: 400, fontSize: 14, color: "#777", marginLeft: 10 }}>
            {project.clips.length} 段，共 {total.toFixed(2)} 秒
          </span>
        </h3>
        <p className="muted" style={{ margin: "0 0 12px", lineHeight: 1.75 }}>
          每一段就是「某条片子的第几秒到第几秒」。地址直接粘在这一行里——
          干净世界的网址、.mp4 直链、本机路径都行，<strong>不用先上传，也不用先在上面认过</strong>。
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
                  <div style={{ display: "grid", gridTemplateColumns: "28px 1fr auto", gap: 8, alignItems: "center" }}>
                    <span style={{ color: "#888", fontVariantNumeric: "tabular-nums", fontSize: 15 }}>{i + 1}</span>
                    <input
                      className="admin-input"
                      style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}
                      value={c.source}
                      onChange={(e) => patchClip(i, { source: e.target.value })}
                      placeholder="https://www.ganjingworld.com/embed/…  或  artifacts/footage/xxx.mp4"
                    />
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
                  </div>

                  {/* 第二行：取哪一段，叫什么 */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "28px 92px 92px 60px 1fr auto",
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
                    <span style={{ display: "flex", gap: 4 }}>
                      {/* Checking the two ends is how you tell a clip is the shot you
                          meant without rendering the whole film. */}
                      <button
                        className="admin-btn admin-btn-sm"
                        type="button"
                        title="看这一段的头尾两帧"
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

                  {shown ? (
                    <div style={{ display: "grid", gridTemplateColumns: "28px 1fr", gap: 8 }}>
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
        <h3 style={{ marginTop: 0 }}>2 · 音乐与出片设置</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>音乐文件（本机路径，留空就没有声音）</label>
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
              placeholder="artifacts/hero/hero-music-source.mp4"
            />
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
                BPM
                <input
                  className="admin-input"
                  style={{ width: 82 }}
                  value={project.music?.bpm ?? ""}
                  disabled={!project.music}
                  onChange={(e) => setProject((p) => (p.music ? { ...p, music: { ...p.music, bpm: Number(e.target.value) } } : p))}
                />
              </label>
            </div>
            <p className="muted" style={{ fontSize: 12, margin: "6px 0 0", lineHeight: 1.7 }}>
              填了 BPM，循环会按整拍剪、按一拍交叉淡接，接缝听不出来；不填就用半秒淡接，有节奏的曲子会露馅。
            </p>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>成片文件名</label>
            <input className="admin-input" style={{ width: "100%" }} value={project.output.name} onChange={(e) => patchOutput({ name: e.target.value })} />
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

      {/* ---- 5. 出片 ---- */}
      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>3 · 出片</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
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
          <span style={{ flex: 1 }} />
          <button className="admin-btn" type="button" disabled={Boolean(busy)} onClick={save}>
            存项目
          </button>
          {busy ? <strong style={{ color: "#4a3c96" }}>{busy}</strong> : null}
        </div>
        <p className="muted" style={{ fontSize: 12.5, margin: "10px 0 0", lineHeight: 1.75 }}>
          小样几秒钟就好，只看剪得对不对。正式版 1080p 大约半分钟。
          「出片并上传」会传到 Storage 并登记进图片视频库——首页要换片，再去「页面内容 → 首屏 Hero」把地址粘上。
        </p>

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

      {/* ---- 项目切换，放最后：开工时用得少 ---- */}
      <section className="admin-card" style={{ marginTop: 14 }}>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>项目</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select className="admin-input" style={{ width: 240 }} value={name} onChange={(e) => void load(e.target.value)}>
            {projectList.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
            {projectList.includes(name) ? null : <option value={name}>{name}（未保存）</option>}
          </select>
          <input
            className="admin-input"
            style={{ width: 220 }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="hero-30s.json"
          />
          <button
            className="admin-btn"
            type="button"
            onClick={() => {
              setProject(EMPTY);
              setResult(null);
              setName("new-video.json");
            }}
          >
            新建空白
          </button>
        </div>
        <p className="muted" style={{ fontSize: 12, margin: "8px 0 0", lineHeight: 1.7 }}>
          项目存在仓库的 <code>projects/</code> 里，就是命令行读的那个文件——
          这一页和 <code>node scripts/video-studio.mjs projects/xxx.json</code> 出来的片子一模一样。
        </p>
      </section>
    </>
  );
}
