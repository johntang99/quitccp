"use client";

import { useEffect, useRef, useState } from "react";

export interface VerifyFormCopy {
  eyebrow: string;
  numberLabel: string;
  numberHint: string;
  numberPlaceholder: string;
  nameLabel: string;
  nameHint: string;
  namePlaceholder: string;
  buttonLabel: string;
  buttonStamp: string;
}

type Outcome = "valid" | "not_found" | "revoked" | "name_mismatch";

interface Result {
  outcome: Outcome;
  serialNumber: string;
  issuedAt?: string;
}

/**
 * Wording matches the promise made on the page: a result says whether we issued
 * the serial, when, and its status -- never the statement or the submitter.
 */
const OUTCOME_COPY: Record<Outcome, { label: string; body: string; tone: string }> = {
  valid: {
    label: "有效",
    body: "该编号由本中心签发，登记记录存在，证明未被作废。",
    tone: "var(--seal)"
  },
  not_found: {
    label: "查无此编号",
    body: "该编号不在签发记录中。可能是输入有误，也可能并非本中心签发。",
    tone: "var(--muted)"
  },
  revoked: {
    label: "已作废",
    body: "该编号曾经签发，但因信息变更或补发等原因已作废。",
    tone: "var(--muted)"
  },
  name_mismatch: {
    label: "姓名不符",
    body: "该编号存在，但与你输入的姓名不一致。请核对证明上印刷的姓名后重试。",
    tone: "var(--muted)"
  }
};

function formatIssuedAt(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

export function VerifyForm({ copy }: { copy: VerifyFormCopy }) {
  const [serialNumber, setSerialNumber] = useState("");
  const [holderName, setHolderName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Move focus to the result once React has actually committed it, so a
  // keyboard or screen-reader user is not left at the submit button wondering
  // whether anything happened. Scheduling this from the submit handler ran
  // before the commit and silently did nothing.
  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setFormError("");
    setResult(null);

    try {
      const response = await fetch("/api/public/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serialNumber, holderName })
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        outcome?: Outcome;
        serialNumber?: string;
        issuedAt?: string;
      };

      if (!response.ok || !payload.outcome) {
        setFormError(payload.error || "查验未能完成，请稍后再试。");
        return;
      }

      setResult({
        outcome: payload.outcome,
        serialNumber: payload.serialNumber ?? serialNumber,
        issuedAt: payload.issuedAt
      });
    } catch {
      setFormError("网络连接未能完成，请稍后再试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <form className="form" onSubmit={handleSubmit} noValidate>
        <p className="eyebrow" style={{ marginBottom: 16 }}>
          {copy.eyebrow}
        </p>

        {formError ? (
          <div role="alert" className="notice" style={{ borderColor: "var(--seal)", marginBottom: 20 }}>
            <b>查验未完成</b>
            {formError}
          </div>
        ) : null}

        <div className="fgroup">
          <label htmlFor="verify-serial">{copy.numberLabel}</label>
          <p className="fhint" id="verify-serial-hint">
            {copy.numberHint}
          </p>
          <input
            id="verify-serial"
            name="serialNumber"
            type="text"
            value={serialNumber}
            maxLength={64}
            autoComplete="off"
            aria-describedby="verify-serial-hint"
            onChange={(event) => setSerialNumber(event.target.value)}
            placeholder={copy.numberPlaceholder}
          />
        </div>

        <div className="fgroup">
          <label htmlFor="verify-name">{copy.nameLabel}</label>
          <p className="fhint" id="verify-name-hint">
            {copy.nameHint}
          </p>
          <input
            id="verify-name"
            name="holderName"
            type="text"
            value={holderName}
            maxLength={80}
            autoComplete="off"
            aria-describedby="verify-name-hint"
            onChange={(event) => setHolderName(event.target.value)}
            placeholder={copy.namePlaceholder}
          />
        </div>

        <button className="btn btn--seal" type="submit" disabled={submitting}>
          <span className="stamp">{copy.buttonStamp}</span>
          {submitting ? "查验中…" : copy.buttonLabel}
        </button>
      </form>

      {result ? (
        <div
          ref={resultRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className="panel"
          style={{ marginTop: 28 }}
        >
          <p className="eyebrow" style={{ marginBottom: 10 }}>
            查验结果
          </p>
          <p
            style={{
              fontFamily: "var(--serif)",
              fontSize: 28,
              color: OUTCOME_COPY[result.outcome].tone,
              margin: "0 0 10px"
            }}
          >
            {OUTCOME_COPY[result.outcome].label}
          </p>
          <p style={{ fontFamily: "var(--mono)", fontSize: 15, margin: "0 0 12px" }}>
            {result.serialNumber}
          </p>
          <p style={{ lineHeight: 1.8, marginBottom: result.issuedAt ? 12 : 0 }}>
            {OUTCOME_COPY[result.outcome].body}
          </p>
          {result.issuedAt ? (
            <p style={{ marginBottom: 0, color: "var(--muted)" }}>
              签发日期：{formatIssuedAt(result.issuedAt)}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
