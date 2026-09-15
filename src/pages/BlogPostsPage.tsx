import { BlogPostStatus } from "../shared";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BlogPostStatusBadge } from "../components/Badge";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Pagination } from "../components/Pagination";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { SITE_URL } from "../lib/api";
import { deleteBlogPost, listAdminBlogPosts, updateBlogPostStatus } from "../lib/blog";
import type { AdminBlogPost } from "../lib/types";

type PendingAction =
  | { kind: "delete"; post: AdminBlogPost }
  | { kind: "status"; post: AdminBlogPost; next: BlogPostStatus }
  | null;

const actionCopy: Record<
  "delete" | BlogPostStatus,
  { title: (post: AdminBlogPost) => string; description: string; confirmLabel: string; danger: boolean }
> = {
  delete: {
    title: (post) => `Delete "${post.title}"?`,
    description: "This permanently deletes the post. This cannot be undone.",
    confirmLabel: "Delete",
    danger: true,
  },
  PUBLISHED: {
    title: (post) => `Publish "${post.title}"?`,
    description: "It becomes publicly visible immediately (unless it has a future scheduled date).",
    confirmLabel: "Publish",
    danger: false,
  },
  DRAFT: {
    title: (post) => `Unpublish "${post.title}"?`,
    description: "It reverts to a draft and is no longer publicly visible.",
    confirmLabel: "Unpublish",
    danger: true,
  },
  ARCHIVED: {
    title: (post) => `Archive "${post.title}"?`,
    description: "It is no longer publicly visible. This does not delete the post.",
    confirmLabel: "Archive",
    danger: true,
  },
};

/**
 * Mirrors `ReportsPage.tsx`/`UsersPage.tsx`'s established shape (filters +
 * table + `ConfirmDialog` + `Pagination`, inline `ErrorState` for
 * errors — there is no toast/notification system anywhere in this app) and
 * `ListingDetailPage.tsx`'s single-`pendingAction`-union-over-one-dialog
 * pattern for its several distinct confirm-able actions.
 */
export function BlogPostsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<BlogPostStatus | "">("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);

  const [posts, setPosts] = useState<AdminBlogPost[] | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    listAdminBlogPosts({
      search: search || undefined,
      status: status || undefined,
      category: category || undefined,
      page,
      limit: 20,
    })
      .then((result) => {
        setPosts(result.items);
        setTotalPages(result.totalPages);
        setLoadError(null);
      })
      .catch(() => setLoadError("Could not load blog posts."));
  }

  useEffect(load, [search, status, category, page]);

  async function confirmAction() {
    if (!pendingAction) return;
    setBusy(true);
    setActionError(null);
    try {
      if (pendingAction.kind === "delete") await deleteBlogPost(pendingAction.post.id);
      else await updateBlogPostStatus(pendingAction.post.id, pendingAction.next);
      setPendingAction(null);
      load();
    } catch {
      setActionError("That action could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  const copy = pendingAction
    ? actionCopy[pendingAction.kind === "delete" ? "delete" : pendingAction.next]
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Blog</h1>
        <Link
          to="/blog/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New post
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <label htmlFor="blog-search" className="mb-1 block text-xs font-medium text-slate-500">
            Search
          </label>
          <input
            id="blog-search"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Title, excerpt, content"
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="blog-status-filter" className="mb-1 block text-xs font-medium text-slate-500">
            Status
          </label>
          <select
            id="blog-status-filter"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as BlogPostStatus | "");
            }}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">All statuses</option>
            {Object.values(BlogPostStatus).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="blog-category-filter" className="mb-1 block text-xs font-medium text-slate-500">
            Category
          </label>
          <input
            id="blog-category-filter"
            value={category}
            onChange={(e) => {
              setPage(1);
              setCategory(e.target.value);
            }}
            placeholder="e.g. Guides"
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      {loadError ? <ErrorState message={loadError} /> : null}
      {actionError ? <ErrorState message={actionError} /> : null}
      {!loadError && posts === null ? <LoadingState /> : null}
      {!loadError && posts !== null && posts.length === 0 ? (
        <EmptyState title="No blog posts match these filters." />
      ) : null}

      {!loadError && posts && posts.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Featured</th>
                <th className="px-4 py-2">Author</th>
                <th className="px-4 py-2">Published</th>
                <th className="px-4 py-2">Updated</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {posts.map((post) => (
                <tr key={post.id}>
                  <td className="max-w-xs truncate px-4 py-3 font-medium text-slate-900">{post.title}</td>
                  <td className="px-4 py-3 text-slate-600">{post.category ?? "—"}</td>
                  <td className="px-4 py-3">
                    <BlogPostStatusBadge status={post.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">{post.featured ? "Yes" : "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{post.author?.displayName ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{new Date(post.updatedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-3 whitespace-nowrap">
                      <Link to={`/blog/${post.id}/edit`} className="text-blue-600 hover:underline">
                        Edit
                      </Link>
                      <a
                        href={`${SITE_URL}/blog/preview/${post.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-600 hover:underline"
                      >
                        Preview
                      </a>
                      {post.status !== "PUBLISHED" ? (
                        <button
                          type="button"
                          onClick={() => setPendingAction({ kind: "status", post, next: "PUBLISHED" })}
                          className="text-green-600 hover:underline"
                        >
                          Publish
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPendingAction({ kind: "status", post, next: "DRAFT" })}
                          className="text-slate-600 hover:underline"
                        >
                          Unpublish
                        </button>
                      )}
                      {post.status !== "ARCHIVED" ? (
                        <button
                          type="button"
                          onClick={() => setPendingAction({ kind: "status", post, next: "ARCHIVED" })}
                          className="text-slate-600 hover:underline"
                        >
                          Archive
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setPendingAction({ kind: "delete", post })}
                        className="text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      <ConfirmDialog
        open={pendingAction !== null}
        title={copy && pendingAction ? copy.title(pendingAction.post) : ""}
        description={copy?.description}
        confirmLabel={copy?.confirmLabel}
        danger={copy?.danger}
        busy={busy}
        onConfirm={confirmAction}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
