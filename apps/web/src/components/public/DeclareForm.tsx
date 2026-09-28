"use client";

import { useMemo, useRef, useState } from "react";

export interface DeclareFormCopy {
  organizations: string[];
  regionOptions: string[];
  certificateOptions: string[];
  submitLabel: string;
  submitStamp: string;
  submitNote: string;
  steps: string[];
}

type FieldErrors = Record<string, string>;

interface Receipt {
  sequenceNumber: string | null;
  createdAt?: string;
  wantsCertificate?: boolean;
}

const NO_REGION = "请选择（可不选）";

/**
 * `children` is the CMS-driven safety notice, which sits between the step bar
 * and the fields. It stays in the server component so its copy and links keep
 * coming from content rather than being duplicated here.
 */
export function DeclareForm({ copy, children }: { copy: DeclareFormCopy; children?: React.ReactNode }) {
  const [scopes, setScopes] = useState<string[]>([]);
  const [alias, setAlias] = useState("");
  const [region, setRegion] = useState(NO_REGION);
  const [statement, setStatement] = useState("");
  const [wantsCertificate, setWantsCertificate] = useState(false);
  const [honeypot, setHoneypot] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const mountedAt = useMemo(() => Date.now(), []);
  const errorRef = useRef<HTMLDivElement>(null);

  function toggleScope(name: string) {
    setScopes((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name]
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setFormError("");
    setFieldErrors({});

    try {
      const response = await fetch("/api/public/declarations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          alias,
          organizationScopes: scopes,
          statement,
          region: region === NO_REGION ? "" : region,
          wantsCertificate,
          website: honeypot,
          dwellMs: Date.now() - mountedAt
        })
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        fieldErrors?: { field: string; message: string }[];
        sequenceNumber?: string | null;
        createdAt?: string;
        wantsCertificate?: boolean;
      };

      if (!response.ok) {
        setFormError(payload.error || "提交未能完成，请稍后再试。");
        if (payload.fieldErrors) {
          setFieldErrors(
            Object.fromEntries(payload.fieldErrors.map((row) => [row.field, row.message]))
          );
        }
        errorRef.current?.focus();
        return;
      }

      setReceipt({
        sequenceNumber: payload.sequenceNumber ?? null,
        createdAt: payload.createdAt,
        wantsCertificate: payload.wantsCertificate
      });
    } catch {
      setFormError("网络连接未能完成。如果你正在使用翻墙工具，请稍后重试。");
      errorRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  if (receipt) {
    return <DeclareReceipt receipt={receipt} steps={copy.steps} />;
  }

  return (
    <>
      <div className="steps">
        {copy.steps.map((label, index) => (
          <div key={label} className={index === 0 ? "step on" : "step"}>
            {label}
          </div>
        ))}
      </div>

      {children}

      <form className="form" onSubmit={handleSubmit} noValidate>
        {formError ? (
          <div
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="notice"
            style={{ borderColor: "var(--seal)", marginBottom: 20 }}
          >
            <b>提交未完成</b>
            {formError}
          </div>
        ) : null}

        <div className="fgroup" role="group" aria-labelledby="declare-scopes-label">
          <label id="declare-scopes-label">
            你要退出哪些组织？<span style={{ color: "var(--seal)" }}>＊</span>
          </label>
          <p className="fhint">可多选。少先队、共青团、共产党分别对应「队」「团」「党」。</p>
          <div className="opts">
            {copy.organizations.map((item) => {
              const active = scopes.includes(item);
              return (
                <button
                  type="button"
                  key={item}
                  className={active ? "opt on" : "opt"}
                  aria-pressed={active}
                  onClick={() => toggleScope(item)}
                >
                  {item}
                </button>
              );
            })}
          </div>
          <FieldError message={fieldErrors.organizationScopes} />
        </div>

        <div className="fgroup">
          <label htmlFor="declare-alias">
            署名<span style={{ color: "var(--seal)" }}>＊</span>
          </label>
          <p className="fhint" id="declare-alias-hint">
            可以是真名、化名或代号。公开显示时会隐去部分字符，例如「李＊」。
          </p>
          <input
            id="declare-alias"
            name="alias"
            type="text"
            value={alias}
            maxLength={60}
            autoComplete="off"
            aria-describedby="declare-alias-hint"
            aria-invalid={Boolean(fieldErrors.alias)}
            onChange={(event) => setAlias(event.target.value)}
            placeholder="例如：李明 / 明月 / 一个北方人"
          />
          <FieldError message={fieldErrors.alias} />
        </div>

        <div className="fgroup">
          <label htmlFor="declare-region">所在地区</label>
          <p className="fhint" id="declare-region-hint">
            只需填到省或国家即可，不要填写详细地址。此项可留空。
          </p>
          <select
            id="declare-region"
            name="region"
            value={region}
            aria-describedby="declare-region-hint"
            onChange={(event) => setRegion(event.target.value)}
          >
            {copy.regionOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="fgroup">
          <label htmlFor="declare-statement">
            声明内容<span style={{ color: "var(--seal)" }}>＊</span>
          </label>
          <p className="fhint" id="declare-statement-hint">
            用你自己的话写。可以只写一句，也可以写下你的经历与想法。这段文字将原样保存并公开。
          </p>
          <textarea
            id="declare-statement"
            name="statement"
            value={statement}
            maxLength={4000}
            aria-describedby="declare-statement-hint"
            aria-invalid={Boolean(fieldErrors.statement)}
            onChange={(event) => setStatement(event.target.value)}
            placeholder="例如：我曾加入过少先队和共青团。在认清中共的本质后，特此郑重声明退出，彻底与其组织决裂。"
          />
          <FieldError message={fieldErrors.statement} />
        </div>

        <div className="fgroup" role="group" aria-labelledby="declare-cert-label">
          <label id="declare-cert-label">是否需要退党证明？</label>
          <p className="fhint">
            证明为中英文对照文件，免费办理。选择「需要」后，我们会在登记后与你确认领取方式。
          </p>
          <div className="opts">
            {copy.certificateOptions.map((item, index) => {
              const wants = index === 0;
              const active = wantsCertificate === wants;
              return (
                <button
                  type="button"
                  key={item}
                  className={active ? "opt on" : "opt"}
                  aria-pressed={active}
                  onClick={() => setWantsCertificate(wants)}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>

        {/* Honeypot. Hidden from sighted users and from screen readers alike, so
            only an automated form-filler will ever populate it. */}
        <div aria-hidden="true" style={{ position: "absolute", left: "-9999px" }}>
          <label htmlFor="declare-website">Website</label>
          <input
            id="declare-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(event) => setHoneypot(event.target.value)}
          />
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
            paddingTop: 8,
            borderTop: "1px solid var(--rule)",
            marginTop: 8
          }}
        >
          <button className="btn btn--seal" style={{ marginTop: 22 }} type="submit" disabled={submitting}>
            <span className="stamp">{copy.submitStamp}</span>
            {submitting ? "正在提交…" : copy.submitLabel}
          </button>
          <p
            style={{
              fontSize: 13,
              color: "var(--muted)",
              margin: "22px 0 0",
              lineHeight: 1.7,
              maxWidth: "34ch"
            }}
          >
            {copy.submitNote}
          </p>
        </div>
      </form>
    </>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" style={{ color: "var(--seal)", fontSize: 13, margin: "8px 0 0", lineHeight: 1.7 }}>
      {message}
    </p>
  );
}

function DeclareReceipt({ receipt, steps }: { receipt: Receipt; steps: string[] }) {
  return (
    <>
      <div className="steps">
        {steps.map((label, index) => (
          <div key={label} className={index === steps.length - 1 ? "step on" : "step"}>
            {label}
          </div>
        ))}
      </div>

      <div className="form" role="status" aria-live="polite">
        <p className="eyebrow" style={{ marginBottom: 16 }}>
          声明已登记
        </p>
        <h2 style={{ fontFamily: "var(--serif)", fontSize: 30, margin: "0 0 14px" }}>
          你的声明已经保存。
        </h2>

        {receipt.sequenceNumber ? (
          <p
            style={{
              fontFamily: "var(--mono)",
              fontSize: 26,
              color: "var(--seal)",
              margin: "0 0 6px"
            }}
          >
            No. {Number(receipt.sequenceNumber).toLocaleString("en-US")}
          </p>
        ) : null}

        <p style={{ color: "var(--muted)", lineHeight: 1.8 }}>
          这是你的登记编号。如果日后需要联系我们查询或更正，请记下它。我们不会向你索取
          任何身份证件或联系方式。
        </p>

        <div className="notice" style={{ marginTop: 24 }}>
          <b>关于你的安全</b>
          建议现在清除浏览器的历史记录与表单缓存。这个页面不会再次显示你的编号。
        </div>

        {receipt.wantsCertificate ? (
          <div className="notice" style={{ marginTop: 16 }}>
            <b>关于你申请的退党证明</b>
            我们已记下你需要一份证明。证明为免费办理，签发后可在查验页以编号核实真伪。
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 26 }}>
          <a className="btn btn--line" href="/services/verify">
            查验一份证明
          </a>
          <a className="btn btn--line" href="/involve">
            支持我们的工作
          </a>
        </div>
      </div>
    </>
  );
}
