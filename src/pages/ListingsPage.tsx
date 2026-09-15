import { ListingStatus, ModerationStatus } from "../shared";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FeaturedBadge, ListingStatusBadge, ModerationStatusBadge } from "../components/Badge";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { Pagination } from "../components/Pagination";
import { listAdminListings } from "../lib/listings";
import type { AdminListing } from "../lib/types";

/**
 * Category/location filters aren't offered here — the admin listings
 * endpoint only supports `status`/`moderationStatus`/`ownerId` (see
 * docs/api.md's admin listing query). Adding those would mean extending
 * the backend query schema beyond what this phase's brief called for;
 * documented as a known limitation in docs/progress.md rather than
 * building a filter control against a parameter the API silently ignores.
 */
export function ListingsPage() {
  const [status, setStatus] = useState<ListingStatus | "">("");
  const [moderationStatus, setModerationStatus] = useState<ModerationStatus | "">("");
  const [ownerId, setOwnerId] = useState("");
  const [featured, setFeatured] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(1);
  const [listings, setListings] = useState<AdminListing[] | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // No synchronous reset before the fetch — see the matching comment in
  // CategoriesPage.tsx. The previous page's results simply stay on screen
  // until the new filter's results (or an error) arrive.
  useEffect(() => {
    let cancelled = false;
    listAdminListings({
      status: status || undefined,
      moderationStatus: moderationStatus || undefined,
      ownerId: ownerId || undefined,
      featured: featured === "" ? undefined : featured === "true",
      page,
      limit: 20,
    })
      .then((result) => {
        if (cancelled) return;
        setListings(result.items);
        setTotalPages(result.totalPages);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load listings.");
      });
    return () => {
      cancelled = true;
    };
  }, [status, moderationStatus, ownerId, featured, page]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Listings management</h1>

      <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <label htmlFor="status-filter" className="mb-1 block text-xs font-medium text-slate-500">
            Status
          </label>
          <select
            id="status-filter"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as ListingStatus | "");
            }}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">All statuses</option>
            {Object.values(ListingStatus).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="moderation-filter" className="mb-1 block text-xs font-medium text-slate-500">
            Moderation status
          </label>
          <select
            id="moderation-filter"
            value={moderationStatus}
            onChange={(e) => {
              setPage(1);
              setModerationStatus(e.target.value as ModerationStatus | "");
            }}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">All moderation statuses</option>
            {Object.values(ModerationStatus).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="owner-filter" className="mb-1 block text-xs font-medium text-slate-500">
            Owner ID
          </label>
          <input
            id="owner-filter"
            value={ownerId}
            onChange={(e) => {
              setPage(1);
              setOwnerId(e.target.value);
            }}
            placeholder="Mongo ObjectId"
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="featured-filter" className="mb-1 block text-xs font-medium text-slate-500">
            Featured
          </label>
          <select
            id="featured-filter"
            value={featured}
            onChange={(e) => {
              setPage(1);
              setFeatured(e.target.value as "" | "true" | "false");
            }}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">All listings</option>
            <option value="true">Featured only</option>
            <option value="false">Not featured</option>
          </select>
        </div>
      </div>

      {error ? <ErrorState message={error} /> : null}
      {!error && listings === null ? <LoadingState /> : null}
      {!error && listings !== null && listings.length === 0 ? <EmptyState title="No listings match these filters." /> : null}

      {!error && listings && listings.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Moderation</th>
                <th className="px-4 py-2">Featured</th>
                <th className="px-4 py-2">Seller</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listings.map((listing) => (
                <tr key={listing.id}>
                  <td className="max-w-xs truncate px-4 py-3 font-medium text-slate-900">{listing.title}</td>
                  <td className="px-4 py-3">
                    <ListingStatusBadge status={listing.status} />
                  </td>
                  <td className="px-4 py-3">
                    <ModerationStatusBadge status={listing.moderationStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <FeaturedBadge featured={listing.featured} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">{listing.seller?.displayName ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/listings/${listing.id}`} className="text-blue-600 hover:underline">
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}
