import { ListingStatus, sanitizeListingDescriptionHtml } from "../shared";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FeaturedBadge, ListingStatusBadge, ModerationStatusBadge } from "../components/Badge";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ErrorState, LoadingState, UnavailableState } from "../components/States";
import { ApiClientError } from "../lib/api";
import {
  approveListing,
  getAdminListing,
  rejectListing,
  removeListing,
  restoreListing,
  setListingFeatured,
} from "../lib/listings";
import type { AdminListing } from "../lib/types";

/** `<input type="date">` needs `YYYY-MM-DD`; the API needs/returns a full ISO datetime — this is the one place that shape difference is bridged. */
function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

type Action = "approve" | "reject" | "remove" | "restore" | null;

const ACTIONABLE_STATUSES: ListingStatus[] = [
  ListingStatus.PENDING_REVIEW,
  ListingStatus.PUBLISHED,
  ListingStatus.REMOVED,
];

export function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [listing, setListing] = useState<AdminListing | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<Action>(null);
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Featured panel — local draft fields, only sent on an explicit Save (see
  // the panel below); reset from the real listing every time it (re)loads.
  const [featuredDraft, setFeaturedDraft] = useState(false);
  const [priorityDraft, setPriorityDraft] = useState("0");
  const [featuredUntilDraft, setFeaturedUntilDraft] = useState("");
  const [featuredSaving, setFeaturedSaving] = useState(false);
  const [featuredError, setFeaturedError] = useState<string | null>(null);

  // No synchronous reset before the fetch — see the matching comment in
  // CategoriesPage.tsx.
  function load() {
    if (!id) return;
    getAdminListing(id)
      .then((result) => {
        setListing(result);
        setFeaturedDraft(result.featured);
        setPriorityDraft(String(result.featuredPriority));
        setFeaturedUntilDraft(toDateInputValue(result.featuredUntil));
      })
      .catch((err) => setLoadError(err instanceof ApiClientError ? err.message : "Could not load this listing."));
  }

  useEffect(load, [id]);

  async function saveFeatured() {
    if (!id) return;
    setFeaturedSaving(true);
    setFeaturedError(null);
    try {
      const updated = await setListingFeatured(id, {
        featured: featuredDraft,
        priority: Math.min(1000, Math.max(0, Number(priorityDraft) || 0)),
        featuredUntil: featuredUntilDraft ? new Date(featuredUntilDraft).toISOString() : null,
      });
      // `updated` is the endpoint's raw saved-document response — it does
      // NOT have `category`/`location`/`seller` in the shaped form the rest
      // of this page renders (see `FeaturedUpdateResult`'s doc comment in
      // lib/listings.ts). `setListing(updated)` here previously replaced
      // the whole, correctly-shaped `listing` state with that raw response,
      // which crashed the next render (`listing.location.city` etc. against
      // an object that no longer had a `location` field) — a white screen
      // right after saving. Merging just the real Featured fields into the
      // existing state is both the fix and, incidentally, cheaper than a
      // full reload.
      setListing((prev) =>
        prev
          ? {
              ...prev,
              featured: updated.featured,
              featuredPriority: updated.featuredPriority,
              featuredAt: updated.featuredAt,
              featuredUntil: updated.featuredUntil,
            }
          : prev,
      );
      setFeaturedDraft(updated.featured);
      setPriorityDraft(String(updated.featuredPriority));
      setFeaturedUntilDraft(toDateInputValue(updated.featuredUntil));
    } catch (err) {
      setFeaturedError(err instanceof ApiClientError ? err.message : "Could not update Featured status.");
    } finally {
      setFeaturedSaving(false);
    }
  }

  async function confirmAction() {
    if (!id || !pendingAction) return;
    if (pendingAction === "reject" && !reason.trim()) {
      setActionError("A reason is required to reject a listing.");
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      if (pendingAction === "approve") await approveListing(id);
      else if (pendingAction === "reject") await rejectListing(id, reason);
      else if (pendingAction === "remove") await removeListing(id, reason || undefined);
      else if (pendingAction === "restore") await restoreListing(id);
      setPendingAction(null);
      setReason("");
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "That action could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  if (loadError) return <ErrorState message={loadError} />;
  if (!listing) return <LoadingState />;

  return (
    <div className="max-w-3xl space-y-6">
      <button type="button" onClick={() => navigate("/listings")} className="text-sm text-blue-600 hover:underline">
        &larr; Back to listings
      </button>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-900">{listing.title}</h1>
          <ListingStatusBadge status={listing.status} />
          <ModerationStatusBadge status={listing.moderationStatus} />
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {listing.category?.name} / {listing.subcategory?.name} ·{" "}
          {[listing.location.city?.name, listing.location.state?.name, listing.location.country?.name]
            .filter(Boolean)
            .join(", ")}
        </p>
        {listing.rejectionReason ? (
          <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Rejection reason: {listing.rejectionReason}</p>
        ) : null}

        {listing.images.length > 0 ? (
          <div className="mt-4 flex gap-2 overflow-x-auto">
            {listing.images.map((img, i) => (
              <img key={i} src={img.url} alt={img.alt ?? ""} className="h-24 w-32 flex-shrink-0 rounded-md object-cover" />
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-400">No images.</p>
        )}

        {/* Read-only rich-text rendering, same sanitize-then-render approach
            as the public listing page — no separate formatting system for
            admin (see docs/listings.md). There is no admin content-edit UI
            for the description today (only moderation actions below), so
            this is display-only. */}
        <div
          className="prose-blog mt-4 max-w-none whitespace-pre-line text-sm text-slate-700"
          dangerouslySetInnerHTML={{ __html: sanitizeListingDescriptionHtml(listing.description) }}
        />

        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-slate-500">Seller</dt>
            <dd className="font-medium text-slate-900">{listing.seller?.displayName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Post ID</dt>
            <dd className="font-mono text-xs text-slate-700">{listing.id}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-slate-900">Featured</h2>
          <FeaturedBadge featured={listing.featured} />
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Independent of moderation — a listing must be Published to be featured, but featuring it never
          changes its status. Unfeaturing (or letting Featured Until pass) never affects publication.
        </p>

        {listing.status !== ListingStatus.PUBLISHED && !listing.featured ? (
          <p className="mt-3 text-sm text-slate-500">Only a Published listing can be featured.</p>
        ) : (
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
              <input
                type="checkbox"
                checked={featuredDraft}
                disabled={featuredSaving}
                onChange={(e) => setFeaturedDraft(e.target.checked)}
              />
              Featured
            </label>
            <div>
              <label htmlFor="featured-priority" className="mb-1 block text-xs font-medium text-slate-500">
                Priority (0-1000)
              </label>
              <input
                id="featured-priority"
                type="number"
                min={0}
                max={1000}
                value={priorityDraft}
                disabled={featuredSaving}
                onChange={(e) => setPriorityDraft(e.target.value)}
                className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="featured-until" className="mb-1 block text-xs font-medium text-slate-500">
                Featured until (optional)
              </label>
              <input
                id="featured-until"
                type="date"
                value={featuredUntilDraft}
                disabled={featuredSaving}
                onChange={(e) => setFeaturedUntilDraft(e.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={saveFeatured}
              disabled={featuredSaving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {featuredSaving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
        {featuredError ? <p className="mt-2 text-sm text-red-600">{featuredError}</p> : null}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Moderation actions</h2>
        {actionError ? <p role="alert" className="mb-3 text-sm text-red-600">{actionError}</p> : null}
        <div className="flex flex-wrap gap-2">
          {listing.status === ListingStatus.PENDING_REVIEW ? (
            <>
              <button
                type="button"
                onClick={() => setPendingAction("approve")}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => setPendingAction("reject")}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Reject
              </button>
            </>
          ) : null}
          {listing.status === ListingStatus.PUBLISHED ? (
            <button
              type="button"
              onClick={() => setPendingAction("remove")}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Remove
            </button>
          ) : null}
          {listing.status === ListingStatus.REMOVED ? (
            <button
              type="button"
              onClick={() => setPendingAction("restore")}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              Restore
            </button>
          ) : null}
          {!ACTIONABLE_STATUSES.includes(listing.status) ? (
            <p className="text-sm text-slate-500">No moderation action applies to a {listing.status} listing.</p>
          ) : null}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-base font-semibold text-slate-900">Moderation history</h2>
        {/* No GET endpoint exists to read ModerationLog entries back — see docs/api.md. Entries are recorded server-side on every action but not yet queryable. */}
        <UnavailableState label="Moderation history" />
      </div>

      <ConfirmDialog
        open={pendingAction !== null}
        title={
          pendingAction === "approve"
            ? "Approve this listing?"
            : pendingAction === "reject"
              ? "Reject this listing"
              : pendingAction === "remove"
                ? "Remove this listing?"
                : "Restore this listing?"
        }
        description={
          pendingAction === "approve"
            ? "It will become publicly visible."
            : pendingAction === "remove"
              ? "It will be taken down from public view."
              : pendingAction === "restore"
                ? "It will become publicly visible again."
                : undefined
        }
        confirmLabel={pendingAction === "reject" ? "Reject" : "Confirm"}
        danger={pendingAction === "reject" || pendingAction === "remove"}
        busy={busy}
        onConfirm={confirmAction}
        onCancel={() => {
          setPendingAction(null);
          setReason("");
        }}
      >
        {pendingAction === "reject" ? (
          <div>
            <label htmlFor="reject-reason" className="mb-1 block text-sm font-medium text-slate-700">
              Reason (required)
            </label>
            <textarea
              id="reject-reason"
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        ) : null}
        {pendingAction === "remove" ? (
          <div>
            <label htmlFor="remove-reason" className="mb-1 block text-sm font-medium text-slate-700">
              Reason (optional)
            </label>
            <textarea
              id="remove-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
