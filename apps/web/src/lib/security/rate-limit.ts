import { createHash } from "node:crypto";

/**
 * Fixed-window limiter held in process memory.
 *
 * LIMITATION: the window is per Node instance, so N instances allow N x limit.
 * It is enough to stop a single client hammering the public intake endpoints,
 * and it deliberately requires no external service -- a Redis hop or a hosted
 * CAPTCHA would be another network dependency, and for submitters behind the
 * GFW every extra third-party origin is another thing that can be blocked or
 * observed. Move to a shared store if this ever runs multi-instance.
 */
interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();
const MAX_TRACKED_KEYS = 10_000;

function sweep(now: number) {
  if (windows.size < MAX_TRACKED_KEYS) return;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = windows.get(key);
  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
    };
  }
  return { allowed: true, remaining: limit - existing.count, retryAfterSeconds: 0 };
}

/**
 * Salted, truncated hash of the client address.
 *
 * Raw IPs are never persisted or logged anywhere in the public intake path.
 * Submitters in mainland China face real consequences if this data leaks, so
 * the address is reduced to an abuse-throttling token and nothing more. Without
 * a configured salt we fall back to a per-process random value, which keeps the
 * hash unusable across restarts.
 */
const processSalt = createHash("sha256").update(String(Math.random())).digest("hex");

export function clientFingerprint(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const address = forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const salt = process.env.INTAKE_HASH_SALT || processSalt;
  return createHash("sha256").update(`${salt}:${address}`).digest("hex").slice(0, 32);
}
