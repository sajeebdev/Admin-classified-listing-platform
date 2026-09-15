/** Lifecycle status of a listing (owner-facing). */
export const ListingStatus = {
  DRAFT: "DRAFT",
  PENDING_REVIEW: "PENDING_REVIEW",
  PUBLISHED: "PUBLISHED",
  REJECTED: "REJECTED",
  EXPIRED: "EXPIRED",
  ARCHIVED: "ARCHIVED",
  REMOVED: "REMOVED",
} as const;

export type ListingStatus = (typeof ListingStatus)[keyof typeof ListingStatus];

/**
 * Moderation lifecycle — deliberately separate from `ListingStatus`. A
 * listing's day-to-day lifecycle (draft, published, archived, ...) is driven
 * by the owner and by status-transition rules; `ModerationStatus` records
 * only what staff have decided about its content, so the two never get
 * tangled into a single overloaded field.
 */
export const ModerationStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export type ModerationStatus = (typeof ModerationStatus)[keyof typeof ModerationStatus];

/** How a listing's price should be interpreted/displayed. */
export const PriceType = {
  FIXED: "FIXED",
  NEGOTIABLE: "NEGOTIABLE",
  FREE: "FREE",
  CONTACT: "CONTACT",
} as const;

export type PriceType = (typeof PriceType)[keyof typeof PriceType];

/** Outcome of a moderation action taken by a moderator/admin. */
export const ModerationAction = {
  APPROVE: "APPROVE",
  REJECT: "REJECT",
  REMOVE: "REMOVE",
  SUSPEND: "SUSPEND",
  RESTORE: "RESTORE",
} as const;

export type ModerationAction = (typeof ModerationAction)[keyof typeof ModerationAction];

/**
 * Reasons a user may cite when reporting a listing. Deliberately generic and
 * safety-focused — never a category-specific or prohibited-content-specific
 * menu (see docs/reports.md).
 */
export const ReportReason = {
  SPAM: "SPAM",
  SCAM: "SCAM",
  PROHIBITED_CONTENT: "PROHIBITED_CONTENT",
  HARASSMENT: "HARASSMENT",
  DUPLICATE_LISTING: "DUPLICATE_LISTING",
  MISLEADING_INFORMATION: "MISLEADING_INFORMATION",
  OTHER: "OTHER",
} as const;

export type ReportReason = (typeof ReportReason)[keyof typeof ReportReason];

export const ReportStatus = {
  PENDING: "PENDING",
  REVIEWED: "REVIEWED",
  DISMISSED: "DISMISSED",
} as const;

export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];

/**
 * Admin-configurable listing image limits (see docs/media.md's "Configurable
 * image limits" section) — the single source of truth for the allowed
 * dropdown values, shared by the admin settings UI, the backend's own
 * validation, and the create/edit listing form. Never duplicated as a
 * separate frontend constant.
 *
 * `..._CEILING` is the absolute upper bound baked into the `Listing` schema
 * validator and the upload middleware's multer config — those are static,
 * process-lifetime constants that can't be re-read from the database per
 * request the way a Mongoose document field or a per-request service call
 * can, so they're set to the highest value an admin could ever select here.
 * The *actual currently-configured* limit is what `settings.service.ts`
 * enforces dynamically, per request, against the live `SiteSettings`
 * document — never a restart-requiring constant.
 */
export const MAX_IMAGES_OPTIONS = [3, 5, 8, 10, 15, 20] as const;
export const MAX_IMAGE_SIZE_MB_OPTIONS = [1, 2, 5, 10, 20] as const;
export const DEFAULT_MAX_IMAGES = 10;
export const DEFAULT_MAX_IMAGE_SIZE_MB = 5;
export const MAX_IMAGES_CEILING = 20;
export const MAX_IMAGE_SIZE_MB_CEILING = 20;
