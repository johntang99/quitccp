import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { decodeBase32, encodeBase32 } from "./base32";

const DIGITS = 6;
const STEP_SECONDS = 30;

function hotp(secret: Uint8Array, counter: number): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac("sha1", Buffer.from(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const codeInt =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const otp = (codeInt % 10 ** DIGITS).toString().padStart(DIGITS, "0");
  return otp;
}

function normalizeCode(code: string): string {
  return code.replace(/\s+/g, "").trim();
}

export function verifyTotpCode(secretBase32: string, inputCode: string, window = 1): boolean {
  const code = normalizeCode(inputCode);
  if (!/^\d{6}$/.test(code)) return false;

  const secret = decodeBase32(secretBase32);
  if (secret.length === 0) return false;

  const epochStep = Math.floor(Date.now() / 1000 / STEP_SECONDS);

  for (let drift = -window; drift <= window; drift++) {
    const expected = hotp(secret, epochStep + drift);
    const a = Buffer.from(code);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }

  return false;
}

export function generateTotpSecret(): string {
  return encodeBase32(randomBytes(20));
}
