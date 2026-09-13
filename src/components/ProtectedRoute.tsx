import type { UserRole } from "@classified-marketplace/shared";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Gates a route on the client's cached user — a UX convenience only. Every
 * actual mutation this dashboard performs still goes through the backend's
 * `requireAuth`/`requireRole` middleware (see docs/authentication.md),
 * which is what actually decides whether an action succeeds.
 */
export function ProtectedRoute({
  roles,
  children,
}: {
  roles?: UserRole[];
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Loading…</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <p className="text-lg font-semibold text-slate-900">Access denied</p>
          <p className="mt-1 text-sm text-slate-500">Your account role does not permit this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
