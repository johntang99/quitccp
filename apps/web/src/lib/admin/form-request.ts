/**
 * Read a form POST without crashing on a body that is not a form.
 *
 * `request.formData()` throws when the body is JSON or anything else it cannot
 * parse, and an uncaught throw in a route handler is a 500. A caller sending the
 * wrong content type made a bad request, not a server error: 500 tells them to
 * retry and tells us nothing, while 400 says what happened. The login route
 * already guarded this by hand; this is the same check in one place.
 *
 * Returns the parsed form, or null when the body is not form-encoded.
 */
export async function readFormData(request: Request): Promise<FormData | null> {
  const contentType = request.headers.get("content-type") ?? "";
  if (
    !contentType.includes("multipart/form-data") &&
    !contentType.includes("application/x-www-form-urlencoded")
  ) {
    return null;
  }
  try {
    return await request.formData();
  } catch {
    // Declared as a form but malformed -- a truncated upload, a bad boundary.
    return null;
  }
}
