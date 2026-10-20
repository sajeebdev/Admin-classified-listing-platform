import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../components/Badge";
import { Pagination } from "../components/Pagination";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { ApiClientError } from "../lib/api";
import { listAdminCategories, listAdminSubcategories } from "../lib/categories";
import { listAdminCountries } from "../lib/locations";
import {
  cancelScrape,
  getScrapeConfig,
  listScrapedItems,
  listScrapeRuns,
  removeScrapedItems,
  restoreScrapedItems,
  saveScrapeConfig,
  startScrape,
  updateScrapedItem,
  uploadScrapedItems,
  type ScrapedItem,
  type ScrapedItemStatus,
  type ScrapeRun,
  type ScrapeTarget,
} from "../lib/scraper";
import type { CategorySummary, CountrySummary, SubcategorySummary } from "../lib/types";

const inputClass = "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";
const btnClass =
  "rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40";
const primaryBtnClass =
  "rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40";

const itemTone: Record<ScrapedItemStatus, "blue" | "yellow" | "green" | "neutral" | "red"> = {
  STAGED: "blue",
  UPLOADING: "yellow",
  UPLOADED: "green",
  REMOVED: "neutral",
  FAILED: "red",
};
const runTone: Record<ScrapeRun["status"], "yellow" | "green" | "red" | "neutral"> = {
  RUNNING: "yellow",
  SUCCESS: "green",
  FAILED: "red",
  CANCELLED: "neutral",
};
const TABS: ScrapedItemStatus[] = ["STAGED", "UPLOADING", "UPLOADED", "FAILED", "REMOVED"];
const PAGE_SIZE = 20;

function errMsg(err: unknown): string {
  return err instanceof ApiClientError || err instanceof Error ? err.message : "Something went wrong";
}

interface TargetRow {
  name: string;
  selector: string;
  get: string;
  fields: string;
}

function toRows(targets: ScrapeTarget[]): TargetRow[] {
  return targets.map((t) => ({
    name: t.name,
    selector: t.selector,
    get: t.get ?? "",
    fields: t.fields ? JSON.stringify(t.fields) : "",
  }));
}

function rowsToTargets(rows: TargetRow[]): ScrapeTarget[] {
  return rows.map((r, i) => {
    const target: ScrapeTarget = { name: r.name.trim(), selector: r.selector.trim() };
    if (r.get.trim()) target.get = r.get.trim();
    if (r.fields.trim()) {
      try {
        const parsed: unknown = JSON.parse(r.fields);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
        target.fields = parsed as Record<string, string>;
      } catch {
        throw new Error(`Row ${i + 1}: "Fields" must be JSON like {"title":"h2","link":"a@href"}`);
      }
    }
    return target;
  });
}

// ---------------------------------------------------------------------------
// 1. Run box
// ---------------------------------------------------------------------------

function RunBox({ run, onStarted, onChanged }: { run: ScrapeRun | null; onStarted: () => void; onChanged: () => void }) {
  const [url, setUrl] = useState("");
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = run?.status === "RUNNING";

  async function handleStart() {
    setBusy(true);
    setError(null);
    try {
      await startScrape({ url: url.trim(), domain: domain.trim() || undefined });
      onStarted();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!run) return;
    try {
      await cancelScrape(run.id);
      onChanged();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">Run scraper</h2>
      <p className="mb-3 text-xs text-slate-500">
        Same as <code>npm run scrape -- "https://your-page.com/path" example.com</code>
      </p>
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
        <input
          aria-label="Page URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-page.com/path"
          className={inputClass}
          disabled={running}
        />
        <input
          aria-label="Main domain"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="example.com (optional)"
          className={inputClass}
          disabled={running}
        />
        {running ? (
          <button type="button" onClick={handleCancel} className={btnClass}>
            Cancel run
          </button>
        ) : (
          <button type="button" onClick={handleStart} disabled={busy || !url.trim()} className={primaryBtnClass}>
            {busy ? "Starting…" : "Run scrape"}
          </button>
        )}
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      {run ? (
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={runTone[run.status]}>{run.status}</Badge>
            <span className="truncate text-slate-600">{run.url}</span>
          </div>
          {run.status !== "RUNNING" ? (
            <p className="text-xs text-slate-600">
              links {run.counts.linksFound} · scraped {run.counts.scraped} · <b>listed {run.counts.staged}</b> · incomplete
              skipped {run.counts.skippedIncomplete} · duplicates blocked {run.counts.duplicatesBlocked} · failed{" "}
              {run.counts.failed}
            </p>
          ) : null}
          {run.error ? <p className="text-sm text-red-600">{run.error}</p> : null}
          {run.logTail ? (
            <pre className="max-h-48 overflow-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">{run.logTail}</pre>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 2. Targets editor
// ---------------------------------------------------------------------------

function TargetsEditor() {
  const [rows, setRows] = useState<TargetRow[] | null>(null);
  const [defaults, setDefaults] = useState<ScrapeTarget[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    getScrapeConfig()
      .then((c) => {
        setRows(toRows(c.targets));
        setDefaults(c.defaults);
      })
      .catch((err) => setMessage({ ok: false, text: errMsg(err) }));
  }, []);

  function update(i: number, patch: Partial<TargetRow>) {
    setRows((prev) => (prev ? prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) : prev));
  }

  async function handleSave() {
    if (!rows) return;
    setSaving(true);
    setMessage(null);
    try {
      const saved = await saveScrapeConfig(rowsToTargets(rows));
      setRows(toRows(saved.targets));
      setMessage({ ok: true, text: "Targets saved — the next run will use them." });
    } catch (err) {
      setMessage({ ok: false, text: errMsg(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Selectors (TARGETS)</h2>
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-sm text-blue-600 hover:underline">
          {open ? "Hide" : "Show / edit"}
        </button>
      </div>
      {open && rows ? (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-slate-500">
            <b>get</b>: text · href · src · html · rawtext · bg (or any attribute). Leave <b>get</b> empty for text. For a
            parent/container, fill <b>Fields</b> as JSON, e.g. <code>{'{"title":"h2","link":"a@href"}'}</code>. Keep names{" "}
            <code>imgbox</code>, <code>description</code> (or <code>description-content</code>) and <code>userinfo</code> —
            the required-data check and age / mobile / city / address use them.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="px-2 py-1">Name</th>
                  <th className="px-2 py-1">Selector</th>
                  <th className="px-2 py-1">get</th>
                  <th className="px-2 py-1">Fields (JSON, optional)</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1">
                      <input aria-label="Name" value={r.name} onChange={(e) => update(i, { name: e.target.value })} className={inputClass} />
                    </td>
                    <td className="px-2 py-1">
                      <input aria-label="Selector" value={r.selector} onChange={(e) => update(i, { selector: e.target.value })} className={`${inputClass} font-mono`} />
                    </td>
                    <td className="px-2 py-1">
                      <input aria-label="get" value={r.get} onChange={(e) => update(i, { get: e.target.value })} className={inputClass} />
                    </td>
                    <td className="px-2 py-1">
                      <input aria-label="Fields" value={r.fields} onChange={(e) => update(i, { fields: e.target.value })} className={`${inputClass} font-mono`} />
                    </td>
                    <td className="px-2 py-1">
                      <button type="button" onClick={() => setRows(rows.filter((_, idx) => idx !== i))} className="text-sm text-red-600 hover:underline">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setRows([...rows, { name: "", selector: "", get: "text", fields: "" }])} className={btnClass}>
              Add target
            </button>
            <button type="button" onClick={() => setRows(toRows(defaults))} className={btnClass}>
              Reset to default
            </button>
            <button type="button" onClick={handleSave} disabled={saving} className={primaryBtnClass}>
              {saving ? "Saving…" : "Save targets"}
            </button>
            {message ? <span className={`text-sm ${message.ok ? "text-green-700" : "text-red-600"}`}>{message.text}</span> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 3. Ads table
// ---------------------------------------------------------------------------

interface Draft {
  title: string;
  description: string;
  age: string;
  mobile: string;
  city: string;
  address: string;
}

function ItemRow({
  item,
  selected,
  onToggle,
  onChanged,
  onError,
}: {
  item: ScrapedItem;
  selected: boolean;
  onToggle: () => void;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const actionable = item.status === "STAGED" || item.status === "FAILED";

  function startEdit() {
    setDraft({
      title: item.title,
      description: item.description,
      age: item.age ?? "",
      mobile: item.mobile ?? "",
      city: item.city ?? "",
      address: item.address ?? "",
    });
  }

  async function saveEdit() {
    if (!draft) return;
    setSaving(true);
    try {
      await updateScrapedItem(item.id, {
        title: draft.title,
        description: draft.description,
        age: draft.age || null,
        mobile: draft.mobile || null,
        city: draft.city || null,
        address: draft.address || null,
      });
      setDraft(null);
      onChanged();
    } catch (err) {
      onError(errMsg(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    try {
      await removeScrapedItems([item.id]);
      onChanged();
    } catch (err) {
      onError(errMsg(err));
    }
  }

  async function restore() {
    try {
      await restoreScrapedItems([item.id]);
      onChanged();
    } catch (err) {
      onError(errMsg(err));
    }
  }

  const editing = draft !== null;

  return (
    <tr className="align-top">
      <td className="px-3 py-2">
        {actionable ? <input type="checkbox" aria-label={`Select ${item.title}`} checked={selected} onChange={onToggle} /> : null}
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1">
          {item.images.map((src) => (
            <a key={src} href={src} target="_blank" rel="noopener noreferrer nofollow">
              <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-16 w-16 rounded border border-slate-200 object-cover" />
            </a>
          ))}
        </div>
      </td>
      <td className="max-w-md px-3 py-2">
        {editing ? (
          <div className="space-y-2">
            <input aria-label="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={inputClass} />
            <textarea aria-label="Description" rows={5} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={inputClass} />
          </div>
        ) : (
          <>
            <p className="font-medium text-slate-900">{item.title}</p>
            <p className={`mt-1 whitespace-pre-line text-slate-600 ${expanded ? "" : "line-clamp-3"}`}>{item.description}</p>
            {item.description.length > 160 ? (
              <button type="button" onClick={() => setExpanded((v) => !v)} className="text-xs text-blue-600 hover:underline">
                {expanded ? "Show less" : "Show full"}
              </button>
            ) : null}
          </>
        )}
      </td>
      <td className="px-3 py-2 text-slate-700">
        {editing ? (
          <div className="space-y-2">
            <input aria-label="Age" placeholder="Age" value={draft.age} onChange={(e) => setDraft({ ...draft, age: e.target.value })} className={inputClass} />
            <input aria-label="Mobile" placeholder="Mobile" value={draft.mobile} onChange={(e) => setDraft({ ...draft, mobile: e.target.value })} className={inputClass} />
            <input aria-label="City" placeholder="City" value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} className={inputClass} />
            <input aria-label="Address" placeholder="Address" value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} className={inputClass} />
          </div>
        ) : (
          <dl className="space-y-0.5 text-xs">
            <div><dt className="inline text-slate-400">Age: </dt><dd className="inline">{item.age ?? "—"}</dd></div>
            <div><dt className="inline text-slate-400">Mobile: </dt><dd className="inline">{item.mobile ?? "—"}</dd></div>
            <div><dt className="inline text-slate-400">City: </dt><dd className="inline">{item.city ?? "—"}</dd></div>
            <div><dt className="inline text-slate-400">Address: </dt><dd className="inline">{item.address ?? "—"}</dd></div>
          </dl>
        )}
      </td>
      <td className="px-3 py-2">
        <a href={item.url} target="_blank" rel="noopener noreferrer nofollow" className="text-blue-600 hover:underline">
          Source
        </a>
      </td>
      <td className="px-3 py-2">
        <Badge tone={itemTone[item.status]}>{item.status}</Badge>
        {item.error ? <p className="mt-1 max-w-[12rem] text-xs text-red-600">{item.error}</p> : null}
      </td>
      <td className="whitespace-nowrap px-3 py-2">
        <div className="flex flex-col items-start gap-1 text-sm">
          {actionable && !editing ? (
            <>
              <button type="button" onClick={startEdit} className="text-blue-600 hover:underline">Edit</button>
              <button type="button" onClick={remove} className="text-red-600 hover:underline">Remove</button>
            </>
          ) : null}
          {editing ? (
            <>
              <button type="button" onClick={saveEdit} disabled={saving} className="text-blue-600 hover:underline">{saving ? "Saving…" : "Save"}</button>
              <button type="button" onClick={() => setDraft(null)} className="text-slate-500 hover:underline">Cancel</button>
            </>
          ) : null}
          {item.status === "REMOVED" ? (
            <button type="button" onClick={restore} className="text-blue-600 hover:underline">Restore</button>
          ) : null}
          {item.listingId ? (
            <Link to={`/listings/${item.listingId}`} className="text-blue-600 hover:underline">View listing</Link>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function UploadBar({
  selectedIds,
  stagedCount,
  onDone,
  onError,
}: {
  selectedIds: string[];
  stagedCount: number;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategorySummary[]>([]);
  const [countries, setCountries] = useState<CountrySummary[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [countryId, setCountryId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listAdminCategories({ limit: 100 }).then((r) => setCategories(r.items.filter((c) => c.isActive))).catch(() => undefined);
    listAdminCountries({ limit: 100 }).then((r) => setCountries(r.items.filter((c) => c.isActive !== false))).catch(() => undefined);
  }, []);
  useEffect(() => {
    setSubcategoryId("");
    setSubcategories([]);
    if (categoryId) listAdminSubcategories(categoryId, { limit: 100 }).then((r) => setSubcategories(r.items.filter((s) => s.isActive !== false))).catch(() => undefined);
  }, [categoryId]);

  const ready = Boolean(categoryId && countryId);

  async function upload(all: boolean) {
    setBusy(true);
    try {
      await uploadScrapedItems({
        categoryId,
        subcategoryId: subcategoryId || undefined,
        countryId,
        ...(all ? { all: true } : { ids: selectedIds }),
      });
      onDone();
    } catch (err) {
      onError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  const select = (label: string, value: string, set: (v: string) => void, options: { id: string; name: string }[], disabled = false) => (
    <select aria-label={label} value={value} onChange={(e) => set(e.target.value)} disabled={disabled} className={inputClass}>
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>{o.name}</option>
      ))}
    </select>
  );

  return (
    <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs text-slate-600">
        Choose the category and country. The city (and its state) is taken from each ad automatically. Ads are published immediately.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {select("Category", categoryId, setCategoryId, categories)}
        {select("Subcategory (optional)", subcategoryId, setSubcategoryId, subcategories, !categoryId)}
        {select("Country", countryId, setCountryId, countries)}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!ready || busy || selectedIds.length === 0} onClick={() => upload(false)} className={primaryBtnClass}>
          Upload selected ({selectedIds.length})
        </button>
        <button type="button" disabled={!ready || busy || stagedCount === 0} onClick={() => upload(true)} className={btnClass}>
          Upload all listed ({stagedCount})
        </button>
      </div>
    </div>
  );
}

function AdsTable({ refreshKey, bump }: { refreshKey: number; bump: () => void }) {
  const [tab, setTab] = useState<ScrapedItemStatus>("STAGED");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ScrapedItem[] | null>(null);
  const [counts, setCounts] = useState<Record<ScrapedItemStatus, number> | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listScrapedItems({ status: tab, page, limit: PAGE_SIZE })
      .then((r) => {
        setItems(r.items);
        setCounts(r.counts);
        setTotalPages(r.totalPages);
        setSelected((prev) => new Set([...prev].filter((id) => r.items.some((i) => i.id === id))));
      })
      .catch((err) => setError(errMsg(err)));
  }, [tab, page]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  // Uploads run in the background — keep refreshing while any ad is still uploading.
  const uploading = (counts?.UPLOADING ?? 0) > 0;
  useEffect(() => {
    if (!uploading) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [uploading, load]);

  const selectableIds = useMemo(
    () => (items ?? []).filter((i) => i.status === "STAGED" || i.status === "FAILED").map((i) => i.id),
    [items],
  );
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function removeSelected() {
    try {
      await removeScrapedItems([...selected]);
      setSelected(new Set());
      load();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Scraped ads</h2>
      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setPage(1);
              setSelected(new Set());
            }}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-medium ${tab === t ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            {t === "STAGED" ? "Listed" : t.charAt(0) + t.slice(1).toLowerCase()} ({counts?.[t] ?? 0})
          </button>
        ))}
      </div>

      {error ? <ErrorState message={error} /> : null}

      {tab === "STAGED" || tab === "FAILED" ? (
        <UploadBar selectedIds={[...selected]} stagedCount={counts?.STAGED ?? 0} onDone={() => { setSelected(new Set()); load(); bump(); }} onError={setError} />
      ) : null}

      {selected.size > 0 ? (
        <div>
          <button type="button" onClick={removeSelected} className={btnClass}>
            Remove selected ({selected.size})
          </button>
        </div>
      ) : null}

      {items === null ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState title="No ads here." />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allSelected}
                    disabled={selectableIds.length === 0}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(selectableIds))}
                  />
                </th>
                <th className="px-3 py-2">Images</th>
                <th className="px-3 py-2">Title / description</th>
                <th className="px-3 py-2">Details</th>
                <th className="px-3 py-2">Link</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  selected={selected.has(item.id)}
                  onToggle={() => toggle(item.id)}
                  onChanged={load}
                  onError={setError}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// 4. Run history
// ---------------------------------------------------------------------------

function RunHistory({ runs }: { runs: ScrapeRun[] }) {
  if (runs.length === 0) return null;
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-semibold text-slate-900">Run history</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Started</th>
              <th className="px-3 py-2">URL</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Listed</th>
              <th className="px-3 py-2">Incomplete</th>
              <th className="px-3 py-2">Duplicates blocked</th>
              <th className="px-3 py-2">Failed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {runs.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">{new Date(r.startedAt).toLocaleString()}</td>
                <td className="max-w-xs truncate px-3 py-2 text-slate-700">{r.url}</td>
                <td className="px-3 py-2"><Badge tone={runTone[r.status]}>{r.status}</Badge></td>
                <td className="px-3 py-2">{r.counts.staged}</td>
                <td className="px-3 py-2">{r.counts.skippedIncomplete}</td>
                <td className="px-3 py-2">{r.counts.duplicatesBlocked}</td>
                <td className="px-3 py-2">{r.counts.failed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

export function ScraperPage() {
  const [runs, setRuns] = useState<ScrapeRun[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const latest = runs[0] ?? null;
  const running = latest?.status === "RUNNING";

  const wasRunning = useRef(false);
  const loadRuns = useCallback(() => {
    listScrapeRuns({ limit: 10 })
      .then((r) => {
        setRuns(r.items);
        setLoadError(null);
        // A scrape just finished: refresh the ads table once so the new ads appear.
        const nowRunning = r.items[0]?.status === "RUNNING";
        if (wasRunning.current && !nowRunning) setRefreshKey((k) => k + 1);
        wasRunning.current = nowRunning;
      })
      .catch((err) => setLoadError(errMsg(err)));
  }, []);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  // Poll while a scrape is running; when it finishes, refresh the ads table once.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(loadRuns, 2500);
    return () => clearInterval(t);
  }, [running, loadRuns]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Scraper</h1>
      {loadError ? <ErrorState message={loadError} /> : null}
      <RunBox run={latest} onStarted={loadRuns} onChanged={loadRuns} />
      <TargetsEditor />
      <AdsTable refreshKey={refreshKey} bump={() => setRefreshKey((k) => k + 1)} />
      <RunHistory runs={runs} />
    </div>
  );
}
