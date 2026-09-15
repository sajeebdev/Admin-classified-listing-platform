import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { UserRole } from "../shared";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/", label: "Overview", end: true },
  { to: "/listings", label: "Listings" },
  { to: "/ads", label: "Ads" },
  { to: "/blog", label: "Blog" },
  { to: "/reports", label: "Reports" },
  { to: "/categories", label: "Categories" },
  { to: "/locations", label: "Locations" },
  { to: "/users", label: "Users" },
];

// Settings is ADMIN/SUPER_ADMIN only (see App.tsx's `SETTINGS_ROLES`) — kept
// out of the shared list above so a MODERATOR never sees a link that only
// leads to an "Access denied" page.
const settingsNavItem = { to: "/settings", label: "Settings", end: false };

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const visibleNavItems =
    user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN
      ? [...navItems, settingsNavItem]
      : navItems;

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-56 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-4">
          <p className="text-base font-bold text-slate-900">Classifieds Admin</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-100"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <p className="truncate text-sm font-medium text-slate-900">{user?.displayName}</p>
          <p className="truncate text-xs text-slate-500">{user?.role === UserRole.SUPER_ADMIN ? "Super Admin" : user?.role}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Log out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
