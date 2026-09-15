import { BlogPostStatus } from "../shared";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { MarkdownToolbar } from "../components/MarkdownToolbar";
import { ErrorState, LoadingState } from "../components/States";
import { ApiClientError, SITE_URL } from "../lib/api";
import {
  createBlogPost,
  deleteBlogPost,
  getAdminBlogPost,
  updateBlogPost,
  updateBlogPostStatus,
  uploadBlogImage,
  type BlogPostInput,
} from "../lib/blog";
import type { AdminBlogPost } from "../lib/types";

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** `datetime-local`'s value format has no timezone/seconds — this round-trips an ISO string through it in both directions. */
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(value: string): string | undefined {
  if (!value) return undefined;
  return new Date(value).toISOString();
}

/** A client-side suggestion only — the backend independently normalizes/validates/uniques the real slug (see blog.validation.ts's `slugField` and blog.service.ts's `assertSlugAvailable`). Never trusted as-is. */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * One shared component for both `/blog/new` and `/blog/:id/edit` — the
 * same create-vs-edit-by-route-param shape `ListingDetailPage.tsx` uses.
 * WordPress-style two-column layout (main content + right sidebar of
 * Status/Featured/Category/Tags/Featured image/SEO cards), explicit
 * Save Draft/Publish/Update/Delete actions instead of a single "Save" +
 * status dropdown, a Markdown formatting toolbar over the content
 * textarea (see MarkdownToolbar.tsx), and a Preview link into the real
 * public frontend's admin-only preview route.
 */
export function BlogPostFormPage() {
  const { id } = useParams<{ id: string }>();
  const mode: "create" | "edit" = id ? "edit" : "create";
  const navigate = useNavigate();
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const [initial, setInitial] = useState<AdminBlogPost | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [featuredImage, setFeaturedImage] = useState<string | null>(null);
  const [featuredImageAlt, setFeaturedImageAlt] = useState("");
  const [category, setCategory] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [status, setStatus] = useState<BlogPostStatus>(BlogPostStatus.DRAFT);
  const [featured, setFeatured] = useState(false);
  const [publishedAt, setPublishedAt] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoKeywordsText, setSeoKeywordsText] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState("");
  const [ogTitle, setOgTitle] = useState("");
  const [ogDescription, setOgDescription] = useState("");
  const [noindex, setNoindex] = useState(false);

  const [dirty, setDirty] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState<"draft" | "publish" | "update" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [quickActionError, setQuickActionError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "create" || !id) return;
    getAdminBlogPost(id)
      .then((post) => {
        setInitial(post);
        setTitle(post.title);
        setSlug(post.slug);
        setSlugTouched(true); // an existing post's slug is never auto-rewritten from the title
        setExcerpt(post.excerpt ?? "");
        setContent(post.content);
        setFeaturedImage(post.featuredImage);
        setFeaturedImageAlt(post.featuredImageAlt ?? "");
        setCategory(post.category ?? "");
        setTagsText(post.tags.join(", "));
        setStatus(post.status);
        setFeatured(post.featured);
        setPublishedAt(toDatetimeLocal(post.publishedAt));
        setSeoTitle(post.seoTitle ?? "");
        setSeoDescription(post.seoDescription ?? "");
        setSeoKeywordsText(post.seoKeywords.join(", "));
        setCanonicalUrl(post.canonicalUrl ?? "");
        setOgTitle(post.ogTitle ?? "");
        setOgDescription(post.ogDescription ?? "");
        setNoindex(post.noindex);
      })
      .catch((err) =>
        setLoadError(err instanceof ApiClientError ? err.message : "Could not load this post."),
      );
  }, [mode, id]);

  // Warn on leaving the editor with unsaved changes — a plain
  // `beforeunload` guard, not a router-level navigation-blocking state
  // machine (the brief explicitly says not to build one just for this).
  // Only wired once initial data is in place (edit mode) or the admin has
  // actually typed something (create mode), so an untouched "new post"
  // tab never warns.
  useEffect(() => {
    if (!dirty) return;
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function markDirty() {
    if (!dirty) setDirty(true);
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError(null);
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setImageError("Only JPEG, PNG, WebP, and GIF images are supported.");
      return;
    }
    setUploading(true);
    try {
      const { url } = await uploadBlogImage(file);
      setFeaturedImage(url);
      markDirty();
    } catch (err) {
      setImageError(err instanceof ApiClientError ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  /** Reused by the toolbar's "Insert image" button for in-content images — the exact same upload endpoint, never a second pipeline. */
  async function uploadContentImage(file: File): Promise<string> {
    const { url } = await uploadBlogImage(file);
    return url;
  }

  function buildPayload(overrideStatus?: BlogPostStatus): BlogPostInput {
    const tags = tagsText.split(",").map((t) => t.trim()).filter(Boolean);
    const seoKeywords = seoKeywordsText.split(",").map((t) => t.trim()).filter(Boolean);
    return {
      title,
      slug: slug || undefined,
      excerpt: excerpt || undefined,
      content,
      featuredImage,
      featuredImageAlt: featuredImageAlt || null,
      category: category || null,
      tags,
      status: overrideStatus ?? status,
      featured,
      publishedAt: fromDatetimeLocal(publishedAt) ?? null,
      seoTitle: seoTitle || null,
      seoDescription: seoDescription || null,
      seoKeywords,
      canonicalUrl: canonicalUrl || null,
      ogTitle: ogTitle || null,
      ogDescription: ogDescription || null,
      noindex,
    };
  }

  async function save(overrideStatus: BlogPostStatus, savingKind: "draft" | "publish" | "update") {
    setSaving(savingKind);
    setFormError(null);
    setFieldErrors({});
    try {
      const payload = buildPayload(overrideStatus);
      if (mode === "edit" && id) await updateBlogPost(id, payload);
      else await createBlogPost(payload);
      setDirty(false);
      navigate("/blog");
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFormError(err.message);
        setFieldErrors(err.errors ?? {});
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      setSaving(null);
    }
  }

  async function handleArchive() {
    if (!id) return;
    setQuickActionError(null);
    try {
      const updated = await updateBlogPostStatus(id, BlogPostStatus.ARCHIVED);
      setStatus(updated.status);
      setDirty(false);
    } catch {
      setQuickActionError("Could not archive this post.");
    }
  }

  async function handleDelete() {
    if (!id) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteBlogPost(id);
      setDirty(false);
      navigate("/blog");
    } catch {
      setDeleteError("Could not delete this post. Please try again.");
      setDeleting(false);
    }
  }

  if (loadError) return <ErrorState message={loadError} />;
  if (mode === "edit" && !initial) return <LoadingState />;

  const isPublished = status === BlogPostStatus.PUBLISHED;
  const previewHref = id ? `${SITE_URL}/blog/preview/${id}` : null;

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => navigate("/blog")} className="text-sm text-blue-600 hover:underline">
          &larr; Back to blog posts
        </button>
        {previewHref ? (
          <a
            href={previewHref}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Preview ↗
          </a>
        ) : null}
      </div>

      <h1 className="text-xl font-semibold text-slate-900">{mode === "create" ? "New post" : "Edit post"}</h1>

      {formError ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {formError}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* Main content column */}
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <div>
            <label htmlFor="post-title" className="mb-1 block text-sm font-medium text-slate-700">
              Title
            </label>
            <input
              id="post-title"
              required
              minLength={3}
              maxLength={200}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
                markDirty();
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-lg font-medium"
              placeholder="Post title"
            />
            {fieldErrors.title?.[0] ? <p className="mt-1 text-sm text-red-600">{fieldErrors.title[0]}</p> : null}
          </div>

          <div>
            <label htmlFor="post-slug" className="mb-1 block text-sm font-medium text-slate-700">
              Slug
            </label>
            <div className="flex items-center gap-1 text-sm text-slate-500">
              <span className="shrink-0">/blog/</span>
              <input
                id="post-slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                  markDirty();
                }}
                placeholder="auto-generated-from-title"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>
            {fieldErrors.slug?.[0] ? <p className="mt-1 text-sm text-red-600">{fieldErrors.slug[0]}</p> : null}
          </div>

          <div>
            <label htmlFor="post-excerpt" className="mb-1 block text-sm font-medium text-slate-700">
              Excerpt
            </label>
            <textarea
              id="post-excerpt"
              rows={2}
              maxLength={300}
              value={excerpt}
              onChange={(e) => {
                setExcerpt(e.target.value);
                markDirty();
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="post-content" className="mb-1 block text-sm font-medium text-slate-700">
              Content
            </label>
            {/* Markdown source, formatted via the toolbar above the
                textarea — never rendered as raw HTML directly (see
                frontend/src/lib/utils/markdown.ts's sanitize step). */}
            <MarkdownToolbar
              textareaRef={contentRef}
              value={content}
              onChange={(next) => {
                setContent(next);
                markDirty();
              }}
              onUploadImage={uploadContentImage}
            />
            <textarea
              ref={contentRef}
              id="post-content"
              required
              rows={20}
              minLength={20}
              maxLength={50_000}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                markDirty();
              }}
              className="w-full rounded-b-md border border-slate-300 px-3 py-2 font-mono text-sm"
            />
            {fieldErrors.content?.[0] ? <p className="mt-1 text-sm text-red-600">{fieldErrors.content[0]}</p> : null}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Publish</p>
            <p className="text-sm text-slate-600">
              Status: <span className="font-medium text-slate-900">{status}</span>
            </p>

            <div>
              <label htmlFor="post-published-at" className="mb-1 block text-xs font-medium text-slate-500">
                Publish date (optional; future = scheduled)
              </label>
              <input
                id="post-published-at"
                type="datetime-local"
                value={publishedAt}
                onChange={(e) => {
                  setPublishedAt(e.target.value);
                  markDirty();
                }}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>

            <div className="flex flex-col gap-2 pt-1">
              {isPublished ? (
                <button
                  type="button"
                  disabled={saving !== null}
                  onClick={() => save(BlogPostStatus.PUBLISHED, "update")}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving === "update" ? "Updating…" : "Update"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saving !== null}
                  onClick={() => save(BlogPostStatus.PUBLISHED, "publish")}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving === "publish" ? "Publishing…" : "Publish"}
                </button>
              )}
              <button
                type="button"
                disabled={saving !== null}
                onClick={() => save(BlogPostStatus.DRAFT, "draft")}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {saving === "draft" ? "Saving…" : isPublished ? "Unpublish (save as draft)" : "Save Draft"}
              </button>
            </div>

            {mode === "edit" ? (
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                {status !== BlogPostStatus.ARCHIVED ? (
                  <button type="button" onClick={handleArchive} className="text-xs text-slate-500 hover:underline">
                    Archive
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">Archived</span>
                )}
                <button
                  type="button"
                  onClick={() => setDeleteOpen(true)}
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            ) : null}
            {quickActionError ? <p className="text-xs text-red-600">{quickActionError}</p> : null}
          </div>

          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => {
                setFeatured(e.target.checked);
                markDirty();
              }}
            />
            Featured post
          </label>

          <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
            <div>
              <label htmlFor="post-category" className="mb-1 block text-xs font-medium text-slate-500">
                Category
              </label>
              <input
                id="post-category"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  markDirty();
                }}
                placeholder="e.g. Guides"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="post-tags" className="mb-1 block text-xs font-medium text-slate-500">
                Tags
              </label>
              <input
                id="post-tags"
                value={tagsText}
                onChange={(e) => {
                  setTagsText(e.target.value);
                  markDirty();
                }}
                placeholder="Comma-separated"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Featured image</p>
            {imageError ? <p className="text-sm text-red-600">{imageError}</p> : null}
            {featuredImage ? (
              <div className="space-y-2">
                <img src={featuredImage} alt="" className="h-32 w-full rounded-md border border-slate-200 object-cover" />
                <input
                  value={featuredImageAlt}
                  onChange={(e) => {
                    setFeaturedImageAlt(e.target.value);
                    markDirty();
                  }}
                  placeholder="Alt text (describes the image)"
                  maxLength={200}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    setFeaturedImage(null);
                    setFeaturedImageAlt("");
                    markDirty();
                  }}
                  className="text-sm text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(",")}
              onChange={handleImageChange}
              disabled={uploading}
              className="text-sm"
            />
            {uploading ? <p className="text-xs text-slate-500">Uploading…</p> : null}
          </div>

          <fieldset className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
            <legend className="px-1 text-sm font-semibold text-slate-900">SEO</legend>
            <div>
              <label htmlFor="post-seo-title" className="mb-1 block text-xs font-medium text-slate-500">
                SEO title
              </label>
              <input
                id="post-seo-title"
                maxLength={70}
                value={seoTitle}
                onChange={(e) => {
                  setSeoTitle(e.target.value);
                  markDirty();
                }}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="post-seo-description" className="mb-1 block text-xs font-medium text-slate-500">
                Meta description
              </label>
              <textarea
                id="post-seo-description"
                rows={2}
                maxLength={160}
                value={seoDescription}
                onChange={(e) => {
                  setSeoDescription(e.target.value);
                  markDirty();
                }}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="post-seo-keywords" className="mb-1 block text-xs font-medium text-slate-500">
                SEO keywords
              </label>
              <input
                id="post-seo-keywords"
                value={seoKeywordsText}
                onChange={(e) => {
                  setSeoKeywordsText(e.target.value);
                  markDirty();
                }}
                placeholder="Comma-separated"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="post-canonical" className="mb-1 block text-xs font-medium text-slate-500">
                Canonical URL (leave blank to use this post's own URL)
              </label>
              <input
                id="post-canonical"
                type="url"
                value={canonicalUrl}
                onChange={(e) => {
                  setCanonicalUrl(e.target.value);
                  markDirty();
                }}
                placeholder="https://…"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              {fieldErrors.canonicalUrl?.[0] ? (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.canonicalUrl[0]}</p>
              ) : null}
            </div>
            <div>
              <label htmlFor="post-og-title" className="mb-1 block text-xs font-medium text-slate-500">
                Social (OG) title
              </label>
              <input
                id="post-og-title"
                maxLength={70}
                value={ogTitle}
                onChange={(e) => {
                  setOgTitle(e.target.value);
                  markDirty();
                }}
                placeholder="Falls back to SEO title / title"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="post-og-description" className="mb-1 block text-xs font-medium text-slate-500">
                Social (OG) description
              </label>
              <textarea
                id="post-og-description"
                rows={2}
                maxLength={300}
                value={ogDescription}
                onChange={(e) => {
                  setOgDescription(e.target.value);
                  markDirty();
                }}
                placeholder="Falls back to meta description / excerpt"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={noindex}
                onChange={(e) => {
                  setNoindex(e.target.checked);
                  markDirty();
                }}
              />
              Hide from search engines (noindex)
            </label>
          </fieldset>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title={`Delete "${title || "this post"}"?`}
        description="This permanently deletes the post. This cannot be undone."
        confirmLabel="Delete"
        danger
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      >
        {deleteError ? <p className="text-sm text-red-600">{deleteError}</p> : null}
      </ConfirmDialog>
    </div>
  );
}
