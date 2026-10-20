import { api, toQueryString } from "./api";
import type { PaginatedResult } from "./types";

export interface ScrapeTarget {
  name: string;
  selector: string;
  get?: string;
  fields?: Record<string, string>;
}

export interface ScrapeConfig {
  targets: ScrapeTarget[];
  defaults: ScrapeTarget[];
  updatedAt: string;
}

export type ScrapeRunStatus = "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";

export interface ScrapeRun {
  id: string;
  url: string;
  domain: string | null;
  status: ScrapeRunStatus;
  startedAt: string;
  completedAt: string | null;
  counts: {
    linksFound: number;
    scraped: number;
    staged: number;
    skippedIncomplete: number;
    duplicatesBlocked: number;
    failed: number;
  };
  logTail: string;
  error: string | null;
}

export type ScrapedItemStatus = "STAGED" | "UPLOADING" | "UPLOADED" | "REMOVED" | "FAILED";

export interface ScrapedItem {
  id: string;
  runId: string;
  url: string;
  title: string;
  description: string;
  images: string[];
  age: string | null;
  mobile: string | null;
  city: string | null;
  address: string | null;
  status: ScrapedItemStatus;
  listingId: string | null;
  error: string | null;
  uploadedAt: string | null;
  removedAt: string | null;
  createdAt: string;
}

export type ScrapedItemsResult = PaginatedResult<ScrapedItem> & { counts: Record<ScrapedItemStatus, number> };

export interface UploadTarget {
  categoryId: string;
  subcategoryId?: string;
  countryId: string;
}

export function getScrapeConfig() {
  return api.get<{ config: ScrapeConfig }>("/admin/scraper/config").then((r) => r.config);
}

export function saveScrapeConfig(targets: ScrapeTarget[]) {
  return api.put<{ config: ScrapeConfig }>("/admin/scraper/config", { targets }).then((r) => r.config);
}

export function startScrape(input: { url: string; domain?: string }) {
  return api.post<{ run: ScrapeRun }>("/admin/scraper/runs", input).then((r) => r.run);
}

export function cancelScrape(id: string) {
  return api.post<Record<string, never>>(`/admin/scraper/runs/${id}/cancel`);
}

export function listScrapeRuns(params: { page?: number; limit?: number } = {}) {
  return api.get<PaginatedResult<ScrapeRun>>(`/admin/scraper/runs${toQueryString(params)}`);
}

export function listScrapedItems(params: { status?: ScrapedItemStatus; page?: number; limit?: number }) {
  return api.get<ScrapedItemsResult>(`/admin/scraper/items${toQueryString(params)}`);
}

export function updateScrapedItem(
  id: string,
  input: Partial<Pick<ScrapedItem, "title" | "description" | "age" | "mobile" | "city" | "address">>,
) {
  return api.patch<{ item: ScrapedItem }>(`/admin/scraper/items/${id}`, input).then((r) => r.item);
}

export function removeScrapedItems(ids: string[]) {
  return api.post<{ removed: number }>("/admin/scraper/items/remove", { ids });
}

export function restoreScrapedItems(ids: string[]) {
  return api.post<{ restored: number }>("/admin/scraper/items/restore", { ids });
}

export function uploadScrapedItems(input: UploadTarget & { ids?: string[]; all?: boolean }) {
  return api.post<{ claimed: number }>("/admin/scraper/items/upload", input);
}
