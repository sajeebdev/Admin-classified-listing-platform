import { UserRole } from "@classified-marketplace/shared";
import { useEffect, useState } from "react";
import { ActiveBadge, Badge } from "../components/Badge";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Pagination } from "../components/Pagination";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { useAuth } from "../context/AuthContext";
import { ApiClientError } from "../lib/api";
import { listAdminUsers, updateUserStatus, type UserStatusUpdate } from "../lib/users";
import type { AdminUser } from "../lib/types";

type PendingAction = { user: AdminUser; update: UserStatusUpdate; label: string };

/**
 * Mirrors `ReportsPage.tsx`'s shape (filters + table + `ConfirmDialog` +
 * `Pagination`) — the established pattern for every admin list page in
 * this dashboard. There is no toast/notification system anywhere in this
 * app (checked — every other page surfaces errors via the same inline
 * `ErrorState` banner used here), so that's what this page uses too rather
 * than introducing a new one.
 */
export function UsersPage() {
  const { user: currentUser } = useAuth();

  const [search, setSearch] = useState("");
  const [role, setRole] = useState<UserRole | "">("");
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");
  const [bannedFilter, setBannedFilter] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(1);

  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);

  // Single `load` function, reused both as the effect body and after a
  // successful action — same shape as `ReportsPage.tsx`'s `load`. No
  // synchronous reset before the fetch (see the matching comment in
  // ListingsPage.tsx/CategoriesPage.tsx): the previous page's results
  // simply stay on screen until the new filter's results (or an error)
  // arrive.
  function load() {
    listAdminUsers({
      search: search || undefined,
      role: role || undefined,
      isActive: activeFilter === "" ? undefined : activeFilter === "true",
      isBanned: bannedFilter === "" ? undefined : bannedFilter === "true",
      page,
      limit: 20,
    })
      .then((result) => {
        setUsers(result.items);
        setTotalPages(result.totalPages);
        setLoadError(null);
      })
      .catch(() => setLoadError("Could not load users."));
  }

  useEffect(load, [search, role, activeFilter, bannedFilter, page]);

  async function confirmAction() {
    if (!pendingAction) return;
    setBusy(true);
    setActionError(null);
    try {
      await updateUserStatus(pendingAction.user.id, pendingAction.update);
      setPendingAction(null);
      load();
    } catch (err) {
      setActionError(
        err instanceof ApiClientError ? err.message : "That action could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Users</h1>

      <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <label htmlFor="user-search" className="mb-1 block text-xs font-medium text-slate-500">
            Search
          </label>
          <input
            id="user-search"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Username or email"
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="role-filter" className="mb-1 block text-xs font-medium text-slate-500">
            Role
          </label>
          <select
            id="role-filter"
            value={role}
            onChange={(e) => {
              setPage(1);
              setRole(e.target.value as UserRole | "");
            }}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">All roles</option>
            {Object.values(UserRole).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="active-filter" className="mb-1 block text-xs font-medium text-slate-500">
            Account status
          </label>
          <select
            id="active-filter"
            value={activeFilter}
            onChange={(e) => {
              setPage(1);
              setActiveFilter(e.target.value as "" | "true" | "false");
            }}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
        <div>
          <label htmlFor="banned-filter" className="mb-1 block text-xs font-medium text-slate-500">
            Ban status
          </label>
          <select
            id="banned-filter"
            value={bannedFilter}
            onChange={(e) => {
              setPage(1);
              setBannedFilter(e.target.value as "" | "true" | "false");
            }}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value="true">Banned</option>
            <option value="false">Not banned</option>
          </select>
        </div>
      </div>

      {loadError ? <ErrorState message={loadError} /> : null}
      {actionError ? <ErrorState message={actionError} /> : null}
      {!loadError && users === null ? <LoadingState /> : null}
      {!loadError && users !== null && users.length === 0 ? (
        <EmptyState title="No users match these filters." />
      ) : null}

      {!loadError && users && users.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Username</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Account status</th>
                <th className="px-4 py-2">Ban status</th>
                <th className="px-4 py-2">Created</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => {
                const isSelf = currentUser?._id === user.id;
                return (
                  <tr key={user.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {user.username}
                      {isSelf ? <span className="ml-1 text-xs font-normal text-slate-400">(you)</span> : null}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-slate-600">{user.email}</td>
                    <td className="px-4 py-3">
                      <Badge tone={user.role === "USER" ? "neutral" : "blue"}>{user.role}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <ActiveBadge isActive={user.isActive} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={user.isBanned ? "red" : "neutral"}>{user.isBanned ? "Banned" : "Not banned"}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-3 whitespace-nowrap">
                        {user.isActive ? (
                          <button
                            type="button"
                            disabled={isSelf}
                            title={isSelf ? "You cannot deactivate your own account" : undefined}
                            onClick={() =>
                              setPendingAction({
                                user,
                                update: { isActive: false },
                                label: "Deactivate",
                              })
                            }
                            className="text-slate-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-300 disabled:no-underline"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setPendingAction({ user, update: { isActive: true }, label: "Activate" })
                            }
                            className="text-blue-600 hover:underline"
                          >
                            Activate
                          </button>
                        )}
                        {user.isBanned ? (
                          <button
                            type="button"
                            onClick={() => setPendingAction({ user, update: { isBanned: false }, label: "Unban" })}
                            className="text-blue-600 hover:underline"
                          >
                            Unban
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isSelf}
                            title={isSelf ? "You cannot ban your own account" : undefined}
                            onClick={() => setPendingAction({ user, update: { isBanned: true }, label: "Ban" })}
                            className="text-red-600 hover:underline disabled:cursor-not-allowed disabled:text-red-200 disabled:no-underline"
                          >
                            Ban
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction ? `${pendingAction.label} ${pendingAction.user.username}?` : ""}
        description={
          pendingAction?.label === "Ban" || pendingAction?.label === "Deactivate"
            ? "They will immediately lose access to their account until this is reversed."
            : "They will regain access to their account."
        }
        confirmLabel={pendingAction?.label}
        danger={pendingAction?.label === "Ban" || pendingAction?.label === "Deactivate"}
        busy={busy}
        onConfirm={confirmAction}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
