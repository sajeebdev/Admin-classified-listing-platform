import { api, toQueryString } from "./api";
import type { CitySummary, CountrySummary, PaginatedResult, StateSummary } from "./types";

export interface CountryInput {
  name: string;
  code: string;
  slug?: string;
  sortOrder?: number;
  seoTitle?: string;
  seoDescription?: string;
  isActive?: boolean;
}

export interface StateInput {
  name: string;
  code?: string;
  slug?: string;
  sortOrder?: number;
  seoTitle?: string;
  seoDescription?: string;
  isActive?: boolean;
}

export interface CityInput {
  name: string;
  slug?: string;
  stateId?: string;
  countryId?: string;
  sortOrder?: number;
  seoTitle?: string;
  seoDescription?: string;
  isActive?: boolean;
}

// List endpoints (paginated) return the result directly; single-resource
// endpoints wrap their payload as `{ country: ... }` / `{ state: ... }` /
// `{ city: ... }` (see location.controller.ts) — unwrapped here.

export function listAdminCountries(params: { page?: number; limit?: number } = {}) {
  const qs = toQueryString({ page: params.page, limit: params.limit });
  return api.get<PaginatedResult<CountrySummary>>(`/admin/locations/countries${qs}`);
}

export async function createCountry(input: CountryInput): Promise<CountrySummary> {
  const { country } = await api.post<{ country: CountrySummary }>("/admin/locations/countries", input);
  return country;
}

export async function updateCountry(id: string, input: Partial<CountryInput>): Promise<CountrySummary> {
  const { country } = await api.patch<{ country: CountrySummary }>(`/admin/locations/countries/${id}`, input);
  return country;
}

export async function deactivateCountry(id: string): Promise<CountrySummary> {
  const { country } = await api.delete<{ country: CountrySummary }>(`/admin/locations/countries/${id}`);
  return country;
}

export function listAdminStates(countryId: string, params: { page?: number; limit?: number } = {}) {
  const qs = toQueryString({ page: params.page, limit: params.limit });
  return api.get<PaginatedResult<StateSummary>>(`/admin/locations/countries/${countryId}/states${qs}`);
}

export async function createState(countryId: string, input: StateInput): Promise<StateSummary> {
  const { state } = await api.post<{ state: StateSummary }>(`/admin/locations/countries/${countryId}/states`, input);
  return state;
}

export async function updateState(id: string, input: Partial<StateInput>): Promise<StateSummary> {
  const { state } = await api.patch<{ state: StateSummary }>(`/admin/locations/states/${id}`, input);
  return state;
}

export async function deactivateState(id: string): Promise<StateSummary> {
  const { state } = await api.delete<{ state: StateSummary }>(`/admin/locations/states/${id}`);
  return state;
}

export function listAdminCities(stateId: string, params: { page?: number; limit?: number } = {}) {
  const qs = toQueryString({ page: params.page, limit: params.limit });
  return api.get<PaginatedResult<CitySummary>>(`/admin/locations/states/${stateId}/cities${qs}`);
}

export async function createCity(stateId: string, input: CityInput): Promise<CitySummary> {
  const { city } = await api.post<{ city: CitySummary }>(`/admin/locations/states/${stateId}/cities`, input);
  return city;
}

export async function updateCity(id: string, input: Partial<CityInput>): Promise<CitySummary> {
  const { city } = await api.patch<{ city: CitySummary }>(`/admin/locations/cities/${id}`, input);
  return city;
}

export async function deactivateCity(id: string): Promise<CitySummary> {
  const { city } = await api.delete<{ city: CitySummary }>(`/admin/locations/cities/${id}`);
  return city;
}
