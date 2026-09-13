import type { BlogPostStatus } from "@classified-marketplace/shared";
import { api, toQueryString } from "./api";
import type { AdminBlogPost, PaginatedResult } from "./types";

export interface AdminBlogPostQuery {
  search?: string;
  status?: BlogPostStatus;
  category?: string;
  featured?: boolean;
  page?: number;
  limit?: number;
}

export function listAdminBlogPosts(query: AdminBlogPostQuery = {}) {
  const qs = toQueryString({
    search: query.search,
    status: query.status,
    category: query.category,
    featured: query.featured === undefined ? undefined : String(query.featured),
    page: query.page,
    limit: query.limit,
  });
  return api.get<PaginatedResult<AdminBlogPost>>(`/admin/blog/posts${qs}`);
}

export async function getAdminBlogPost(id: string): Promise<AdminBlogPost> {
  const { post } = await api.get<{ post: AdminBlogPost }>(`/admin/blog/posts/${id}`);
  return post;
}

/**
 * Matches `createBlogPostSchema`/`updateBlogPostSchema` in
 * blog.validation.ts — no `author`/`id`/timestamps field exists here at
 * all, the same "not a field a client can set" convention every other
 * admin form in this app already follows.
 */
export interface BlogPostInput {
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  featuredImage?: string | null;
  featuredImageAlt?: string | null;
  category?: string | null;
  tags?: string[];
  status?: BlogPostStatus;
  featured?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoKeywords?: string[];
  canonicalUrl?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  noindex?: boolean;
  publishedAt?: string | null;
}

export async function createBlogPost(input: BlogPostInput): Promise<AdminBlogPost> {
  const { post } = await api.post<{ post: AdminBlogPost }>("/admin/blog/posts", input);
  return post;
}

export async function updateBlogPost(id: string, input: BlogPostInput): Promise<AdminBlogPost> {
  const { post } = await api.patch<{ post: AdminBlogPost }>(`/admin/blog/posts/${id}`, input);
  return post;
}

export async function updateBlogPostStatus(id: string, status: BlogPostStatus): Promise<AdminBlogPost> {
  const { post } = await api.patch<{ post: AdminBlogPost }>(`/admin/blog/posts/${id}/status`, { status });
  return post;
}

export async function deleteBlogPost(id: string): Promise<void> {
  await api.delete<null>(`/admin/blog/posts/${id}`);
}

export async function uploadBlogImage(file: File): Promise<{ url: string; key: string }> {
  const formData = new FormData();
  formData.set("image", file);
  return api.post<{ url: string; key: string }>("/admin/blog/images", formData);
}
