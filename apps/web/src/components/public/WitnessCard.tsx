"use client";

import { useState } from "react";

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
  const shown = items[active] ?? items[0];
  if (!shown) return null;

  return (
    <>
      <figure className="dawn-wit">
        <span className="dawn-wit-mark" aria-hidden="true">
          “
        </span>
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
                onClick={() => setActive(index)}
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
    </>
  );
}
