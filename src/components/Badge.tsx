import { AdStatus, BlogPostStatus, ListingStatus, ModerationStatus } from "@classified-marketplace/shared";

const tones = {
  neutral: "bg-slate-100 text-slate-700",
  blue: "bg-blue-100 text-blue-700",
  green: "bg-green-100 text-green-700",
  yellow: "bg-yellow-100 text-yellow-800",
  red: "bg-red-100 text-red-700",
} as const;

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof tones; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

const statusTone: Record<ListingStatus, keyof typeof tones> = {
  DRAFT: "neutral",
  PENDING_REVIEW: "yellow",
  PUBLISHED: "green",
  REJECTED: "red",
  EXPIRED: "neutral",
  ARCHIVED: "neutral",
  REMOVED: "red",
};

/** Deliberately never merged with `ModerationStatusBadge` into one field — see docs/listings.md. */
export function ListingStatusBadge({ status }: { status: ListingStatus }) {
  return <Badge tone={statusTone[status]}>{status.replace("_", " ")}</Badge>;
}

const moderationTone: Record<ModerationStatus, keyof typeof tones> = {
  PENDING: "yellow",
  APPROVED: "green",
  REJECTED: "red",
};

export function ModerationStatusBadge({ status }: { status: ModerationStatus }) {
  return <Badge tone={moderationTone[status]}>Moderation: {status}</Badge>;
}

export function ActiveBadge({ isActive }: { isActive: boolean }) {
  return <Badge tone={isActive ? "green" : "neutral"}>{isActive ? "Active" : "Inactive"}</Badge>;
}

/** Merchandising, not moderation — deliberately its own badge/tone, never merged into `ListingStatusBadge`. */
export function FeaturedBadge({ featured }: { featured: boolean }) {
  return <Badge tone={featured ? "blue" : "neutral"}>{featured ? "Featured" : "Not featured"}</Badge>;
}

const blogStatusTone: Record<BlogPostStatus, keyof typeof tones> = {
  DRAFT: "neutral",
  PUBLISHED: "green",
  ARCHIVED: "red",
};

export function BlogPostStatusBadge({ status }: { status: BlogPostStatus }) {
  return <Badge tone={blogStatusTone[status]}>{status}</Badge>;
}

const adStatusTone: Record<AdStatus, keyof typeof tones> = {
  ACTIVE: "green",
  PAUSED: "neutral",
  EXPIRED: "red",
};

/** `status` here is the *effective* status `ad.service.ts#deriveAdStatus` computes — see `AdminAd`'s doc comment in lib/types.ts. */
export function AdStatusBadge({ status }: { status: AdStatus }) {
  return <Badge tone={adStatusTone[status]}>{status}</Badge>;
}
