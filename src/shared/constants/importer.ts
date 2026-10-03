/**
 * Content importer — see docs/importer.md. Deliberately separate from
 * `ListingStatus`/`ModerationStatus` (see models/Listing.ts): an import run's
 * own lifecycle (did the batch job succeed) is not the same thing as any one
 * listing's moderation lifecycle. An imported listing is always created as a
 * normal `DRAFT`/`PENDING` listing — nothing here ever appears on `Listing`
 * itself.
 */
export const ImportJobStatus = {
  RUNNING: "RUNNING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
} as const;

export type ImportJobStatus = (typeof ImportJobStatus)[keyof typeof ImportJobStatus];

/** How an import run was started — a manual admin click vs. the scheduler. */
export const ImportTrigger = {
  MANUAL: "MANUAL",
  SCHEDULE: "SCHEDULE",
} as const;

export type ImportTrigger = (typeof ImportTrigger)[keyof typeof ImportTrigger];

/**
 * A `SourceAdapter`'s own kind of source — surfaced to admins (job history,
 * per-record detail) so it's always obvious where content actually came
 * from. `MOCK` means "no external site was contacted at all" (see
 * `MockSourceAdapter`); a future real adapter would report something like
 * `"API"`. Adapters are free to report any short string here — this const
 * is just the known, documented values, not an enforced closed set.
 */
export const SourceType = {
  MOCK: "MOCK",
  API: "API",
  /** A real, live website reached over HTTP — see `adapters/bedpage/bedpage.adapter.ts` and docs/importer.md's authorization/security sections. */
  BEDPAGE: "BEDPAGE",
  /** An admin-uploaded CSV parsed locally — see `adapters/feed/uploadedFeed.adapter.ts`. */
  CSV_FEED: "CSV_FEED",
  /** An admin-uploaded JSON file parsed locally — see `adapters/feed/uploadedFeed.adapter.ts`. */
  JSON_FEED: "JSON_FEED",
} as const;

export type SourceType = (typeof SourceType)[keyof typeof SourceType];

/**
 * How a `SourceAdapter` actually retrieves data — distinct from
 * `SourceType` (which provider) so the admin UI can tell apart "this is a
 * real website fetch, currently blocked by that site's own bot protection"
 * from "this is a documented, authorized API/feed integration". `WEBSITE`
 * is used by the Bedpage adapter; `FILE` identifies an admin-uploaded
 * local file. `API`/`FEED` remain available for future authorized remote
 * integrations.
 */
export const SourceAccessMethod = {
  /** No real fetch happens at all (the mock source). */
  NONE: "NONE",
  /** A plain HTTPS request to the source's own public website — never bypasses that site's access controls if it challenges the request. */
  WEBSITE: "WEBSITE",
  /** A documented, authorized API/feed integration — credentials (if any) never live in `ImportSource.sourceUrl` or the admin UI. */
  API: "API",
  /** Reserved for a future authorized remote CSV/JSON feed. Local uploads use `FILE` and never fetch a URL. */
  FEED: "FEED",
  /** A CSV/JSON file uploaded directly by an admin; no outbound request is made. */
  FILE: "FILE",
} as const;

export type SourceAccessMethod = (typeof SourceAccessMethod)[keyof typeof SourceAccessMethod];

/**
 * The outcome of processing one source record within an import run — always
 * exactly one of these three, recorded per-record on `ImportJob.records`
 * (see models/ImportJob.ts). Deliberately not the same set as the job-level
 * counters (`fetchedCount`/.../`skippedCount`, unchanged — see
 * docs/importer.md): a source record that fails basic shape validation is
 * still counted as `skipped` at the job level (existing behavior, unchanged)
 * but reported as `FAILED` with `failureStage: SOURCE_VALIDATION` at the
 * per-record level, since "skipped" isn't a meaningful distinction once
 * you're looking at one specific record's fate.
 */
export const ImportRecordStatus = {
  IMPORTED: "IMPORTED",
  DUPLICATE: "DUPLICATE",
  FAILED: "FAILED",
} as const;

export type ImportRecordStatus = (typeof ImportRecordStatus)[keyof typeof ImportRecordStatus];

/**
 * Where in the pipeline a `FAILED` record stopped (see docs/importer.md's
 * pipeline diagram). `null` for `IMPORTED`/`DUPLICATE` records.
 * `DUPLICATE_CHECK` is not "this record was a duplicate" (that's the
 * `DUPLICATE` status, with no failure stage at all) — it means the
 * duplicate-check operation *itself* failed unexpectedly (e.g. a database
 * error), which is different from finding a real duplicate.
 */
export const ImportFailureStage = {
  /**
   * The whole run's outbound request for source data failed or was
   * refused, and no more specific sub-classification below applies (or an
   * adapter simply doesn't sub-classify) — a run that fails here (or at
   * one of its `SOURCE_FETCH_*` sub-stages) produces zero records. Kept as
   * the generic/parent value; a real adapter should prefer a specific
   * `SOURCE_FETCH_*` value below whenever it can tell which one applies
   * (see `adapters/bedpage/bedpage.adapter.ts`) — e.g. a pre-flight
   * SSRF/allowlist refusal (never reaches the network at all) still uses
   * this generic value, since none of the response-shaped sub-stages fit.
   */
  SOURCE_FETCH: "SOURCE_FETCH",
  /** A genuine network-level failure (DNS/connection/reset) that was not a timeout — see `net/safeFetch.ts#SafeFetchNetworkError`. */
  SOURCE_FETCH_NETWORK: "SOURCE_FETCH_NETWORK",
  /** The request exceeded its bounded timeout with no response — see `net/safeFetch.ts#SafeFetchTimeoutError`. */
  SOURCE_FETCH_TIMEOUT: "SOURCE_FETCH_TIMEOUT",
  /** A response was received with a non-2xx HTTP status that isn't better explained by `SOURCE_FETCH_UNAUTHORIZED` or `SOURCE_FETCH_BOT_PROTECTION` below. */
  SOURCE_FETCH_HTTP: "SOURCE_FETCH_HTTP",
  /**
   * The response matched a known bot-protection/automated-access
   * challenge signature (see `net/botProtection.ts`) — the source is
   * reachable, but it explicitly challenged this request rather than
   * serving real content. Never attempted to solve; see docs/importer.md.
   * This is a distinct, more informative classification than "the source
   * is unavailable" — the source *is* available, to a real browser.
   */
  SOURCE_FETCH_BOT_PROTECTION: "SOURCE_FETCH_BOT_PROTECTION",
  /** A response was received with `401`/`403` — the source requires authorization this adapter does not have (and, per project policy, never attempts to forge/steal). */
  SOURCE_FETCH_UNAUTHORIZED: "SOURCE_FETCH_UNAUTHORIZED",
  /** A response was received but was unusable on its own terms — exceeded the response-size cap, too many redirects, or an unexpected content-type for a 2xx status. Not a content-parsing failure (see `SOURCE_PARSE`) — this is about the transport-level response shape, before any parsing is attempted. */
  SOURCE_FETCH_INVALID_RESPONSE: "SOURCE_FETCH_INVALID_RESPONSE",
  /** Content was retrieved, but this adapter could not (or, per its own documented scope, deliberately does not) turn it into `RawSourceListing` records — e.g. no verified/authorized page structure to parse against. */
  SOURCE_PARSE: "SOURCE_PARSE",
  SOURCE_VALIDATION: "SOURCE_VALIDATION",
  CATEGORY_MAPPING: "CATEGORY_MAPPING",
  LOCATION_MAPPING: "LOCATION_MAPPING",
  DUPLICATE_CHECK: "DUPLICATE_CHECK",
  LISTING_VALIDATION: "LISTING_VALIDATION",
  LISTING_IMAGE_STORAGE: "LISTING_IMAGE_STORAGE",
  LISTING_CREATE: "LISTING_CREATE",
  UNKNOWN: "UNKNOWN",
} as const;

export type ImportFailureStage = (typeof ImportFailureStage)[keyof typeof ImportFailureStage];
