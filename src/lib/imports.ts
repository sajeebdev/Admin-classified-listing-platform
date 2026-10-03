import type { ImportJobStatus } from "../shared";
import { api, toQueryString } from "./api";
import type { AdminImportJob, AdminImportJobDetail, PaginatedResult } from "./types";

export interface AdminImportJobQuery {
  provider?: string;
  status?: ImportJobStatus;
  page?: number;
  limit?: number;
}

export type HtmlParserField =
  | "externalId"
  | "sourceUrl"
  | "title"
  | "description"
  | "category"
  | "subcategory"
  | "country"
  | "state"
  | "city"
  | "price"
  | "publishedAt"
  | "images";

export type HtmlParserSelectors = Partial<Record<HtmlParserField, string>>;

export interface HtmlListingExtraction {
  listing: {
    externalId: string;
    sourceUrl: string;
    title: string;
    description: string;
    category: string;
    subcategory: string;
    country: string;
    state: string;
    city: string;
    price: number | null;
    publishedAt: string;
    images: string[];
  };
  imageReferences: string[];
  videos: string[];
  details: {
    postId: string;
    age: string;
    mobile: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    tags: string[];
  };
  missingFields: HtmlParserField[];
  warnings: string[];
}

export async function parseListingHtml(html: string, selectors: HtmlParserSelectors = {}): Promise<HtmlListingExtraction> {
  const { extraction } = await api.post<{ extraction: HtmlListingExtraction }>("/admin/imports/parse-html", {
    html,
    selectors,
  });
  return extraction;
}

/** Job history — the lightweight summary shape (no per-record detail; see `getImportJob` for that). */
export function listImportJobs(query: AdminImportJobQuery = {}) {
  const qs = toQueryString({
    provider: query.provider,
    status: query.status,
    page: query.page,
    limit: query.limit,
  });
  return api.get<PaginatedResult<AdminImportJob>>(`/admin/imports${qs}`);
}

/** Full per-job diagnostics, including every processed record's result/failure stage/reason. */
export async function getImportJob(id: string): Promise<AdminImportJobDetail> {
  const { job } = await api.get<{ job: AdminImportJobDetail }>(`/admin/imports/${id}`);
  return job;
}

/**
 * Manually triggers an import run — ADMIN/SUPER_ADMIN only (see
 * docs/importer.md). With no `importSourceId`, runs the built-in mock
 * source (unchanged, original behavior); with one, runs that configured
 * source's real adapter (e.g. a Bedpage source). Returns the finished
 * job's full diagnostics (same shape as `getImportJob`).
 */
export async function runImport(importSourceId?: string): Promise<AdminImportJobDetail> {
  const { job } = await api.post<{ job: AdminImportJobDetail }>(
    "/admin/imports/run",
    importSourceId ? { importSourceId } : undefined,
  );
  return job;
}

/** Uploads a local CSV/JSON file through the same validated importer pipeline; the file is never used as a URL. */
export async function uploadImportFile(formData: FormData): Promise<AdminImportJobDetail> {
  const { job } = await api.post<{ job: AdminImportJobDetail }>("/admin/imports/upload", formData);
  return job;
}
