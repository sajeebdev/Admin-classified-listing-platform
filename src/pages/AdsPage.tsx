import { AdPlacement, AdStatus } from "@classified-marketplace/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AdStatusBadge } from "../components/Badge";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Pagination } from "../components/Pagination";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { deleteAd, getAdsOverview, listAdminAds, updateAd } from "../lib/ads";
import type { AdminAd, AdsOverview } from "../lib/types";

type PendingAction = { kind: "delete" | "pause" | "resume"; ad: AdminAd } | null;

const actionCopy: Record<
  "delete" | "pause" | "resume",
  { title: (ad: AdminAd) => string; description: string; confirmLabel: string; danger: boolean }
> = {
  delete: {
    title: (ad) => `Delete "${ad.title}"?`,
    description: "This permanently deletes the ad and its uploaded image. This cannot be undone.",
    confirmLabel: "Delete",
    danger: true,
  },
  pause: {
    title: (ad) => `Pause "${ad.title}"?`,
    description: "It stops appearing on the public site immediately.",
    confirmLabel: "Pause",
    danger: true,
  },
  resume: {
    title: (ad) => `Resume "${ad.title}"?`,
    description: "It becomes eligible to appear on the public site again (if its dates currently qualify).",
    confirmLabel: "Resume",
    danger: false,
  },
};

/**
 * Mirrors `BlogPostsPage.tsx`'s established shape (overview cards +
 * filters + table + `ConfirmDialog` + `Pagination`) — the same layout this
 * dashboard already uses everywhere else, just with ad-specific columns
 * (Impressions/Clicks/CTR) and an aggregate overview row per the brief's
 * "Admin Analytics UI" section.
 */
export function AdsPage() {
  const [status, setStatus] = useState<AdStatus | "">("");
  const [placement, setPlacement] = useState<AdPlacement | "">("");
  const [page, setPage] = useState(1);

  const [overview, setOverview] = useState<AdsOverview | null>(null);
  const [ads, setAds] = useState<AdminAd[] | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    listAdminAds({
      status: status || undefined,
      placement: placement || undefined,
      page,
      limit: 20,
    })
      .then((result) => {
        setAds(result.items);
        setTotalPages(result.totalPages);
        setLoadError(null);
      })
      .catch(() => setLoadError("Could not load ads."));
  }

  useEffect(load, [status, placement, page]);

  useEffect(() => {
    getAdsOverview()
      .then(setOverview)
      .catch(() => {
        // The overview cards are a nice-to-have summary — the table above
        // (loaded independently) is what actually matters if this fails.
      });
  }, [ads]);

  async function confirmAction() {
    if (!pendingAction) return;
    setBusy(true);
    setActionError(null);
    try {
      if (pendingAction.kind === "delete") await deleteAd(pendingAction.ad.id);
      else await updateAd(pendingAction.ad.id, { status: pendingAction.kind === "pause" ? "PAUSED" : "ACTIVE" });
      setPendingAction(null);
      load();
    } catch {
      setActionError("That action could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  const copy = pendingAction ? actionCopy[pendingAction.kind] : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Ads</h1>
        <Link
          to="/ads/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New ad
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: "Total ads", value: overview?.totalAds },
          { label: "Active ads", value: overview?.activeAds },
          { label: "Total impressions", value: overview?.totalImpressions },
          { label: "Total clicks", value: overview?.totalClicks },
          { label: "Average CTR", value: overview ? `${overview.averageCtr}%` : undefined },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-2xl font-semibold text-slate-900">
              {card.value === undefined ? "…" : typeof card.value === "number" ? card.value.toLocaleString() : card.value}
            </p>
            <p className="text-sm text-slate-500">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <label htmlFor="ad-status-filter" className="mb-1 block text-xs font-medium text-slate-500">
            Status
          </label>
          <select
            id="ad-status-filter"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as AdStatus | "");
            }}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">All statuses</option>
            {Object.values(AdStatus).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ad-placement-filter" className="mb-1 block text-xs font-medium text-slate-500">
            Placement
          </label>
          <select
            id="ad-placement-filter"
            value={placement}
            onChange={(e) => {
              setPage(1);
              setPlacement(e.target.value as AdPlacement | "");
            }}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">All placements</option>
            {Object.values(AdPlacement).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loadError ? <ErrorState message={loadError} /> : null}
      {actionError ? <ErrorState message={actionError} /> : null}
      {!loadError && ads === null ? <LoadingState /> : null}
      {!loadError && ads !== null && ads.length === 0 ? (
        <EmptyState title="No ads match these filters." />
      ) : null}

      {!loadError && ads && ads.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Placement</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Impressions</th>
                <th className="px-4 py-2">Clicks</th>
                <th className="px-4 py-2">CTR</th>
                <th className="px-4 py-2">Start</th>
                <th className="px-4 py-2">End</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ads.map((ad) => (
                <tr key={ad.id}>
                  <td className="max-w-xs truncate px-4 py-3 font-medium text-slate-900">{ad.title}</td>
                  <td className="px-4 py-3 text-slate-600">{ad.placement}</td>
                  <td className="px-4 py-3">
                    <AdStatusBadge status={ad.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{ad.impressions.toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-600">{ad.clicks.toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-600">{ad.ctr}%</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(ad.startAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-slate-500">{ad.endAt ? new Date(ad.endAt).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-3 whitespace-nowrap">
                      <Link to={`/ads/${ad.id}/edit`} className="text-blue-600 hover:underline">
                        Edit
                      </Link>
                      {ad.status === "PAUSED" ? (
                        <button
                          type="button"
                          onClick={() => setPendingAction({ kind: "resume", ad })}
                          className="text-green-600 hover:underline"
                        >
                          Resume
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPendingAction({ kind: "pause", ad })}
                          className="text-slate-600 hover:underline"
                        >
                          Pause
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setPendingAction({ kind: "delete", ad })}
                        className="text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      <ConfirmDialog
        open={pendingAction !== null}
        title={copy && pendingAction ? copy.title(pendingAction.ad) : ""}
        description={copy?.description}
        confirmLabel={copy?.confirmLabel}
        danger={copy?.danger}
        busy={busy}
        onConfirm={confirmAction}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
