"use client";

import { useEffect, useRef, useState } from "react";
import { SITE_LANGUAGES } from "@/lib/site-languages";

/**
 * The language switcher in the brand row.
 *
 * The five languages are separate sites on separate domains, not locales of
 * this one, so choosing one is a plain navigation away -- pick from the list
 * and go. Nothing is remembered: a reader who lands here again gets the
 * Chinese site and the same dropdown, which is one click and never a setting
 * they have to find their way back out of.
 *
 * It wears the same `btn btn--sm` classes as 捐助我们 beside it, rather than
 * repeating those paddings in its own rule, so the two cannot drift to
 * different heights the next time the button sizes are touched.
 */
export function LanguagePicker() {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  /* Close on an outside click or Escape -- the two things every dropdown is
     expected to do, and whose absence reads as a broken menu. */
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="langpick" ref={boxRef}>
      <button
        type="button"
        className="btn btn--line-light btn--sm langpick-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        选择语种
        <svg viewBox="0 0 24 24" aria-hidden="true" className="langpick-caret">
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>

      {open ? (
        <ul className="langpick-menu" role="listbox">
          {SITE_LANGUAGES.map((lang) => (
            <li key={lang.code}>
              <button
                type="button"
                role="option"
                aria-selected={Boolean(lang.current)}
                className={lang.current ? "on" : undefined}
                onClick={() => {
                  setOpen(false);
                  /* `href` is null for the site we are already on: closing the
                     menu is the whole response, with no pointless reload. */
                  if (lang.href) window.location.href = lang.href;
                }}
              >
                {lang.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
