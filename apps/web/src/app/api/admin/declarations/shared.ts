import { NextResponse } from "next/server";

/**
 * `request.formData()` throws on an unexpected content-type, which surfaces as
 * a 500. Callers turn a null return into a 415 instead.
 */
export async function readAdminForm(request: Request): Promise<FormData | null> {
  const contentType = request.headers.get("content-type") ?? "";
  if (
    !contentType.includes("multipart/form-data") &&
    !contentType.includes("application/x-www-form-urlencoded")
  ) {
    return null;
  }
  return request.formData();
}

/**
 * Sends the operator back to the page they acted from, preserving their filter
 * and page position, with a one-line result banner.
 *
 * `returnTo` is taken from the submitted form rather than the Referer header,
 * and only its query string is used, so it cannot be turned into an open
 * redirect to another host.
 */
export function redirectBackToQueue(
  request: Request,
  formData: FormData,
  result: { ok?: string; error?: string }
): NextResponse {
  const raw = String(formData.get("returnTo") ?? "");
  const params = new URLSearchParams();

  if (raw.startsWith("?")) {
    for (const [key, value] of new URLSearchParams(raw.slice(1))) {
      if (key !== "ok" && key !== "error") params.set(key, value);
    }
  }
  if (result.ok) params.set("ok", result.ok);
  if (result.error) params.set("error", result.error);

  const query = params.toString();
  const target = query ? `/admin/declarations?${query}` : "/admin/declarations";
  return NextResponse.redirect(new URL(target, request.url), 303);
}
