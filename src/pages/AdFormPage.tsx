import { AdPlacement } from "../shared";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ErrorState, LoadingState } from "../components/States";
import { ApiClientError } from "../lib/api";
import {
  createAd,
  deleteAd,
  getAdminAd,
  getAdStats,
  updateAd,
  uploadAdImage,
  type AdInput,
} from "../lib/ads";
import type { AdminAd, AdStats } from "../lib/types";

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** `datetime-local`'s value format has no timezone/seconds — round-trips an ISO string through it, same helper as BlogPostFormPage.tsx. */
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

function StatsRow({ label, window }: { label: string; window: AdStats["allTime"] }) {
  return (
    <tr>
      <td className="py-1 pr-4 text-slate-500">{label}</td>
      <td className="py-1 pr-4 text-right text-slate-900">{window.impressions.toLocaleString()}</td>
      <td className="py-1 pr-4 text-right text-slate-900">{window.clicks.toLocaleString()}</td>
      <td className="py-1 text-right text-slate-900">{window.ctr}%</td>
    </tr>
  );
}

/**
 * One shared component for both `/ads/new` and `/ads/:id/edit` — the same
 * create-vs-edit-by-route-param shape `BlogPostFormPage.tsx`/
 * `ListingDetailPage.tsx` already use. Simpler than the blog form (no
 * rich-content editor, no SEO card) — an ad is a banner, a destination, a
 * placement, and a schedule.
 */
export function AdFormPage() {
  const { id } = useParams<{ id: string }>();
  const mode: "create" | "edit" = id ? "edit" : "create";
  const navigate = useNavigate();

  const [loadError, setLoadError] = useState<string | null>(null);
  const [initial, setInitial] = useState<AdminAd | null>(null);

  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageAlt, setImageAlt] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [placement, setPlacement] = useState<AdPlacement>(AdPlacement.HOME_TOP);
  const [priority, setPriority] = useState(0);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [openInNewTab, setOpenInNewTab] = useState(true);
  const [paused, setPaused] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [stats, setStats] = useState<AdStats | null>(null);

  useEffect(() => {
    if (mode === "create" || !id) return;
    getAdminAd(id)
      .then((ad) => {
        setInitial(ad);
        setTitle(ad.title);
        setImageUrl(ad.imageUrl);
        setImageAlt(ad.imageAlt);
        setTargetUrl(ad.targetUrl);
        setPlacement(ad.placement);
        setPriority(ad.priority);
        setStartAt(toDatetimeLocal(ad.startAt));
        setEndAt(toDatetimeLocal(ad.endAt));
        setOpenInNewTab(ad.openInNewTab);
        setPaused(ad.status === "PAUSED");
      })
      .catch((err) => setLoadError(err instanceof ApiClientError ? err.message : "Could not load this ad."));
    getAdStats(id)
      .then(setStats)
      .catch(() => {
        // Stats are a nice-to-have on this page — never block the editor on them.
      });
  }, [mode, id]);

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
      const { url } = await uploadAdImage(file);
      setImageUrl(url);
    } catch (err) {
      setImageError(err instanceof ApiClientError ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function buildPayload(): AdInput {
    return {
      title,
      imageUrl: imageUrl ?? undefined,
      imageAlt,
      targetUrl,
      placement,
      status: paused ? "PAUSED" : "ACTIVE",
      priority,
      startAt: fromDatetimeLocal(startAt),
      endAt: endAt ? fromDatetimeLocal(endAt) : null,
      openInNewTab,
    };
  }

  async function handleSave() {
    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    if (!imageUrl) {
      setFormError("An image is required.");
      setSaving(false);
      return;
    }
    try {
      const payload = buildPayload();
      if (mode === "edit" && id) await updateAd(id, payload);
      else await createAd(payload);
      navigate("/ads");
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFormError(err.message);
        setFieldErrors(err.errors ?? {});
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!id) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAd(id);
      navigate("/ads");
    } catch {
      setDeleteError("Could not delete this ad. Please try again.");
      setDeleting(false);
    }
  }

  if (loadError) return <ErrorState message={loadError} />;
  if (mode === "edit" && !initial) return <LoadingState />;

  return (
    <div className="max-w-4xl space-y-4">
      <button type="button" onClick={() => navigate("/ads")} className="text-sm text-blue-600 hover:underline">
        &larr; Back to ads
      </button>

      <h1 className="text-xl font-semibold text-slate-900">{mode === "create" ? "New ad" : "Edit ad"}</h1>

      {formError ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {formError}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <div>
            <label htmlFor="ad-title" className="mb-1 block text-sm font-medium text-slate-700">
              Title
            </label>
            <input
              id="ad-title"
              required
              minLength={2}
              maxLength={150}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Internal label for this ad"
            />
            {fieldErrors.title?.[0] ? <p className="mt-1 text-sm text-red-600">{fieldErrors.title[0]}</p> : null}
          </div>

          <div>
            <label htmlFor="ad-target-url" className="mb-1 block text-sm font-medium text-slate-700">
              Destination URL
            </label>
            <input
              id="ad-target-url"
              required
              type="text"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://... or /category/social"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">
              An https(s) URL, or an internal path starting with /. Never javascript:/data:.
            </p>
            {fieldErrors.targetUrl?.[0] ? (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.targetUrl[0]}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="ad-placement" className="mb-1 block text-sm font-medium text-slate-700">
                Placement
              </label>
              <select
                id="ad-placement"
                value={placement}
                onChange={(e) => setPlacement(e.target.value as AdPlacement)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                {Object.values(AdPlacement).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ad-priority" className="mb-1 block text-sm font-medium text-slate-700">
                Priority (0–100)
              </label>
              <input
                id="ad-priority"
                type="number"
                min={0}
                max={100}
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">Higher shows first when several ads share a placement.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="ad-start" className="mb-1 block text-sm font-medium text-slate-700">
                Start date/time
              </label>
              <input
                id="ad-start"
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="ad-end" className="mb-1 block text-sm font-medium text-slate-700">
                End date/time (optional)
              </label>
              <input
                id="ad-end"
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            {fieldErrors.endAt?.[0] ? <p className="col-span-2 text-sm text-red-600">{fieldErrors.endAt[0]}</p> : null}
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={openInNewTab} onChange={(e) => setOpenInNewTab(e.target.checked)} />
            Open in a new tab
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)} />
            Paused (hidden from the public site regardless of dates)
          </label>

          <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : mode === "create" ? "Create ad" : "Save changes"}
            </button>
            {mode === "edit" ? (
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="ml-auto text-sm font-medium text-red-600 hover:underline"
              >
                Delete
              </button>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Image</p>
            {imageError ? <p className="text-sm text-red-600">{imageError}</p> : null}
            {imageUrl ? (
              <img src={imageUrl} alt="" className="h-32 w-full rounded-md border border-slate-200 object-cover" />
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
            <div>
              <label htmlFor="ad-image-alt" className="mb-1 block text-xs font-medium text-slate-500">
                Image alt text (required)
              </label>
              <input
                id="ad-image-alt"
                value={imageAlt}
                onChange={(e) => setImageAlt(e.target.value)}
                placeholder="Describes the ad image"
                maxLength={200}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              {fieldErrors.imageAlt?.[0] ? (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.imageAlt[0]}</p>
              ) : null}
            </div>
          </div>

          {mode === "edit" && stats ? (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">Statistics</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500">
                    <th className="pb-1 text-left font-medium"></th>
                    <th className="pb-1 text-right font-medium">Impr.</th>
                    <th className="pb-1 text-right font-medium">Clicks</th>
                    <th className="pb-1 text-right font-medium">CTR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <StatsRow label="Today" window={stats.today} />
                  <StatsRow label="Last 7 days" window={stats.last7Days} />
                  <StatsRow label="Last 30 days" window={stats.last30Days} />
                  <StatsRow label="All time" window={stats.allTime} />
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title={`Delete "${title || "this ad"}"?`}
        description="This permanently deletes the ad and its uploaded image. This cannot be undone."
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
