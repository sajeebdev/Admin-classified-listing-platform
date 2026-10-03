/**
 * Thin fetch wrapper around the backend's standard `{ success, data }` /
 * `{ success: false, message, errors }` envelope (see docs/api.md). This is
 * a pure SPA — every call runs in the browser, so `credentials: "include"`
 * alone is enough for the httpOnly session cookies; there's no
 * server-rendered request to forward cookies for.
 *
 * In production `VITE_API_URL` is the relative `/api/v1` (see
 * .env.production), NOT the backend's own Render URL — `vercel.json`
 * rewrites that path to the real backend so the browser only ever talks to
 * this app's own origin. That's required, not just tidy: the backend's
 * auth cookie is `SameSite=None` (genuinely cross-site between the
 * Vercel and Render domains), and some mobile browsers (iOS Safari's
 * cross-site tracking prevention, in particular) block that cookie
 * outright — the login POST itself still succeeds, but the cookie never
 * gets stored, so every subsequent admin request comes back 401. Routing
 * through the same-origin proxy avoids the cross-site cookie entirely.
 * Local dev keeps calling the backend directly (both on localhost, already
 * same-site) since there's no Vercel rewrite in `vite dev`.
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";

/**
 * The public Next.js frontend's own origin — used only to build a link to
 * `/blog/preview/:id` (see BlogPostsPage.tsx/BlogPostFormPage.tsx). Set
 * `VITE_SITE_URL` to the public frontend domain in production; local dev
 * defaults to localhost.
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

/** Auth endpoints that must never trigger a silent refresh-and-retry — they either don't use the session, or *are* the session operation. */
const NO_REFRESH_PATHS = new Set(["/auth/login", "/auth/refresh", "/auth/logout"]);

let refreshInFlight: Promise<boolean> | null = null;

/**
 * The access-token cookie lives 15 minutes; the 30-day refresh-token cookie
 * is what's meant to keep staff signed in past that, but nothing ever
 * called `/auth/refresh` — so a moderator was silently logged out mid-review
 * every 15 minutes. Single-flight: the backend rotates refresh tokens and
 * treats a reused one as theft (revoking every session), so several
 * requests that 401 together must share one refresh call.
 */
function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE_URL}/auth/refresh`, { method: "POST", credentials: "include" })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

async function apiFetch<T>(path: string, options: ApiFetchOptions = {}, isRetry = false): Promise<T> {
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

  if (res.status === 401 && !isRetry && !NO_REFRESH_PATHS.has(path.split("?")[0]!) && (await refreshSession())) {
    return apiFetch<T>(path, options, true);
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
