/**
 * User roles, from lowest to highest privilege.
 * Kept as a const object (not a TS enum) so it tree-shakes cleanly
 * and serializes as plain strings across API boundaries.
 */
export const UserRole = {
  USER: "USER",
  MODERATOR: "MODERATOR",
  ADMIN: "ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];
