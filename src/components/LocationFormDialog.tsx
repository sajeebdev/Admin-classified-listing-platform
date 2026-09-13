import { useState } from "react";

export interface LocationFormValues {
  name: string;
  code: string;
  sortOrder: string;
}

interface Props {
  open: boolean;
  title: string;
  showCode: boolean;
  codeRequired?: boolean;
  initial?: { name: string; code?: string | null; sortOrder?: number };
  onSave: (values: { name: string; code?: string; sortOrder: number }) => Promise<void>;
  onClose: () => void;
}

/**
 * Shared create/edit form for countries, states, and cities — they differ
 * only in whether/how `code` applies. Like `CategoryFormDialog`, `initial`
 * is only read for the initial `useState` value — the parent remounts this
 * with a fresh `key` per dialog target instead of resetting fields via an
 * effect.
 */
export function LocationFormDialog({ open, title, showCode, codeRequired, initial, onSave, onClose }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({ name, code: code || undefined, sortOrder: Number(sortOrder) || 0 });
      onClose();
    } catch {
      setError("Could not save. Check the name/code isn't already in use.");
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
            <label htmlFor="loc-name" className="mb-1 block text-sm font-medium text-slate-700">
              Name
            </label>
            <input
              id="loc-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          {showCode ? (
            <div>
              <label htmlFor="loc-code" className="mb-1 block text-sm font-medium text-slate-700">
                Code {codeRequired ? "(ISO 3166-1, e.g. US)" : "(optional)"}
              </label>
              <input
                id="loc-code"
                required={codeRequired}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase"
              />
            </div>
          ) : null}
          <div>
            <label htmlFor="loc-sort-order" className="mb-1 block text-sm font-medium text-slate-700">
              Sort order
            </label>
            <input
              id="loc-sort-order"
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
