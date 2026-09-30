"use client";

import { useEffect, useState } from "react";

const THEMES = [
  { key: "dark", label: "深色", swatch: "#2E2570" },
  { key: "white", label: "白色", swatch: "#FFFFFF" },
  { key: "grey", label: "灰白", swatch: "#F2EEE6" }
] as const;

const STORAGE_KEY = "quitccp.videoTheme";

/**
 * The 背景 switch from the design.
 *
 * It writes the choice onto <html> as a data attribute -- every colour is a
 * custom property keyed off that, so the whole page re-themes without
 * re-rendering any of it. The choice is remembered per browser, and applied
 * before paint by a small inline script in the page so the reader never sees the
 * default flash past first.
 *
 * <html> rather than the .vp wrapper because that wrapper is React's: at
 * hydration React restores its server-rendered attributes, which wiped the
 * remembered choice back to 深色 on every load.
 */
export function VideoThemeToggle() {
  const [theme, setTheme] = useState<string>("dark");

  useEffect(() => {
    setTheme(document.documentElement.dataset.vpTheme || "dark");
  }, []);

  const pick = (key: string) => {
    setTheme(key);
    document.documentElement.dataset.vpTheme = key;
    try {
      window.localStorage.setItem(STORAGE_KEY, key);
    } catch {
      // Private browsing refuses storage; the page still switches, it just does
      // not remember.
    }
  };

  return (
    <div
      role="group"
      aria-label="背景颜色"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: 4,
        borderRadius: 999,
        background: "var(--field)",
        border: "1px solid var(--border)"
      }}
    >
      <span style={{ fontSize: 12, color: "var(--muted)", padding: "0 8px 0 10px" }}>背景</span>
      {THEMES.map((option) => {
        const on = theme === option.key;
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={on}
            onClick={() => pick(option.key)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              border: 0,
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 13,
              padding: "7px 14px",
              borderRadius: 999,
              background: on ? "var(--on-bg)" : "transparent",
              color: on ? "var(--on-fg)" : "var(--chip-fg)"
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: option.swatch,
                boxShadow: "0 0 0 1px rgba(128,120,160,0.6)"
              }}
              aria-hidden="true"
            />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Applies the remembered theme before first paint. */
export const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  STORAGE_KEY
)});if(t){document.documentElement.dataset.vpTheme=t}}catch(e){}})()`;
