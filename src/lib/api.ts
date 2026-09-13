/**
 * Thin fetch wrapper around the backend's standard `{ success, data }` /
 * `{ success: false, message, errors }` envelope (see docs/api.md). Unlike
 * the Next.js frontend, this is a pure SPA — every call runs in the
 * browser, so `credentials: "include"` alone is enough for the httpOnly
 * session cookies; there's no server-rendered request to forward cookies
 * for.
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";

/**
 * The public Next.js frontend's own origin — used only to build a link to
 * `/blog/preview/:id` (see BlogPostsPage.tsx/BlogPostFormPage.tsx). Not a
 * fabricated production domain, same convention as the frontend app's own
 * `NEXT_PUBLIC_SITE_URL` fallback (see frontend/src/lib/utils/seo.ts) —
 * this just needs to agree with wherever that app actually runs.
 */
export const SITE_URL = (import.meta.env.VITE_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export class ApiClientError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(message: string, status: number, errors?: Record<string, string[]>) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.errors = errors;
  }
}

interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const finalHeaders = new Headers(headers);
  const hasBody = body !== undefined;
  // `FormData` (blog featured-image upload — see lib/blog.ts) must NOT be
  // JSON-stringified, and must NOT get an explicit Content-Type — the
  // browser sets `multipart/form-data; boundary=...` itself only when it
  // controls the header entirely. Mirrors the Next.js frontend's identical
  // handling in lib/api/client.ts.
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (hasBody && !isFormData && !finalHeaders.has("Content-Type")) {
    finalHeaders.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: finalHeaders,
      credentials: "include",
      body: hasBody ? (isFormData ? (body as FormData) : JSON.stringify(body)) : undefined,
    });
  } catch {
    throw new ApiClientError(
      "Could not reach the server. Please check your connection and try again.",
      0,
    );
  }

  const responseBody = await res.json().catch(() => null);

  if (!res.ok || !responseBody || responseBody.success === false) {
    const message =
      (responseBody && typeof responseBody.message === "string" && responseBody.message) ||
      `Request failed with status ${res.status}`;
    throw new ApiClientError(message, res.status, responseBody?.errors);
  }

  return responseBody.data as T;
}

export const api = {
  get: <T>(path: string, options?: ApiFetchOptions) => apiFetch<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: ApiFetchOptions) =>
    apiFetch<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: ApiFetchOptions) =>
    apiFetch<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: ApiFetchOptions) =>
    apiFetch<T>(path, { ...options, method: "DELETE" }),
};

export function toQueryString(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}
