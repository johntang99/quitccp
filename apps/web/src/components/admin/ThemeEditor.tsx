"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { tRich } from "@/lib/i18n/rich";
import { FONT_ROLES, type Theme, themeToCss } from "@/lib/theme-css";
import { THEME_PRESETS } from "@/lib/theme-presets";

const FONT_LABELS: Record<string, string> = {
  "serif-sc": t("theme.font.serif-sc"),
  "system-sc": t("theme.font.system-sc"),
  "system-serif-sc": t("theme.font.system-serif-sc"),
  "plex-mono": t("theme.font.plex-mono"),
};

const COLOR_LABELS: Record<string, string> = {
  paper: t("theme.color.paper"), card: t("theme.color.card"), ink: t("theme.color.ink"), ink2: t("theme.color.ink2"),
  inkSoft: t("theme.color.inkSoft"), muted: t("theme.color.muted"), rule: t("theme.color.rule"), ruleDark: t("theme.color.ruleDark"),
  seal: t("theme.color.seal"), sealDeep: t("theme.color.sealDeep"), plumDeep: t("theme.color.plumDeep"), plumMid: t("theme.color.plumMid"),
  plumMenu: t("theme.color.plumMenu"), gold: t("theme.color.gold"), goldLight: t("theme.color.goldLight"),
  lavender: t("theme.color.lavender"), lavenderLight: t("theme.color.lavenderLight"),
};

const SURFACE_LABELS: Record<string, string> = {
  onGold: t("theme.surface.onGold"), bandDeep: t("theme.surface.bandDeep"), bandDeepest: t("theme.surface.bandDeepest"),
  inkBand: t("theme.surface.inkBand"), inkDim: t("theme.surface.inkDim"), inkMid: t("theme.surface.inkMid"),
  goldInk: t("theme.surface.goldInk"), goldMuted: t("theme.surface.goldMuted"), creamText: t("theme.surface.creamText"),
  creamRule: t("theme.surface.creamRule"), lavRule: t("theme.surface.lavRule"), lavTint: t("theme.surface.lavTint"),
  lavText: t("theme.surface.lavText"), lavMuted: t("theme.surface.lavMuted"), lavDim: t("theme.surface.lavDim"),
  sealBright: t("theme.surface.sealBright"), gradMid: t("theme.surface.gradMid"), gradTop: t("theme.surface.gradTop"),
  apricot: t("theme.surface.apricot"),
};

const SIZE_LABELS: Record<string, string> = {
  display: t("theme.size.display"), h2: t("theme.size.h2"), h3: t("theme.size.h3"),
  item: t("theme.size.item"), body: t("theme.size.body"), small: t("theme.size.small"), label: t("theme.size.label"),
};

const LH_LABELS: Record<string, string> = { heading: t("theme.lh.heading"), item: t("theme.lh.item"), body: t("theme.lh.body") };
const TR_LABELS: Record<string, string> = { heading: t("theme.tr.heading"), body: t("theme.tr.body"), label: t("theme.tr.label") };

function set(theme: Theme, path: string[], value: string): Theme {
  const next = structuredClone(theme) as Record<string, unknown>;
  let node = next;
  // A theme cached before a group was added lacks it; create it rather than crash.
  for (const key of path.slice(0, -1)) node = (node[key] ??= {}) as Record<string, unknown>;
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
        throw new Error(t("theme.err.notObject"));
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
      setStatus(t("theme.saved"));
    } catch (err) {
      setStatus(t("theme.saveFailed", { error: err instanceof Error ? err.message : String(err) }));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!confirm(t("theme.confirmReset"))) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/content/theme", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setSaved(json.theme);
      setTheme(json.theme);
      setStatus(t("theme.resetDone"));
    } catch (err) {
      setStatus(t("theme.resetFailed", { error: err instanceof Error ? err.message : String(err) }));
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
              {tRich("theme.jsonNote", { noFile: <strong>{t("theme.jsonNoteNoFile")}</strong> })}
            </p>
            <textarea
              className="theme-json"
              spellCheck={false}
              value={draftJson}
              onChange={(e) => applyJson(e.target.value)}
            />
            {jsonError ? <p className="theme-json-error">{t("theme.jsonError", { error: jsonError })}</p> : null}
          </section>
        ) : (
        <>
        <section className="admin-card">
          <h3>{t("theme.presets")}</h3>
          <p className="theme-hint">{t("theme.presetsHint")}</p>
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
                <b>{t(`theme.preset.${preset._preset.id}.name`)}</b>
                <small>{t(`theme.preset.${preset._preset.id}.desc`)}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="admin-card">
          <h3>{t("theme.fonts")}</h3>
          <p className="theme-hint">
            {t("theme.fontsHint")}
          </p>
          <div className="theme-grid">
            {(["heading", "body", "mono"] as const).map((role) => (
              <label key={role} className="theme-field">
                <span>{t(role === "heading" ? "theme.role.heading" : role === "body" ? "theme.role.body" : "theme.role.numeric")}</span>
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
          <h3>{t("theme.sizes")}</h3>
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
              <span>{t("theme.measure")}</span>
              <input
                type="text"
                value={theme.typography.measure.body}
                onChange={(e) => setTheme(set(theme, ["typography", "measure", "body"], e.target.value))}
              />
            </label>
            <label className="theme-field">
              <span>{t("theme.align")}</span>
              <select
                value={theme.typography.align?.body ?? "justify"}
                onChange={(e) => setTheme(set(theme, ["typography", "align", "body"], e.target.value))}
              >
                <option value="justify">{t("theme.align.justify")}</option>
                <option value="left">{t("theme.align.left")}</option>
              </select>
            </label>
          </div>
        </section>

        <section className="admin-card">
          <h3>{t("theme.primaryColors")}</h3>
          {colorRow("colors", COLOR_LABELS)}
        </section>

        <section className="admin-card">
          <h3>{t("theme.secondaryColors")}</h3>
          <p className="theme-hint">{t("theme.secondaryHint")}</p>
          {colorRow("surfaces", SURFACE_LABELS)}
        </section>

        <section className="admin-card">
          <h3>{t("theme.shapes")}</h3>
          <div className="theme-grid">
            {Object.entries(theme.shape).map(([key, value]) => (
              <label key={key} className="theme-field">
                <span>{t(key === "radius" ? "theme.radius" : "theme.shadow")}</span>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setTheme(set(theme, ["shape", key], e.target.value))}
                />
              </label>
            ))}
            {Object.entries(theme.spacing).map(([key, value]) => (
              <label key={key} className="theme-field">
                <span>{t(key === "wrap" ? "theme.wrap" : key === "sectionY" ? "theme.sectionY" : "theme.gutter")}</span>
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
            <option value="/">{t("theme.preview.home")}</option>
            <option value="/news">{t("theme.preview.news")}</option>
            <option value="/videos">{t("theme.preview.videos")}</option>
            <option value="/resources">{t("theme.preview.resources")}</option>
            <option value="/about">{t("theme.preview.about")}</option>
          </select>
          <span className="theme-spacer" />
          {status ? <span className="theme-status">{status}</span> : null}
          <button
            type="button"
            onClick={() => (view === "json" ? setView("form") : openJson())}
            disabled={busy}
          >
            {t(view === "json" ? "theme.editForm" : "theme.editJson")}
          </button>
          <button type="button" onClick={reset} disabled={busy}>{t("theme.reset")}</button>
          <button type="button" className="theme-save" onClick={save} disabled={busy || !dirty}>
            {t(busy ? "theme.saving" : dirty ? "theme.saveAndApply" : "theme.upToDate")}
          </button>
        </div>
        <iframe ref={frame} src={previewPath} title={t("theme.previewTitle")} />
      </div>
    </div>
  );
}
