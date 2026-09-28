import { NextResponse } from "next/server";
import { checkRateLimit, clientFingerprint } from "@/lib/security/rate-limit";
import { verifyCertificate } from "@/lib/service/public-intake";

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
      { error: "查验过于频繁，请稍后再试。" },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求格式有误。" }, { status: 400 });
  }

  const serial = typeof body.serialNumber === "string" ? body.serialNumber.trim() : "";
  const name = typeof body.holderName === "string" ? body.holderName.trim() : "";

  if (!serial) {
    return NextResponse.json(
      { error: "请输入证明编号。", fieldErrors: [{ field: "serialNumber", message: "请输入证明编号。" }] },
      { status: 400 }
    );
  }
  if (serial.length > 64) {
    return NextResponse.json({ error: "证明编号格式有误。" }, { status: 400 });
  }

  try {
    const result = await verifyCertificate(serial, name, fingerprint);
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ error: "查验未能完成，请稍后再试。" }, { status: 500 });
  }
}
