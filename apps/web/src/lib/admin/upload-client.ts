"use client";

/**
 * Uploads a file from the browser straight to Supabase Storage.
 *
 * Three steps, two of which are tiny JSON calls to our own API:
 *
 *   1. ask for a ticket    -> POST /api/admin/content/uploads/sign
 *   2. PUT the bytes       -> Supabase Storage, directly
 *   3. record it           -> POST /api/admin/content/uploads/register
 *
 * Step 2 skips our server entirely, which is what makes a 60MB 展板 zip
 * possible: a serverless request body is capped around 4.5MB in production, so
 * anything bigger can never be sent through an API route of ours.
 *
 * XMLHttpRequest rather than fetch, because fetch cannot report upload
 * progress, and these transfers run tens of seconds -- long enough that a
 * spinner reads as a hang and someone navigates away mid-upload.
 */

export interface UploadResult {
  url: string;
  name: string;
  size: number;
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

export async function uploadFile(
  file: File,
  options: { folder: string; onProgress?: (percent: number) => void }
): Promise<UploadResult> {
  const signResponse = await fetch("/api/admin/content/uploads/sign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      size: file.size,
      folder: options.folder
    })
  });
  if (!signResponse.ok) throw new Error(await readError(signResponse, "无法创建上传链接。"));
  const { signedUrl, path } = (await signResponse.json()) as { signedUrl: string; path: string };

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", signedUrl, true);
    if (file.type) request.setRequestHeader("content-type", file.type);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new Error(`上传失败（${request.status}）。`));
    request.onerror = () => reject(new Error("上传中断，请检查网络后重试。"));
    request.send(file);
  });

  // Registering is what puts it in the media library; an upload that is not
  // recorded is a file nobody can find or delete later.
  const registerResponse = await fetch("/api/admin/content/uploads/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path, name: file.name, contentType: file.type })
  });
  if (!registerResponse.ok) throw new Error(await readError(registerResponse, "上传已完成，但未能登记。"));
  const { url } = (await registerResponse.json()) as { url: string };

  return { url, name: file.name, size: file.size };
}

/** "12.4 MB" — for progress text, where exactness is not the point. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
