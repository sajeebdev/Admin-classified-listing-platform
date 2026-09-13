import type { ListingStatus, ModerationStatus } from "@classified-marketplace/shared";
import { api, toQueryString } from "./api";
import type { AdminListing, PaginatedResult } from "./types";

export interface AdminListingQuery {
  status?: ListingStatus;
  moderationStatus?: ModerationStatus;
  ownerId?: string;
  featured?: boolean;
  page?: number;
  limit?: number;
}

export function listAdminListings(query: AdminListingQuery = {}) {
  const qs = toQueryString({
    status: query.status,
    moderationStatus: query.moderationStatus,
    ownerId: query.ownerId,
    featured: query.featured === undefined ? undefined : String(query.featured),
    page: query.page,
    limit: query.limit,
  });
  return api.get<PaginatedResult<AdminListing>>(`/admin/listings${qs}`);
}

// Single-listing endpoints wrap their payload as `{ listing: ... }` (see
// listing.controller.ts) — unwrapped here so every caller works with the
// plain object.

export async function getAdminListing(id: string): Promise<AdminListing> {
  const { listing } = await api.get<{ listing: AdminListing }>(`/admin/listings/${id}`);
  return listing;
}

export async function approveListing(id: string): Promise<AdminListing> {
  const { listing } = await api.post<{ listing: AdminListing }>(`/admin/listings/${id}/approve`);
  return listing;
}

export async function rejectListing(id: string, reason: string): Promise<AdminListing> {
  const { listing } = await api.post<{ listing: AdminListing }>(`/admin/listings/${id}/reject`, { reason });
  return listing;
}

export async function removeListing(id: string, reason?: string): Promise<AdminListing> {
  const { listing } = await api.post<{ listing: AdminListing }>(
    `/admin/listings/${id}/remove`,
    reason ? { reason } : undefined,
  );
  return listing;
}

export async function restoreListing(id: string): Promise<AdminListing> {
  const { listing } = await api.post<{ listing: AdminListing }>(`/admin/listings/${id}/restore`);
  return listing;
}

export interface UpdateFeaturedInput {
  featured: boolean;
  priority?: number;
  /** `null` explicitly clears an existing expiry; `undefined` leaves it unchanged. */
  featuredUntil?: string | null;
}

/**
 * `PATCH /admin/listings/:id/featured` returns the backend's *raw* saved
 * listing document (`listing.service.ts#setListingFeatured` returns the
 * Mongoose document itself, not a ref-populated shape) — unlike `GET
 * /admin/listings/:id` and the approve/reject/remove/restore endpoints,
 * which all go through `toOwnerListing` and return the full `AdminListing`
 * shape (`category`/`location`/`seller` as populated ref objects). This
 * type only claims the fields that are genuinely safe to read off the raw
 * document: `id` and the plain scalar/date Featured fields themselves —
 * `category`/`location`/`seller`/`images` are present at runtime as raw
 * ObjectIds/sub-documents, not the `AdminListing` shape, so a caller must
 * never treat this as a full `AdminListing` (see `ListingDetailPage.tsx`'s
 * `saveFeatured`, which merges just these fields into its already-shaped
 * `listing` state instead of replacing it wholesale).
 */
export interface FeaturedUpdateResult {
  id: string;
  featured: boolean;
  featuredPriority: number;
  featuredAt: string | null;
  featuredUntil: string | null;
}

export async function setListingFeatured(id: string, input: UpdateFeaturedInput): Promise<FeaturedUpdateResult> {
  const { listing } = await api.patch<{ listing: FeaturedUpdateResult }>(`/admin/listings/${id}/featured`, input);
  return listing;
}
