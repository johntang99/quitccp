"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";

/**
 * An image that opens full size when it is clicked.
 *
 * The certificate in the services hero is shown at about a quarter of its
 * width, and at that size the thing a reader actually came to check -- the
 * wording, the seal, the fields they would have to fill in -- is unreadable.
 * The old site opened it in a lightbox; this does the same without the plugin.
 *
 * Built on `<dialog>` rather than a div with a high z-index, because the
 * browser then handles the parts that are easy to get wrong: focus moves into
 * the dialog and comes back out, Escape closes it, and the page behind stops
 * being reachable by keyboard while it is open.
 */
export function FigureZoom({
  src,
  alt,
  caption
}: {
  src: string;
  alt: string;
  /** Shown under the enlarged image; also the button's accessible name. */
  caption?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  /* Escape and the browser's own close both fire `close`; without this the
     state would say open while the dialog had already gone. */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => setOpen(false);
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);

  const label = caption?.trim() || alt.trim() || "图片";

  return (
    <>
      <button type="button" className="zoomfig" onClick={() => setOpen(true)} aria-label={t("figure.zoomLabel", { label })}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} />
        <span className="zoomfig-hint" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M11 8.4v5.2M8.4 11h5.2M15.8 15.8 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {t("figure.zoomHint")}
        </span>
      </button>

      <dialog
        ref={dialogRef}
        className="zoomdlg"
        onClick={(event) => {
          /* Clicking away closes. "Away" is either the dialog itself or the
             box that centres the picture inside it -- the latter fills the
             dialog, so a click beside the image never reaches the dialog
             element and checking only for that left the backdrop dead. */
          const target = event.target as HTMLElement;
          if (target === dialogRef.current || target.classList.contains("zoomdlg-in")) {
            setOpen(false);
          }
        }}
      >
        <div className="zoomdlg-in">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} />
          {caption ? <p className="zoomdlg-cap">{caption}</p> : null}
          <button type="button" className="zoomdlg-x" onClick={() => setOpen(false)} aria-label={t("figure.close")}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </dialog>
    </>
  );
}
