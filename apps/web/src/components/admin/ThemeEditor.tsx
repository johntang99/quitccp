"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FONT_ROLES, type Theme, themeToCss } from "@/lib/theme-css";
import { THEME_PRESETS } from "@/lib/theme-presets";

const FONT_LABELS: Record<string, string> = {
  "serif-sc": "思源宋体 简（网页字体）",
  "system-sc": "系统黑体（苹方 / 微软雅黑）",
  "system-serif-sc": "系统宋体（宋体 / SimSun）",
  "plex-mono": "IBM Plex Mono（仅数字与英文）",
};

const COLOR_LABELS: Record<string, string> = {
  paper: "页面底色", card: "卡片底色", ink: "正文字色", ink2: "深紫字色",
  inkSoft: "次级字色", muted: "弱化字色", rule: "分隔线", ruleDark: "深底分隔线",
  seal: "主色（印章紫）", sealDeep: "主色·深", plumDeep: "深紫底", plumMid: "中紫底",
  plumMenu: "导航紫", gold: "金色", goldLight: "金色·浅",
  lavender: "淡紫", lavenderLight: "淡紫·浅",
};

const SURFACE_LABELS: Record<string, string> = {
  onGold: "金底上的字", bandDeep: "暗色卡片底", bandDeepest: "最深底",
  inkBand: "深色分隔线", inkDim: "弱化字（浅底）", inkMid: "次级字（浅底）",
  goldInk: "深金字", goldMuted: "柔和金", creamText: "米色字（深底）",
  creamRule: "米色分隔线", lavRule: "淡紫分隔线", lavTint: "淡紫块",
  lavText: "淡紫字", lavMuted: "淡紫·弱", lavDim: "淡紫·更弱",
  sealBright: "亮紫", gradMid: "渐变·中", gradTop: "渐变·亮",
  apricot: "杏色（视频页底色）",
};

const SIZE_LABELS: Record<string, string> = {
  display: "头条大标题", h2: "栏目标题 H2", h3: "卡片小标 H3",
  item: "列表标题", body: "正文", small: "说明 / 日期", label: "标签 / 眉题",
};

const LH_LABELS: Record<string, string> = { heading: "标题行距", item: "列表行距", body: "正文行距" };
const TR_LABELS: Record<string, string> = { heading: "标题字距", body: "正文字距", label: "标签字距" };

function set(theme: Theme, path: string[], value: string): Theme {
  const next = structuredClone(theme) as Record<string, unknown>;
  let node = next;
  for (const key of path.slice(0, -1)) node = node[key] as Record<string, unknown>;
  node[path[path.length - 1]] = value;
  return next as Theme;
}

function isHex(v: string) {
  return /^#[0-9a-f]{6}$/i.test(v);
}

export function ThemeEditor({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const [saved, setSaved] = useState<Theme>(initial);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewPath, setPreviewPath] = useState("/");
  const [view, setView] = useState<"form" | "json">("form");
  const [draftJson, setDraftJson] = useState("");
  const [jsonError, setJsonError] = useState("");
  const frame = useRef<HTMLIFrameElement>(null);

  const css = useMemo(() => themeToCss(theme), [theme]);
  const dirty = useMemo(() => JSON.stringify(theme) !== JSON.stringify(saved), [theme, saved]);

  // Push the draft tokens straight into the preview document. Same-origin, so no
  // round trip is needed and the preview tracks every keystroke.
  useEffect(() => {
    const apply = () => {
      const doc = frame.current?.contentDocument;
      if (!doc) return;
      let tag = doc.getElementById("theme-draft") as HTMLStyleElement | null;
      if (!tag) {
        tag = doc.createElement("style");
        tag.id = "theme-draft";
        doc.head.appendChild(tag);
      }
      tag.textContent = css;
    };
    apply();
    const el = frame.current;
    el?.addEventListener("load", apply);
    return () => el?.removeEventListener("load", apply);
  }, [css, previewPath]);

  function openJson() {
    // Strip the documentation blocks: they are the same in every theme and only
    // get in the way when someone is editing values by hand.
    const { _roles, _fonts, ...editable } = theme as Record<string, unknown>;
    void _roles;
    void _fonts;
    setDraftJson(JSON.stringify(editable, null, 2));
    setJsonError("");
    setView("json");
  }

  function applyJson(text: string) {
    setDraftJson(text);
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("顶层必须是一个对象 { }");
      }
      // Keep the doc blocks and anything the paste omitted; the server merges
      // over the defaults again on save, so a partial object can never strip tokens.
      setTheme({ ...theme, ...parsed } as Theme);
      setJsonError("");
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : String(err));
    }
  }

  async function save() {
    setBusy(true);
    setStatus("");
    try {
      const res = await fetch("/api/admin/content/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setSaved(json.theme);
      setTheme(json.theme);
      setStatus("已保存，全站已生效。");
    } catch (err) {
      setStatus(`保存失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!confirm("恢复为系统默认主题？已保存的自定义配色将被删除。")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/content/theme", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setSaved(json.theme);
      setTheme(json.theme);
      setStatus("已恢复默认主题。");
    } catch (err) {
      setStatus(`恢复失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  const colorRow = (group: "colors" | "surfaces", labels: Record<string, string>) => (
    <div className="theme-grid">
      {Object.entries(theme[group] as Record<string, string>).map(([key, value]) => (
        <label key={key} className="theme-field">
          <span>{labels[key] ?? key}</span>
          <span className="theme-color">
            <input
              type="color"
              value={isHex(value) ? value : "#000000"}
              disabled={!isHex(value)}
              onChange={(e) => setTheme(set(theme, [group, key], e.target.value.toUpperCase()))}
            />
            <input
              type="text"
              value={value}
              onChange={(e) => setTheme(set(theme, [group, key], e.target.value))}
            />
          </span>
        </label>
      ))}
    </div>
  );

  return (
    <div className="theme-editor">
      <div className="theme-panel">
        {view === "json" ? (
          <section className="admin-card">
            <h3>JSON</h3>
            <p className="theme-hint">
              与表单是同一份设置，改哪边都一样。保存后写入数据库（cms_site_settings 的 site.theme），
              <strong>不会修改代码里的 theme.json 文件</strong>——那个文件是随代码发布的默认值，
              只有「恢复默认」才会回到它。缺少的字段会自动用默认值补齐。
            </p>
            <textarea
              className="theme-json"
              spellCheck={false}
              value={draftJson}
              onChange={(e) => applyJson(e.target.value)}
            />
            {jsonError ? <p className="theme-json-error">JSON 有误：{jsonError}</p> : null}
          </section>
        ) : (
        <>
        <section className="admin-card">
          <h3>预设</h3>
          <p className="theme-hint">套用预设会替换下面所有颜色，保存后才会生效。</p>
          <div className="theme-presets">
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset._preset.id}
                type="button"
                className="theme-preset"
                onClick={() => {
                  const { _preset, ...rest } = preset;
                  void _preset;
                  setTheme(rest as Theme);
                }}
              >
                <span className="theme-swatches">
                  <i style={{ background: preset.colors.seal }} />
                  <i style={{ background: preset.colors.gold }} />
                  <i style={{ background: preset.colors.paper }} />
                </span>
                <b>{preset._preset.name}</b>
                <small>{preset._preset.description}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="admin-card">
          <h3>字体</h3>
          <p className="theme-hint">
            字体在构建时打包，只能从下面几种里选，不能自行填写字体名。
          </p>
          <div className="theme-grid">
            {(["heading", "body", "mono"] as const).map((role) => (
              <label key={role} className="theme-field">
                <span>{role === "heading" ? "标题" : role === "body" ? "正文" : "数字 / 英文"}</span>
                <select
                  value={theme.typography.fonts[role]}
                  onChange={(e) => setTheme(set(theme, ["typography", "fonts", role], e.target.value))}
                >
                  {Object.keys(FONT_ROLES).map((id) => (
                    <option key={id} value={id}>{FONT_LABELS[id] ?? id}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </section>

        <section className="admin-card">
          <h3>字号与行距</h3>
          <div className="theme-grid">
            {Object.entries(theme.typography.size).map(([key, value]) => (
              <label key={key} className="theme-field">
                <span>{SIZE_LABELS[key] ?? key}</span>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setTheme(set(theme, ["typography", "size", key], e.target.value))}
                />
              </label>
            ))}
            {Object.entries(theme.typography.lineHeight).map(([key, value]) => (
              <label key={key} className="theme-field">
                <span>{LH_LABELS[key] ?? key}</span>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setTheme(set(theme, ["typography", "lineHeight", key], e.target.value))}
                />
              </label>
            ))}
            {Object.entries(theme.typography.tracking).map(([key, value]) => (
              <label key={key} className="theme-field">
                <span>{TR_LABELS[key] ?? key}</span>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setTheme(set(theme, ["typography", "tracking", key], e.target.value))}
                />
              </label>
            ))}
            <label className="theme-field">
              <span>正文每行宽度</span>
              <input
                type="text"
                value={theme.typography.measure.body}
                onChange={(e) => setTheme(set(theme, ["typography", "measure", "body"], e.target.value))}
              />
            </label>
          </div>
        </section>

        <section className="admin-card">
          <h3>主要颜色</h3>
          {colorRow("colors", COLOR_LABELS)}
        </section>

        <section className="admin-card">
          <h3>次要颜色</h3>
          <p className="theme-hint">新闻与视频版面用到的深浅层次。</p>
          {colorRow("surfaces", SURFACE_LABELS)}
        </section>

        <section className="admin-card">
          <h3>圆角、阴影与间距</h3>
          <div className="theme-grid">
            {Object.entries(theme.shape).map(([key, value]) => (
              <label key={key} className="theme-field">
                <span>{key === "radius" ? "圆角" : "阴影"}</span>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setTheme(set(theme, ["shape", key], e.target.value))}
                />
              </label>
            ))}
            {Object.entries(theme.spacing).map(([key, value]) => (
              <label key={key} className="theme-field">
                <span>{key === "wrap" ? "内容最大宽度" : key === "sectionY" ? "版块上下留白" : "左右边距"}</span>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setTheme(set(theme, ["spacing", key], e.target.value))}
                />
              </label>
            ))}
          </div>
        </section>
        </>
        )}
      </div>

      <div className="theme-preview">
        <div className="theme-toolbar">
          <select value={previewPath} onChange={(e) => setPreviewPath(e.target.value)}>
            <option value="/">首页</option>
            <option value="/news">新闻与报告</option>
            <option value="/videos">视频</option>
            <option value="/resources">资源馆</option>
            <option value="/about">关于我们</option>
          </select>
          <span className="theme-spacer" />
          {status ? <span className="theme-status">{status}</span> : null}
          <button
            type="button"
            onClick={() => (view === "json" ? setView("form") : openJson())}
            disabled={busy}
          >
            {view === "json" ? "表单编辑" : "JSON 编辑"}
          </button>
          <button type="button" onClick={reset} disabled={busy}>恢复默认</button>
          <button type="button" className="theme-save" onClick={save} disabled={busy || !dirty}>
            {busy ? "保存中…" : dirty ? "保存并生效" : "已是最新"}
          </button>
        </div>
        <iframe ref={frame} src={previewPath} title="主题预览" />
      </div>
    </div>
  );
}
