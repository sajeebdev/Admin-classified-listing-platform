/**
 * Where an ad can be displayed on the public site. Kept as one flat,
 * centrally-declared enum (like `ListingStatus`/`BlogPostStatus`) so every
 * layer — the Mongoose schema's `enum`, the zod validators, the admin
 * dashboard's placement dropdown, and the frontend's `<AdSlot>` — all
 * derive from the exact same list. Adding a new placement later means
 * adding one line here, never hand-editing HTML in every page that wants
 * one (see `components/ads/AdSlot.tsx` on the frontend).
 */
export const AdPlacement = {
  HEADER: "HEADER",
  HOME_TOP: "HOME_TOP",
  HOME_MIDDLE: "HOME_MIDDLE",
  HOME_BOTTOM: "HOME_BOTTOM",
  CATEGORY_TOP: "CATEGORY_TOP",
  CATEGORY_MIDDLE: "CATEGORY_MIDDLE",
  LOCATION_TOP: "LOCATION_TOP",
  LOCATION_MIDDLE: "LOCATION_MIDDLE",
  LISTING_TOP: "LISTING_TOP",
  LISTING_BOTTOM: "LISTING_BOTTOM",
  SIDEBAR: "SIDEBAR",
} as const;
export type AdPlacement = (typeof AdPlacement)[keyof typeof AdPlacement];

/**
 * `status` is deliberately a two-value admin toggle in the database
 * (`ACTIVE`/`PAUSED` — see `models/Advertisement.ts`), the same "one flag
 * the admin flips" shape `Listing`'s own moderation actions use. `EXPIRED`
 * is a third, real value this type still carries because every API
 * response computes and reports it — but nothing ever *writes* `EXPIRED`
 * to the database, exactly like `ListingStatus.EXPIRED` is never written by
 * a background job (see `listing.service.ts`'s public-search comment): an
 * ad's expiry is derived live from `endAt` vs. "now", never a stored
 * transition. See `ad.service.ts#deriveAdStatus`.
 */
export const AdStatus = {
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  EXPIRED: "EXPIRED",
} as const;
export type AdStatus = (typeof AdStatus)[keyof typeof AdStatus];

/** The two values an admin can actually set — `EXPIRED` is a computed read value only, never a settable one. See `AdStatus`'s doc comment. */
export const SettableAdStatus = {
  ACTIVE: AdStatus.ACTIVE,
  PAUSED: AdStatus.PAUSED,
} as const;
export type SettableAdStatus = (typeof SettableAdStatus)[keyof typeof SettableAdStatus];

/** `AdEvent.type` — see `models/AdEvent.ts`. */
export const AdEventType = {
  IMPRESSION: "IMPRESSION",
  CLICK: "CLICK",
} as const;
export type AdEventType = (typeof AdEventType)[keyof typeof AdEventType];
