import type { ReportStatus } from "../shared";
import { api, toQueryString } from "./api";
import type { AdminReport, PaginatedResult } from "./types";

export interface AdminReportQuery {
  status?: ReportStatus;
  page?: number;
  limit?: number;
}

export function listAdminReports(query: AdminReportQuery = {}) {
  const qs = toQueryString({ status: query.status, page: query.page, limit: query.limit });
  return api.get<PaginatedResult<AdminReport>>(`/admin/reports${qs}`);
}

export async function getAdminReport(id: string): Promise<AdminReport> {
  const { report } = await api.get<{ report: AdminReport }>(`/admin/reports/${id}`);
  return report;
}

export async function reviewReport(id: string, status: "REVIEWED" | "DISMISSED"): Promise<AdminReport> {
  const { report } = await api.patch<{ report: AdminReport }>(`/admin/reports/${id}`, { status });
  return report;
}
