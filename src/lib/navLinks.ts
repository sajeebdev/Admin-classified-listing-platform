import { api, toQueryString } from "./api";
import type { NavLinkSummary, PaginatedResult } from "./types";

export interface NavLinkInput {
  label: string;
  url: string;
  sortOrder?: number;
  openInNewTab?: boolean;
  isActive?: boolean;
}

// List endpoints (paginated) return the result directly; single-resource
// endpoints wrap their payload as `{ link: ... }` (see navLink.controller.ts)
// — unwrapped here, same convention as `categories.ts`.

export function listAdminNavLinks(params: { page?: number; limit?: number } = {}) {
  const qs = toQueryString({ page: params.page, limit: params.limit });
  return api.get<PaginatedResult<NavLinkSummary>>(`/admin/nav-links${qs}`);
}

export async function createNavLink(input: NavLinkInput): Promise<NavLinkSummary> {
  const { link } = await api.post<{ link: NavLinkSummary }>("/admin/nav-links", input);
  return link;
}

export async function updateNavLink(id: string, input: Partial<NavLinkInput>): Promise<NavLinkSummary> {
  const { link } = await api.patch<{ link: NavLinkSummary }>(`/admin/nav-links/${id}`, input);
  return link;
}

/** Deactivates (never hard-deletes) the link — see `navLink.service.ts#deactivateNavLink`. */
export async function deactivateNavLink(id: string): Promise<NavLinkSummary> {
  const { link } = await api.delete<{ link: NavLinkSummary }>(`/admin/nav-links/${id}`);
  return link;
}
