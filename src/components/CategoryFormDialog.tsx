import { useState } from "react";
import type { CategoryInput } from "../lib/categories";
import type { CategorySummary, SubcategorySummary } from "../lib/types";

interface Props {
  open: boolean;
  title: string;
  initial?: CategorySummary | SubcategorySummary;
  onSave: (input: CategoryInput) => Promise<void>;
  onClose: () => void;
}

/**
 * Shared create/edit form for both categories and subcategories — their
 * fields are identical except categories additionally have `icon`/`image`.
 * `initial` is only ever read for the initial `useState` value: the parent
 * (CategoriesPage) remounts this component with a fresh `key` whenever the
 * dialog's target changes, rather than this component resetting its own
 * fields via an effect (see docs/frontend.md's note on `set-state-in-effect`).
 */
export function CategoryFormDialog({ open, title, initial, onSave, onClose }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({ name, description: description || undefined, sortOrder: Number(sortOrder) || 0 });
      onClose();
    } catch {
      setError("Could not save. Check the name isn't already in use.");
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
            <label htmlFor="cat-name" className="mb-1 block text-sm font-medium text-slate-700">
              Name
            </label>
            <input
              id="cat-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="cat-description" className="mb-1 block text-sm font-medium text-slate-700">
              Description
            </label>
            <textarea
              id="cat-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="cat-sort-order" className="mb-1 block text-sm font-medium text-slate-700">
              Sort order
            </label>
            <input
              id="cat-sort-order"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
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
