import { useState } from "react";
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const visibleNavItems =
    user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN
      ? [...navItems, settingsNavItem]
      : navItems;

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const sidebarBody = (
    <>
      <nav className="flex-1 space-y-1 p-3">
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setMobileNavOpen(false)}
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
    </>
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 md:flex-row">
      {/* Mobile top bar: the fixed-width sidebar below is `md:flex`-only, so
          screens narrower than that need their own way to reach navigation. */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <p className="text-base font-bold text-slate-900">Classifieds Admin</p>
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open menu"
          aria-expanded={mobileNavOpen}
          className="rounded-md border border-slate-300 p-2 text-slate-700 hover:bg-slate-50"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      {/* Mobile nav drawer, only mounted while open. */}
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileNavOpen(false)}
            className="absolute inset-0 bg-slate-900/40"
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
              <p className="text-base font-bold text-slate-900">Classifieds Admin</p>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close menu"
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            {sidebarBody}
          </aside>
        </div>
      ) : null}

      {/* Desktop sidebar. */}
      <aside className="hidden w-56 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="border-b border-slate-200 px-4 py-4">
          <p className="text-base font-bold text-slate-900">Classifieds Admin</p>
        </div>
        {sidebarBody}
      </aside>

      <main className="flex-1 overflow-x-auto p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}
