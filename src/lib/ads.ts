import type { AdPlacement, AdStatus } from "../shared";
import { api, toQueryString } from "./api";
import type { AdminAd, AdsOverview, AdStats, PaginatedResult } from "./types";

export interface AdminAdQuery {
  status?: AdStatus;
  placement?: AdPlacement;
  page?: number;
  limit?: number;
}

export function listAdminAds(query: AdminAdQuery = {}) {
  const qs = toQueryString({
    status: query.status,
    placement: query.placement,
    page: query.page,
    limit: query.limit,
  });
  return api.get<PaginatedResult<AdminAd>>(`/admin/ads${qs}`);
}

export function getAdsOverview() {
  return api.get<AdsOverview>("/admin/ads/overview");
}

export async function getAdminAd(id: string): Promise<AdminAd> {
  const { ad } = await api.get<{ ad: AdminAd }>(`/admin/ads/${id}`);
  return ad;
}

export function getAdStats(id: string) {
  return api.get<AdStats>(`/admin/ads/${id}/stats`);
}

/**
 * Matches `createAdSchema`/`updateAdSchema` in ad.validation.ts — no
 * `id`/`impressions`/`clicks`/timestamps field exists here at all, the same
 * "not a field a client can set" convention every other admin form in this
 * app already follows (see `BlogPostInput`).
 */
export interface AdInput {
  title?: string;
  imageUrl?: string;
  imageAlt?: string;
  targetUrl?: string;
  placement?: AdPlacement;
  status?: "ACTIVE" | "PAUSED";
  startAt?: string;
  endAt?: string | null;
  priority?: number;
  openInNewTab?: boolean;
}

export async function createAd(input: AdInput): Promise<AdminAd> {
  const { ad } = await api.post<{ ad: AdminAd }>("/admin/ads", input);
  return ad;
}

export async function updateAd(id: string, input: AdInput): Promise<AdminAd> {
  const { ad } = await api.patch<{ ad: AdminAd }>(`/admin/ads/${id}`, input);
  return ad;
}

export async function deleteAd(id: string): Promise<void> {
  await api.delete<null>(`/admin/ads/${id}`);
}

export async function uploadAdImage(file: File): Promise<{ url: string; key: string }> {
  const formData = new FormData();
  formData.set("image", file);
  return api.post<{ url: string; key: string }>("/admin/ads/images", formData);
}
