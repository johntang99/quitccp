import { NextResponse } from "next/server";
import { checkRateLimit, clientFingerprint } from "@/lib/security/rate-limit";
import { verifyCertificate } from "@/lib/service/public-intake";
import { t } from "@/lib/i18n";

/**
 * Open certificate verification.
 *
 * The page tells receiving institutions this entry point needs no registration
 * or authorisation, so it stays unauthenticated. The rate limit is the only
 * thing standing between this and serial-number enumeration, so it is tighter
 * than the response cost alone would justify.
 */
const RATE_LIMIT = 20;
const RATE_WINDOW_SECONDS = 300;

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Expected application/json" }, { status: 415 });
  }

  const fingerprint = clientFingerprint(request);
  const limit = checkRateLimit(`verify:${fingerprint}`, RATE_LIMIT, RATE_WINDOW_SECONDS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: t("verify.tooMany") },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: t("verify.badRequest") }, { status: 400 });
  }

  const serial = typeof body.serialNumber === "string" ? body.serialNumber.trim() : "";
  const name = typeof body.holderName === "string" ? body.holderName.trim() : "";

  if (!serial) {
    return NextResponse.json(
      { error: t("verify.serialRequired"), fieldErrors: [{ field: "serialNumber", message: t("verify.serialRequired") }] },
      { status: 400 }
    );
  }
  if (serial.length > 64) {
    return NextResponse.json({ error: t("verify.serialBadFormat") }, { status: 400 });
  }

  try {
    const result = await verifyCertificate(serial, name, fingerprint);
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ error: t("verify.failed") }, { status: 500 });
  }
}
