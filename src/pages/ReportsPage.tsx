import { ReportStatus } from "@classified-marketplace/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../components/Badge";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Pagination } from "../components/Pagination";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { listAdminReports, reviewReport } from "../lib/reports";
import type { AdminReport } from "../lib/types";

const statusTone: Record<ReportStatus, "yellow" | "green" | "neutral"> = {
  PENDING: "yellow",
  REVIEWED: "green",
  DISMISSED: "neutral",
};

const reasonLabels: Record<string, string> = {
  SPAM: "Spam",
  SCAM: "Scam or fraud",
  PROHIBITED_CONTENT: "Prohibited content",
  HARASSMENT: "Harassment or abuse",
  DUPLICATE_LISTING: "Duplicate listing",
  MISLEADING_INFORMATION: "Misleading information",
  OTHER: "Other",
};

/**
 * Deliberately simple, per the brief: list, filter by status, and let staff
 * mark a report reviewed or dismissed. Taking actual action on the listing
 * itself (approve/reject/remove) stays on the existing moderation detail
 * page (`ListingDetailPage`) — linked from each row rather than duplicated
 * here (see docs/media.md).
 */
export function ReportsPage() {
  const [status, setStatus] = useState<ReportStatus | "">("");
  const [page, setPage] = useState(1);
  const [reports, setReports] = useState<AdminReport[] | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ report: AdminReport; next: "REVIEWED" | "DISMISSED" } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  function load() {
    listAdminReports({ status: status || undefined, page, limit: 20 })
      .then((result) => {
        setReports(result.items);
        setTotalPages(result.totalPages);
      })
      .catch(() => setError("Could not load reports."));
  }

  useEffect(load, [status, page]);

  async function confirmAction() {
    if (!pendingAction) return;
    setBusy(true);
    try {
      await reviewReport(pendingAction.report.id, pendingAction.next);
      setPendingAction(null);
      load();
    } catch {
      setError("That action could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Reports</h1>

      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label htmlFor="report-status-filter" className="text-xs font-medium text-slate-500">
          Status
        </label>
        <select
          id="report-status-filter"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as ReportStatus | "");
          }}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          {Object.values(ReportStatus).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {error ? <ErrorState message={error} /> : null}
      {!error && reports === null ? <LoadingState /> : null}
      {!error && reports !== null && reports.length === 0 ? <EmptyState title="No reports match these filters." /> : null}

      {!error && reports && reports.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Listing</th>
                <th className="px-4 py-2">Reporter</th>
                <th className="px-4 py-2">Reason</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Reported</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.map((report) => (
                <tr key={report.id}>
                  <td className="max-w-xs truncate px-4 py-3">
                    {report.listing ? (
                      <Link to={`/listings/${report.listing.id}`} className="font-medium text-blue-600 hover:underline">
                        {report.listing.title}
                      </Link>
                    ) : (
                      <span className="text-slate-400">Listing unavailable</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{report.reporter?.displayName ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{reasonLabels[report.reason] ?? report.reason}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone[report.status]}>{report.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{new Date(report.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    {report.status === ReportStatus.PENDING ? (
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setPendingAction({ report, next: "REVIEWED" })}
                          className="text-blue-600 hover:underline"
                        >
                          Mark reviewed
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingAction({ report, next: "DISMISSED" })}
                          className="text-slate-500 hover:underline"
                        >
                          Dismiss
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-400">
                        {report.status === "REVIEWED" ? "Reviewed" : "Dismissed"}
                      </span>
                    )}
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
        title={pendingAction?.next === "REVIEWED" ? "Mark this report reviewed?" : "Dismiss this report?"}
        description={
          pendingAction?.report.details
            ? `Reporter's details: "${pendingAction.report.details}"`
            : "No additional details were provided."
        }
        confirmLabel={pendingAction?.next === "REVIEWED" ? "Mark reviewed" : "Dismiss"}
        busy={busy}
        onConfirm={confirmAction}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
