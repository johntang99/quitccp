import { externalLinkProps } from "@/lib/external-services";
import { asObjectArray, asString } from "./content-utils";

/**
 * The small repeating pieces of the 参与支持 pages.
 *
 * Each of these was written out by hand in every branch that used it -- four
 * near-identical sidebar <ul>s, three call-to-action panels, two rows of entry
 * cards -- which is why none of them could be edited. They live in one place so
 * the five pages stay in step, and they render nothing when their content is
 * empty rather than leaving a heading over a blank space.
 */

/**
 * A sidebar panel that is a heading and a list of links.
 *
 * An entry with no address, or with the placeholder `#`, renders as plain text
 * rather than as a link. These lists are full of entries that were written
 * before their destination existed, and a link that looks clickable and goes
 * nowhere is worse than one that does not -- particularly for readers trained
 * to treat a misbehaving link as a sign of a spoofed page.
 */
export function LinkPanel({
  title,
  links,
  note
}: {
  title: string;
  links: Record<string, unknown>[];
  note?: string;
}) {
  if (links.length === 0) return null;
  return (
    <div className="panel">
      <h4>{title}</h4>
      {note ? (
        <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: "var(--lh-body)", marginTop: 0 }}>
          {note}
        </p>
      ) : null}
      <ul>
        {links.map((row, index) => {
          const href = asString(row.href).trim();
          const label = asString(row.label);
          return (
            <li key={label || index}>
              {href && href !== "#" ? (
                <a href={href} {...externalLinkProps(href)}>
                  {label}
                </a>
              ) : (
                label
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** A sidebar panel that is a heading and a plain list of lines. */
export function ListPanel({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="panel">
      <h4>{title}</h4>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The handoff panel's content, read from the CMS.
 *
 * Every services page that stops and sends the reader to tuidang.org carried
 * this text inline. The destination host, the conditions and what each channel
 * costs all change; none of it was editable.
 */
export function handoffProps(panel: Record<string, unknown>, fallback: Record<string, unknown>) {
  const value = Object.keys(panel).length > 0 ? panel : fallback;
  return {
    eyebrow: asString(value.eyebrow),
    heading: asString(value.heading),
    body: asString(value.body),
    destinationNote: asString(value.destinationNote),
    actions: asObjectArray(value.actions).map((row) => ({
      label: asString(row.label),
      href: asString(row.href),
      primary: row.primary === true,
      stamp: asString(row.stamp),
      note: asString(row.note)
    }))
  };
}

/** The four-up row of entry points shared by /involve and /involve/other-ways. */
export function ActCards({ rows }: { rows: Record<string, unknown>[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="sec" style={{ paddingTop: 52 }}>
      <div className="wrap">
        <div className="act">
          {rows.map((row, index) => (
            <a key={asString(row.title) || index} href={asString(row.href, "/")}>
              <h4>{asString(row.title)}</h4>
              <p>{asString(row.body)}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Sidebar panel with one button: 捐助 / 参与联署 / 成为义工. */
export function CtaPanel({
  panel,
  fallbackHref
}: {
  panel: Record<string, unknown>;
  fallbackHref: string;
}) {
  const title = asString(panel.title);
  if (!title) return null;
  const href = asString(panel.buttonHref, fallbackHref);
  return (
    <div className="panel panel--seal">
      <h4>{title}</h4>
      {asString(panel.body) ? <p>{asString(panel.body)}</p> : null}
      {asString(panel.buttonLabel) ? (
        <a className="btn btn--seal btn--sm" href={href} {...externalLinkProps(href)}>
          {asString(panel.buttonLabel)}
        </a>
      ) : null}
    </div>
  );
}

/** Convenience for the pattern "CMS value, else the shared default". */
export function blockRows(value: unknown, fallback: unknown): Record<string, unknown>[] {
  const rows = asObjectArray(value);
  return rows.length > 0 ? rows : asObjectArray(fallback);
}
