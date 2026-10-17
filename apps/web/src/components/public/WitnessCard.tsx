"use client";

import { useEffect, useRef, useState } from "react";

export interface Witness {
  quote: string;
  name: string;
  role: string;
  image: string;
}

/**
 * The 见证 card in the 曙光 band: one statement at a time, with a row of
 * portraits to switch between them.
 *
 * A card is far narrower than the standalone 见证者 grid, so the three
 * statements take turns rather than sitting side by side. The portraits are
 * real buttons with the speaker's name as their label, so the switcher works
 * from the keyboard and reads correctly to a screen reader -- a portrait alone
 * says nothing about who it selects.
 *
 * ## It turns by itself, until the reader takes over
 *
 * Six portraits sat under one statement with nothing saying the others could
 * be opened, so five of the six were never read. It now advances on its own.
 *
 * Three things stop it, all for the same reason -- the reader is reading:
 * a pointer over the card, keyboard focus inside it, and a click on any
 * portrait. The click stops it for good rather than for a moment: somebody who
 * chose a speaker does not want the card moving on while they are mid-sentence.
 *
 * `prefers-reduced-motion` turns it off entirely. The portraits still work, so
 * nothing is lost -- only the movement.
 */
export function WitnessCard({
  items,
  moreLabel,
  moreHref
}: {
  items: Witness[];
  moreLabel: string;
  moreHref: string;
}) {
  const [active, setActive] = useState(0);
  /* Set once the reader clicks a portrait, and never cleared. */
  const [tookOver, setTookOver] = useState(false);
  const [paused, setPaused] = useState(false);

  /** Seconds a statement holds before the next one. Long enough to read 50-odd
      characters without hurrying, short enough that a reader who glances away
      and back sees a different face rather than the same one. */
  const HOLD_MS = 7000;

  const count = items.length;
  const stopped = tookOver || paused || count < 2;
  const stoppedRef = useRef(stopped);
  stoppedRef.current = stopped;

  useEffect(() => {
    if (count < 2) return;
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (motion?.matches) return;
    const timer = window.setInterval(() => {
      /* Read through a ref so pausing does not tear the timer down and start
         a fresh full interval every time the pointer crosses the card. */
      if (stoppedRef.current) return;
      setActive((current) => (current + 1) % count);
    }, HOLD_MS);
    return () => window.clearInterval(timer);
  }, [count]);

  const shown = items[active] ?? items[0];
  if (!shown) return null;

  return (
    /* The pause handlers sit on a wrapper rather than on the figure: the
       portraits are outside the figure, and a reader reaching for one should
       not be racing a timer that is still running. */
    <div
      className="dawn-wit-wrap"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* No oversized opening quote mark. It cost 36px of height inside an
          already crowded card and said nothing the <blockquote> and the
          attribution beneath it did not already say. */}
      <figure className="dawn-wit">
        <blockquote>{shown.quote}</blockquote>
        <figcaption>
          {shown.image ? <img src={shown.image} alt="" /> : <span className="dawn-wit-blank" />}
          <span className="dawn-wit-who">
            <span className="dawn-wit-name">{shown.name}</span>
            <span className="dawn-wit-role">
              {shown.role.split("\n").map((line, index) => (
                <span key={line || index}>{line}</span>
              ))}
            </span>
          </span>
        </figcaption>
      </figure>

      <div className="dawn-wit-foot">
        {items.length > 1 ? (
          <div className="dawn-wit-picks">
            {items.map((item, index) => (
              <button
                key={`${item.name}-${index}`}
                type="button"
                aria-label={item.name}
                aria-pressed={index === active}
                className={index === active ? "is-active" : undefined}
                onClick={() => {
                  setActive(index);
                  setTookOver(true);
                }}
              >
                {item.image ? <img src={item.image} alt="" /> : <span />}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        <a className="dawn-wit-more" href={moreHref}>
          {moreLabel}
        </a>
      </div>
    </div>
  );
}
