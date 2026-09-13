import { ListingStatus, ReportStatus } from "@classified-marketplace/shared";
import { useEffect, useState } from "react";
import { listAdminListings } from "../lib/listings";
import { listAdminReports } from "../lib/reports";
import { listAdminUsers } from "../lib/users";

interface Counts {
  totalUsers: number | null;
  total: number;
  published: number;
  pendingReview: number;
  rejected: number;
  removed: number;
  pendingReports: number;
}

export function DashboardHome() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        // `GET /admin/users` is ADMIN/SUPER_ADMIN only (see
        // `user.admin.routes.ts`) — unlike every other card here, a
        // MODERATOR viewing this same overview gets a real `403` from it.
        // Caught on its own, separately from the `Promise.all` below, so
        // that expected `403` degrades this one card to "—" instead of
        // failing the whole overview (and the listing/report cards a
        // MODERATOR *can* see) with a generic error.
        const usersTotal = await listAdminUsers({ limit: 1 })
          .then((r) => r.total)
          .catch(() => null);

        const [total, published, pendingReview, rejected, removed, pendingReports] = await Promise.all([
          listAdminListings({ limit: 1 }),
          listAdminListings({ status: ListingStatus.PUBLISHED, limit: 1 }),
          listAdminListings({ status: ListingStatus.PENDING_REVIEW, limit: 1 }),
          listAdminListings({ status: ListingStatus.REJECTED, limit: 1 }),
          listAdminListings({ status: ListingStatus.REMOVED, limit: 1 }),
          listAdminReports({ status: ReportStatus.PENDING, limit: 1 }),
        ]);
        if (cancelled) return;
        setCounts({
          totalUsers: usersTotal,
          total: total.total,
          published: published.total,
          pendingReview: pendingReview.total,
          rejected: rejected.total,
          removed: removed.total,
          pendingReports: pendingReports.total,
        });
      } catch {
        if (!cancelled) setError("Could not load listing statistics.");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = [
    { label: "Total users", value: counts?.totalUsers ?? undefined, placeholder: "—" },
    { label: "Total listings", value: counts?.total },
    { label: "Published", value: counts?.published },
    { label: "Pending moderation", value: counts?.pendingReview },
    { label: "Rejected", value: counts?.rejected },
    { label: "Removed", value: counts?.removed },
    { label: "Pending reports", value: counts?.pendingReports },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Overview</h1>
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-2xl font-semibold text-slate-900">
              {counts === null ? "…" : (card.value ?? card.placeholder ?? "—")}
            </p>
            <p className="text-sm text-slate-500">{card.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
