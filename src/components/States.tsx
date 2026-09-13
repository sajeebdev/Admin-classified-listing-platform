export function LoadingState() {
  return <p className="py-8 text-center text-sm text-slate-500">Loading…</p>;
}

export function EmptyState({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 px-6 py-12 text-center text-sm text-slate-500">
      {title}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">
      {message}
    </div>
  );
}

/** Used when the requested feature has no corresponding backend endpoint yet — never a fabricated stat or fake success state. */
export function UnavailableState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
      {label} is not available yet — no backend endpoint exists for it.
    </div>
  );
}
