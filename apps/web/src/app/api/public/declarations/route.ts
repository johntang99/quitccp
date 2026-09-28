import { NextResponse } from "next/server";
import { checkRateLimit, clientFingerprint } from "@/lib/security/rate-limit";
import { createPublicDeclaration, validateDeclaration } from "@/lib/service/public-intake";

/**
 * Anonymous 三退 declaration intake.
 *
 * No authentication by design -- the page promises submission without
 * registration and with no personal details required. Abuse control is a
 * per-window rate limit plus a honeypot, not a CAPTCHA (see rate-limit.ts).
 */

// A submitter writing a real statement takes far longer than this; anything
// faster is a script round-tripping the form.
const MIN_DWELL_MS = 3000;
const RATE_LIMIT = 5;
const RATE_WINDOW_SECONDS = 600;

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Expected application/json" }, { status: 415 });
  }

  const fingerprint = clientFingerprint(request);
  const limit = checkRateLimit(`declare:${fingerprint}`, RATE_LIMIT, RATE_WINDOW_SECONDS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "提交过于频繁，请稍后再试。" },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求格式有误。" }, { status: 400 });
  }

  // Honeypot: a field hidden from real users. Report success so a bot gets no
  // signal that it was caught, but write nothing.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true, sequenceNumber: null }, { status: 201 });
  }

  const dwellMs = Number(body.dwellMs);
  if (Number.isFinite(dwellMs) && dwellMs < MIN_DWELL_MS) {
    return NextResponse.json({ ok: true, sequenceNumber: null }, { status: 201 });
  }

  const input = {
    alias: typeof body.alias === "string" ? body.alias : "",
    organizationScopes: Array.isArray(body.organizationScopes)
      ? body.organizationScopes.filter((s): s is string => typeof s === "string")
      : [],
    statement: typeof body.statement === "string" ? body.statement : "",
    region: typeof body.region === "string" ? body.region : "",
    wantsCertificate: body.wantsCertificate === true
  };

  const errors = validateDeclaration(input);
  if (errors.length > 0) {
    return NextResponse.json({ error: "请检查填写内容。", fieldErrors: errors }, { status: 400 });
  }

  try {
    const receipt = await createPublicDeclaration(input, fingerprint);
    return NextResponse.json({ ok: true, ...receipt }, { status: 201 });
  } catch {
    // Never surface the underlying database error to an anonymous caller.
    return NextResponse.json({ error: "提交未能完成，请稍后再试。" }, { status: 500 });
  }
}
