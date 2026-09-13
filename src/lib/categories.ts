import { api, toQueryString } from "./api";
import type { CategorySummary, PaginatedResult, SubcategorySummary } from "./types";

export interface CategoryInput {
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  image?: string;
  sortOrder?: number;
  seoTitle?: string;
  seoDescription?: string;
  isActive?: boolean;
}

// List endpoints (paginated) return the result directly; single-resource
// endpoints wrap their payload as `{ category: ... }` / `{ subcategory: ...
// }` (see category.controller.ts) — unwrapped here.

export function listAdminCategories(params: { page?: number; limit?: number } = {}) {
  const qs = toQueryString({ page: params.page, limit: params.limit });
  return api.get<PaginatedResult<CategorySummary>>(`/admin/categories${qs}`);
}

export async function createCategory(input: CategoryInput): Promise<CategorySummary> {
  const { category } = await api.post<{ category: CategorySummary }>("/admin/categories", input);
  return category;
}

export async function updateCategory(id: string, input: Partial<CategoryInput>): Promise<CategorySummary> {
  const { category } = await api.patch<{ category: CategorySummary }>(`/admin/categories/${id}`, input);
  return category;
}

export async function deactivateCategory(id: string): Promise<CategorySummary> {
  const { category } = await api.delete<{ category: CategorySummary }>(`/admin/categories/${id}`);
  return category;
}

export function listAdminSubcategories(categoryId: string, params: { page?: number; limit?: number } = {}) {
  const qs = toQueryString({ page: params.page, limit: params.limit });
  return api.get<PaginatedResult<SubcategorySummary>>(`/admin/categories/${categoryId}/subcategories${qs}`);
}

export async function createSubcategory(categoryId: string, input: CategoryInput): Promise<SubcategorySummary> {
  const { subcategory } = await api.post<{ subcategory: SubcategorySummary }>(
    `/admin/categories/${categoryId}/subcategories`,
    input,
  );
  return subcategory;
}

export async function updateSubcategory(id: string, input: Partial<CategoryInput>): Promise<SubcategorySummary> {
  const { subcategory } = await api.patch<{ subcategory: SubcategorySummary }>(`/admin/subcategories/${id}`, input);
  return subcategory;
}

export async function deactivateSubcategory(id: string): Promise<SubcategorySummary> {
  const { subcategory } = await api.delete<{ subcategory: SubcategorySummary }>(`/admin/subcategories/${id}`);
  return subcategory;
}
