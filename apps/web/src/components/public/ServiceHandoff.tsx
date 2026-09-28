import { EXTERNAL_LINK_PROPS } from "@/lib/external-services";

export interface HandoffAction {
  label: string;
  href: string;
  /** Renders with the seal (primary) treatment. One per handoff. */
  primary?: boolean;
  stamp?: string;
  /** Shown under the button — e.g. which channel this is, or what it costs. */
  note?: string;
}

interface ServiceHandoffProps {
  eyebrow: string;
  heading: string;
  body: string;
  actions: HandoffAction[];
  /** Host name shown to the reader so the jump is not a surprise. */
  destinationNote: string;
  children?: React.ReactNode;
}

/**
 * The handoff panel used wherever this site stops and the production service
 * takes over.
 *
 * Both service hosts carry their own, much older visual system, so the reader
 * is about to leave this design behind. Naming the destination host up front
 * makes that a deliberate step rather than a jolt that reads as a broken or
 * spoofed link -- which matters for an audience trained to be wary of
 * redirects.
 */
export function ServiceHandoff({
  eyebrow,
  heading,
  body,
  actions,
  destinationNote,
  children
}: ServiceHandoffProps) {
  return (
    <div className="form">
      <p className="eyebrow" style={{ marginBottom: 16 }}>
        {eyebrow}
      </p>
      <h2 style={{ fontFamily: "var(--serif)", fontSize: 30, margin: "0 0 14px" }}>{heading}</h2>
      <p style={{ lineHeight: 1.8, color: "var(--muted)", marginBottom: 26 }}>{body}</p>

      <div style={{ display: "grid", gap: 18 }}>
        {actions.map((action) => (
          <div key={action.href + action.label}>
            <a
              className={action.primary ? "btn btn--seal" : "btn btn--line"}
              href={action.href}
              {...EXTERNAL_LINK_PROPS}
            >
              {action.stamp ? <span className="stamp">{action.stamp}</span> : null}
              {action.label}
            </a>
            {action.note ? (
              <p
                style={{
                  fontSize: 13,
                  color: "var(--muted)",
                  margin: "10px 0 0",
                  lineHeight: 1.7,
                  maxWidth: "46ch"
                }}
              >
                {action.note}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <p
        style={{
          fontSize: 13,
          color: "var(--muted)",
          marginTop: 26,
          paddingTop: 16,
          borderTop: "1px solid var(--rule)",
          lineHeight: 1.7
        }}
      >
        {destinationNote}
      </p>

      {children}
    </div>
  );
}
