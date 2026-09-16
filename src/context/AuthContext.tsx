import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { ApiClientError } from "../lib/api";
import { getCurrentUser, login as loginRequest, logout as logoutRequest } from "../lib/auth";
import type { AuthUser } from "../lib/types";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Backend RBAC is the only real authorization boundary — this context just
 * decides what the UI shows. A user with the frontend role of "ADMIN" but a
 * server-side role downgrade would still be rejected by `requireRole` on
 * every actual mutation; the client never trusts its own cached role for
 * anything but hiding controls it knows would fail server-side anyway.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const current = await getCurrentUser();
    setUser(current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Inlined rather than calling `refresh()` directly: the async work
    // (the actual `setUser` call) happens after `getCurrentUser`'s first
    // `await`, never synchronously in the effect body, which is what the
    // `set-state-in-effect` lint rule is checking for.
    getCurrentUser().then((current) => {
      if (cancelled) return;
      setUser(current);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * `POST /auth/login`'s own response body includes the user regardless of
   * whether the browser actually kept the session cookie it was handed —
   * trusting that alone would report "logged in" even on a browser that
   * silently dropped the cookie (see lib/api.ts's `API_BASE_URL` note), only
   * to fail unpredictably on the next real request. Re-fetching `/auth/me`
   * makes login prove the cookie round-trips before declaring success.
   */
  async function login(email: string, password: string) {
    await loginRequest(email, password);
    const current = await getCurrentUser();
    if (!current) {
      throw new ApiClientError(
        "Login succeeded but your session could not be started. Your browser may be blocking cookies for this site.",
        401,
      );
    }
    setUser(current);
    return current;
  }

  async function logout() {
    await logoutRequest();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>{children}</AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- the context+hook pairing is the standard pattern here; splitting into two files for this lint rule alone isn't worth the indirection.
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
