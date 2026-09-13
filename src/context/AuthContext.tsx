import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
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

  async function login(email: string, password: string) {
    const { user: loggedInUser } = await loginRequest(email, password);
    setUser(loggedInUser);
    return loggedInUser;
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
