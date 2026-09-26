import { useState } from "react";
import type { NavLinkInput } from "../lib/navLinks";
import type { NavLinkSummary } from "../lib/types";

interface Props {
  open: boolean;
  title: string;
  initial?: NavLinkSummary;
  onSave: (input: NavLinkInput) => Promise<void>;
  onClose: () => void;
}

/**
 * Create/edit form for one `SecondaryNav` link. `initial` is only ever read
 * for the initial `useState` value — the parent (`NavLinksPage`) remounts
 * this component with a fresh `key` whenever the dialog's target changes,
 * same convention as `CategoryFormDialog`.
 */
export function NavLinkFormDialog({ open, title, initial, onSave, onClose }: Props) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [openInNewTab, setOpenInNewTab] = useState(initial?.openInNewTab ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({ label, url, sortOrder: Number(sortOrder) || 0, openInNewTab });
      onClose();
    } catch {
      setError("Could not save. Check that the URL is a valid http(s) link or an internal path starting with /.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
        <h2 className="mb-4 text-base font-semibold text-slate-900">{title}</h2>
        {error ? <p role="alert" className="mb-3 text-sm text-red-600">{error}</p> : null}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="navlink-label" className="mb-1 block text-sm font-medium text-slate-700">
              Label
            </label>
            <input
              id="navlink-label"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="navlink-url" className="mb-1 block text-sm font-medium text-slate-700">
              URL
            </label>
            <input
              id="navlink-url"
              required
              placeholder="https://example.com or /some-path"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="navlink-sort-order" className="mb-1 block text-sm font-medium text-slate-700">
              Sort order
            </label>
            <input
              id="navlink-sort-order"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={openInNewTab} onChange={(e) => setOpenInNewTab(e.target.checked)} />
            Open in a new tab
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
