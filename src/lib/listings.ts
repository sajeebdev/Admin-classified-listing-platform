import type { ListingStatus, ModerationStatus } from "../shared";
import { api, toQueryString } from "./api";
import type { AdminListing, PaginatedResult } from "./types";

export interface AdminListingQuery {
  status?: ListingStatus;
  moderationStatus?: ModerationStatus;
  ownerId?: string;
  featured?: boolean;
  /** Powers the "Imported Listings" view (see docs/importer.md) — `true` shows only listings with a `source`, `false` only ordinary ones. */
  imported?: boolean;
  page?: number;
  limit?: number;
}

export function listAdminListings(query: AdminListingQuery = {}) {
  const qs = toQueryString({
    status: query.status,
    moderationStatus: query.moderationStatus,
    ownerId: query.ownerId,
    featured: query.featured === undefined ? undefined : String(query.featured),
    imported: query.imported === undefined ? undefined : String(query.imported),
    page: query.page,
    limit: query.limit,
  });
  return api.get<PaginatedResult<AdminListing>>(`/admin/listings${qs}`);
}

// Single-listing endpoints wrap their payload as `{ listing: ... }` (see
// listing.controller.ts) — unwrapped here so every caller works with the
// plain object.
//
// Only `GET /admin/listings/:id` returns the fully shaped `AdminListing`
// (via `toOwnerListing`). Every mutation below returns the backend's raw
// saved document — scalar fields (`title`, `status`, ...) are accurate, but
// `category`/`location`/`seller` are not in the shaped form, so a caller
// must never put a mutation's result into state as a whole `AdminListing`;
// merge the scalar fields it changed, or re-fetch.

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

export interface AdminUpdateListingInput {
  title?: string;
  description?: string;
  price?: number;
}

/** Staff-facing edit — works on any listing regardless of owner, most notably an imported one (see docs/importer.md, `adminUpdateListing` in listing.service.ts). */
export async function adminUpdateListing(id: string, input: AdminUpdateListingInput): Promise<AdminListing> {
  const { listing } = await api.patch<{ listing: AdminListing }>(`/admin/listings/${id}`, input);
  return listing;
}

/** DRAFT/REJECTED -> PENDING_REVIEW, without an ownership check — the only way an imported listing (owned by the system import account) enters the moderation queue. */
export async function adminSubmitListing(id: string): Promise<AdminListing> {
  const { listing } = await api.post<{ listing: AdminListing }>(`/admin/listings/${id}/submit`);
  return listing;
}

/** Discards a listing regardless of owner — used to reject an imported DRAFT nobody wants to publish. */
export async function adminArchiveListing(id: string): Promise<AdminListing> {
  const { listing } = await api.post<{ listing: AdminListing }>(`/admin/listings/${id}/archive`);
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
 * Mongoose document itself, not a ref-populated shape) — like every other
 * mutation here, and unlike `GET /admin/listings/:id`, which goes through
 * `toOwnerListing` and returns the full `AdminListing` shape. This
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
