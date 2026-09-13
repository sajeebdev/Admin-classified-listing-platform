import { api } from "./api";
import type { AuthUser } from "./types";

export function login(email: string, password: string) {
  return api.post<{ user: AuthUser }>("/auth/login", { email, password });
}

export function logout() {
  return api.post<null>("/auth/logout");
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const { user } = await api.get<{ user: AuthUser }>("/auth/me");
    return user;
  } catch {
    return null;
  }
}
