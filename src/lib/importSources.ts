import { api, toQueryString } from "./api";
import type { AdminImportSource, PaginatedResult, SourceConnectionDiagnostic } from "./types";

export function listImportSources(query: { page?: number; limit?: number } = {}) {
  const qs = toQueryString({ page: query.page, limit: query.limit });
  return api.get<PaginatedResult<AdminImportSource>>(`/admin/imports/sources${qs}`);
}

export interface CreateImportSourceInput {
  provider: string;
  name: string;
  sourceUrl: string;
  enabled?: boolean;
}

export async function createImportSource(input: CreateImportSourceInput): Promise<AdminImportSource> {
  const { source } = await api.post<{ source: AdminImportSource }>("/admin/imports/sources", input);
  return source;
}

export interface UpdateImportSourceInput {
  name?: string;
  sourceUrl?: string;
  enabled?: boolean;
}

export async function updateImportSource(id: string, input: UpdateImportSourceInput): Promise<AdminImportSource> {
  const { source } = await api.patch<{ source: AdminImportSource }>(`/admin/imports/sources/${id}`, input);
  return source;
}

/** A read-only connection probe — never creates an import job or listing. See docs/importer.md. */
export async function testImportSource(id: string): Promise<SourceConnectionDiagnostic> {
  const { diagnostic } = await api.post<{ diagnostic: SourceConnectionDiagnostic }>(
    `/admin/imports/sources/${id}/test`,
  );
  return diagnostic;
}
