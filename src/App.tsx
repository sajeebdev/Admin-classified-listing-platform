import { UserRole } from "./shared";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdFormPage } from "./pages/AdFormPage";
import { AdsPage } from "./pages/AdsPage";
import { BlogPostFormPage } from "./pages/BlogPostFormPage";
import { BlogPostsPage } from "./pages/BlogPostsPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { DashboardHome } from "./pages/DashboardHome";
import { ListingDetailPage } from "./pages/ListingDetailPage";
import { ListingsPage } from "./pages/ListingsPage";
import { LocationsPage } from "./pages/LocationsPage";
import { LoginPage } from "./pages/LoginPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UsersPage } from "./pages/UsersPage";

// Every route below requires at least MODERATOR — matching the backend's
// own `requireRole(MODERATOR, ADMIN, SUPER_ADMIN)` gate on every admin
// listing endpoint (see docs/authentication.md). Category/location
// management additionally requires ADMIN/SUPER_ADMIN server-side, so a
// MODERATOR who reaches those pages will see their mutations rejected by
// the backend even though the page itself renders — client-side role
// checks are a UX nicety, not the real boundary.
const STAFF_ROLES = [UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN];

// Settings is narrower than the rest of this layout — ADMIN/SUPER_ADMIN
// only, matching the backend's own `settings.routes.ts` gate (a moderator
// works the moderation queue this page configures, but does not decide
// whether the queue exists at all).
const SETTINGS_ROLES = [UserRole.ADMIN, UserRole.SUPER_ADMIN];

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute roles={STAFF_ROLES}>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardHome />} />
        <Route path="/listings" element={<ListingsPage />} />
        <Route path="/listings/:id" element={<ListingDetailPage />} />
        <Route path="/ads" element={<AdsPage />} />
        <Route path="/ads/new" element={<AdFormPage />} />
        <Route path="/ads/:id/edit" element={<AdFormPage />} />
        <Route path="/blog" element={<BlogPostsPage />} />
        <Route path="/blog/new" element={<BlogPostFormPage />} />
        <Route path="/blog/:id/edit" element={<BlogPostFormPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/locations" element={<LocationsPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route
          path="/settings"
          element={
            <ProtectedRoute roles={SETTINGS_ROLES}>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
