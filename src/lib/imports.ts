import type { ImportJobStatus } from "../shared";
import { api, toQueryString } from "./api";
import type { AdminImportJob, AdminImportJobDetail, PaginatedResult } from "./types";

export interface AdminImportJobQuery {
  provider?: string;
  status?: ImportJobStatus;
  page?: number;
  limit?: number;
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
