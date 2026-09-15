import type {
  AdPlacement,
  AdStatus,
  BlogPostStatus,
  ListingStatus,
  ModerationStatus,
  PriceType,
  ReportReason,
  ReportStatus,
  UserRole,
} from "../shared";

export interface RefSummary {
  id: string;
  name?: string;
  slug?: string;
}

export interface ListingLocation {
  country: RefSummary | null;
  state: RefSummary | null;
  city: RefSummary | null;
}

export interface ListingImage {
  id: string;
  url: string;
  alt: string | null;
  sortOrder: number;
  isPrimary: boolean;
}

export interface ContactPreferences {
  allowPlatformMessages: boolean;
  showPhone: boolean;
  showEmail: boolean;
}

export interface PublicSeller {
  id: string;
  displayName: string;
  avatar: string | null;
}

/** The admin/owner-facing listing shape — `toOwnerListing` in listing.service.ts. */
export interface AdminListing {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: RefSummary | null;
  subcategory: RefSummary | null;
  location: ListingLocation;
  images: ListingImage[];
  price: number | null;
  priceType: PriceType;
  contactPreferences: ContactPreferences;
  seller: PublicSeller | null;
  publishedAt: string | null;
  viewCount: number;
  favoriteCount: number;
  status: ListingStatus;
  moderationStatus: ModerationStatus;
  rejectionReason: string | null;
  expiresAt: string | null;
  /** Admin-controlled merchandising — independent of `status`/`moderationStatus`. See `setListingFeatured` in listing.service.ts. */
  featured: boolean;
  featuredPriority: number;
  featuredAt: string | null;
  featuredUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The admin-facing report shape — `toAdminReport` in report.service.ts. */
export interface AdminReport {
  id: string;
  listing: { id: string; title: string; slug: string } | null;
  reporter: { id: string; displayName: string } | null;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  reviewedAt: string | null;
  reviewedBy: string | null;
  createdAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  image: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export interface SubcategorySummary {
  id: string;
  categoryId?: string;
  name: string;
  slug: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export interface CountrySummary {
  id: string;
  name: string;
  slug: string;
  code: string;
  seoTitle: string | null;
  seoDescription: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export interface StateSummary {
  id: string;
  countryId?: string;
  name: string;
  slug: string;
  code: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export interface CitySummary {
  id: string;
  stateId?: string;
  countryId?: string;
  name: string;
  slug: string;
  seoTitle: string | null;
  seoDescription: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

/** `toPublicBlogPost`/`toAdminBlogPost` in blog.service.ts. */
export interface BlogPostAuthor {
  id: string;
  displayName: string;
}

/**
 * The admin-facing blog post shape — everything the public shape has, plus
 * `status`/`createdAt`/`updatedAt`, which the public API never returns
 * (see blog.service.ts's `toPublicBlogPost` vs `toAdminBlogPost`).
 */
export interface AdminBlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  featuredImage: string | null;
  featuredImageAlt: string | null;
  category: string | null;
  tags: string[];
  author: BlogPostAuthor | null;
  featured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string[];
  canonicalUrl: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  noindex: boolean;
  publishedAt: string | null;
  status: BlogPostStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * The admin-facing ad shape — `toAdminAd` in `ad.service.ts`. `status` is
 * the *effective* status (`ACTIVE`/`PAUSED`/`EXPIRED`) — see that
 * function's doc comment: `EXPIRED` is computed from `endAt`, never a value
 * actually stored for this ad. `ctr` is likewise always computed, never a
 * stored field (see docs/ads.md).
 */
export interface AdminAd {
  id: string;
  title: string;
  imageUrl: string;
  imageAlt: string;
  targetUrl: string;
  placement: AdPlacement;
  status: AdStatus;
  priority: number;
  openInNewTab: boolean;
  startAt: string;
  endAt: string | null;
  impressions: number;
  clicks: number;
  ctr: number;
  createdAt: string;
  updatedAt: string;
}

/** `getAdsOverview` in `ad.service.ts` — the `/admin/ads` page's summary cards. */
export interface AdsOverview {
  totalAds: number;
  activeAds: number;
  totalImpressions: number;
  totalClicks: number;
  averageCtr: number;
}

export interface AdStatsWindow {
  impressions: number;
  clicks: number;
  ctr: number;
}

/** `getAdStats` in `ad.service.ts` — a single ad's time-windowed breakdown. */
export interface AdStats {
  today: AdStatsWindow;
  last7Days: AdStatsWindow;
  last30Days: AdStatsWindow;
  allTime: AdStatsWindow;
}

/** `getSiteSettings`/`setListingAutoApprove` in `settings.service.ts` — a single always-present document of admin-configurable, site-wide settings. */
export interface SiteSettings {
  listingModeration: {
    autoApprove: boolean;
  };
  listingImages: {
    maxImages: number;
    maxImageSizeMB: number;
    optimizationEnabled: boolean;
  };
  updatedAt: string | null;
  updatedBy: string | null;
}

/**
 * The admin-facing user-management shape — `toAdminUser` in
 * `user.service.ts`. Unlike `AuthUser` below, this one already uses `id`
 * (that shape is hand-built specifically to expose it), and deliberately
 * carries only the fields safe for another admin to see — never a
 * password hash or any token.
 */
export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  isBanned: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * `_id`, not `id` — `User`'s Mongoose `toJSON` transform does not set
 * `virtuals: true` (see docs/authentication.md), so the `id` virtual is
 * never present on this response.
 */
export interface AuthUser {
  _id: string;
  email: string;
  username: string;
  displayName: string;
  avatar: string | null;
  role: UserRole;
  isVerified: boolean;
  isActive: boolean;
  isBanned: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}
