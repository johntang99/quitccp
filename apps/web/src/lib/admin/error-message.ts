/**
 * Supabase/PostgREST rejects with a plain `{ message, code, details, hint }`
 * object rather than an Error, so `error instanceof Error` is false and a naive
 * fallback swallows the only useful part. Pull the message out of either shape.
 */
export function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null) {
    const candidate = error as { message?: unknown; details?: unknown };
    if (typeof candidate.message === "string" && candidate.message) return candidate.message;
    if (typeof candidate.details === "string" && candidate.details) return candidate.details;
  }
  if (typeof error === "string" && error) return error;
  return fallback;
}
