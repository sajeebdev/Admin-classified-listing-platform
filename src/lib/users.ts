import type { UserRole } from "../shared";
import { api, toQueryString } from "./api";
import type { AdminUser, PaginatedResult } from "./types";

export interface AdminUserQuery {
  search?: string;
  role?: UserRole;
  isActive?: boolean;
  isBanned?: boolean;
  page?: number;
  limit?: number;
}

export function listAdminUsers(query: AdminUserQuery = {}) {
  const qs = toQueryString({
    search: query.search,
    role: query.role,
    // `toQueryString` drops `undefined`/`null`/`""` but keeps real booleans
    // — stringified here since query params are always strings on the wire,
    // matching the backend's `"true"`/`"false"` literal parsing (see
    // `user.validation.ts`).
    isActive: query.isActive === undefined ? undefined : String(query.isActive),
    isBanned: query.isBanned === undefined ? undefined : String(query.isBanned),
    page: query.page,
    limit: query.limit,
  });
  return api.get<PaginatedResult<AdminUser>>(`/admin/users${qs}`);
}

export type UserStatusUpdate = { isActive: boolean } | { isBanned: boolean };

export async function updateUserStatus(id: string, update: UserStatusUpdate): Promise<AdminUser> {
  const { user } = await api.patch<{ user: AdminUser }>(`/admin/users/${id}`, update);
  return user;
}
