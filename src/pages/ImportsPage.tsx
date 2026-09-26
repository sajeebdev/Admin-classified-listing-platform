import { ImportJobStatus, ImportRecordStatus } from "../shared";
import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, ListingStatusBadge, ModerationStatusBadge } from "../components/Badge";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { ApiClientError } from "../lib/api";
import { createImportSource, listImportSources, testImportSource, updateImportSource } from "../lib/importSources";
import { getImportJob, listImportJobs, runImport } from "../lib/imports";
import { listAdminListings } from "../lib/listings";
import type {
  AdminImportJob,
  AdminImportJobDetail,
  AdminImportSource,
  AdminListing,
  SourceConnectionDiagnostic,
} from "../lib/types";

/** Providers `POST /admin/imports/sources` currently accepts — kept in sync with the backend's own `SUPPORTED_REAL_PROVIDERS` (adapterRegistry.ts). Adding a second real, authorized adapter later means adding one entry here. */
const SUPPORTED_SOURCE_PROVIDERS = ["bedpage"] as const;

const jobStatusTone: Record<ImportJobStatus, "yellow" | "green" | "red"> = {
  RUNNING: "yellow",
  SUCCESS: "green",
  FAILED: "red",
};

const recordStatusTone: Record<ImportRecordStatus, "green" | "neutral" | "red"> = {
  IMPORTED: "green",
  DUPLICATE: "neutral",
  FAILED: "red",
};

/** A source URL is untrusted, source-supplied data — always rendered as a safe, non-opening-window external link, never as a bare `href` a click could hijack the tab from. */
function SourceLink({ url }: { url: string | null }) {
  if (!url) {
    return <span className="text-slate-400">No external URL — this adapter uses mock/local data.</span>;
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="text-blue-600 hover:underline">
      {url}
    </a>
  );
}

/**
 * One job's expandable per-record diagnostics — fetched lazily (only once,
 * on first expand) via `GET /admin/imports/:id`. Shows exactly what
 * happened to every processed source record: result, the listing it
 * created (if any), and — for a failure — the exact pipeline stage and a
 * human-readable reason that always quotes the incoming value that didn't
 * resolve (see docs/importer.md's "mapping diagnostics" section).
 */
function JobDetailRows({ job }: { job: AdminImportJobDetail }) {
  if (job.records.length === 0) {
    return (
      <tr>
        <td colSpan={7} className="px-4 py-3">
          <EmptyState title="No per-record detail was recorded for this job." />
        </td>
      </tr>
    );
  }
  return (
    <>
      {job.records.map((record, i) => (
        <tr key={`${record.externalId ?? "unknown"}-${i}`}>
          <td className="px-4 py-2 font-mono text-xs text-slate-700">{record.externalId ?? "—"}</td>
          <td className="max-w-xs truncate px-4 py-2 text-slate-700">{record.title ?? "—"}</td>
          <td className="px-4 py-2">
            <Badge tone={recordStatusTone[record.status]}>{record.status}</Badge>
          </td>
          <td className="px-4 py-2">
            {record.listingId ? (
              <Link to={`/listings/${record.listingId}`} className="text-blue-600 hover:underline">
                View listing
              </Link>
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </td>
          <td className="px-4 py-2 text-slate-600">{record.failureStage ?? "—"}</td>
          <td className="max-w-sm px-4 py-2 text-slate-600">{record.failureReason ?? "—"}</td>
        </tr>
      ))}
    </>
  );
}

/**
 * The "Test Source" diagnostic result — a read-only connection probe (see
 * docs/importer.md). Renders only the safe fields the backend ever returns
 * — there is no cookie/header/credential/raw-body field to accidentally
 * display here in the first place.
 */
function TestSourceDiagnostic({ diagnostic, onClose }: { diagnostic: SourceConnectionDiagnostic; onClose: () => void }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Connection test result</h3>
        <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:underline">
          Close
        </button>
      </div>
      <p className="mb-3 text-sm text-slate-700">{diagnostic.summary}</p>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-slate-500">DNS</dt>
          <dd className="font-medium text-slate-900">{diagnostic.dnsSucceeded ? "Succeeded" : "Failed"}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">HTTPS connection</dt>
          <dd className="font-medium text-slate-900">{diagnostic.httpsConnectionSucceeded ? "Succeeded" : "Failed"}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">HTTP status</dt>
          <dd className="font-medium text-slate-900">{diagnostic.httpStatus ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Content type</dt>
          <dd className="font-medium text-slate-900">{diagnostic.contentType ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Challenge detected</dt>
          <dd className="font-medium text-slate-900">
            {diagnostic.challengeDetected ? (diagnostic.challengeLabel ?? "Yes") : "No"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Response size</dt>
          <dd className="font-medium text-slate-900">
            {diagnostic.responseBytes !== null ? `${diagnostic.responseBytes} bytes` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Final URL host</dt>
          <dd className="font-medium text-slate-900">{diagnostic.finalUrlHostname ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Redirects followed</dt>
          <dd className="font-medium text-slate-900">{diagnostic.redirectCount ?? "—"}</dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * The "Import Sources" panel — admin-configured, persisted sources (e.g.
 * several allowed Bedpage pages) an admin can add, enable/disable, and run
 * individually, without a separate page per provider (see
 * docs/importer.md). `onSourceRan`/`onViewHistory` let the parent page
 * react (refresh job history, filter it to this source's provider).
 */
function ImportSourcesPanel({
  onSourceRan,
  onViewHistory,
}: {
  onSourceRan: (job: AdminImportJobDetail) => void;
  onViewHistory: (provider: string) => void;
}) {
  const [sources, setSources] = useState<AdminImportSource[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [testingId, setTestingId] = useState<string | null>(null);
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, SourceConnectionDiagnostic>>({});
  const [testError, setTestError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newProvider, setNewProvider] = useState<string>(SUPPORTED_SOURCE_PROVIDERS[0]);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  function load() {
    listImportSources({ limit: 20 })
      .then((result) => setSources(result.items))
      .catch(() => setError("Could not load import sources."));
  }

  useEffect(load, []);

  async function handleAddSource() {
    setAdding(true);
    setAddError(null);
    try {
      await createImportSource({ provider: newProvider, name: newName, sourceUrl: newUrl });
      setShowAddForm(false);
      setNewName("");
      setNewUrl("");
      load();
    } catch (err) {
      setAddError(err instanceof ApiClientError ? err.message : "Could not create this import source.");
    } finally {
      setAdding(false);
    }
  }

  async function handleToggleEnabled(source: AdminImportSource) {
    setTogglingId(source.id);
    setActionError(null);
    try {
      await updateImportSource(source.id, { enabled: !source.enabled });
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not update this source.");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleRunSource(source: AdminImportSource) {
    setRunningId(source.id);
    setActionError(null);
    try {
      const job = await runImport(source.id);
      onSourceRan(job);
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "That import run could not be started.");
    } finally {
      setRunningId(null);
    }
  }

  /** Read-only — never creates an import job or listing (see docs/importer.md). */
  async function handleTestSource(source: AdminImportSource) {
    setTestingId(source.id);
    setTestError(null);
    try {
      const diagnostic = await testImportSource(source.id);
      setTestResults((prev) => ({ ...prev, [source.id]: diagnostic }));
      setExpandedTestId(source.id);
    } catch (err) {
      setTestError(err instanceof ApiClientError ? err.message : "That connection test could not be completed.");
    } finally {
      setTestingId(null);
    }
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">Import sources</h2>
        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {showAddForm ? "Cancel" : "Add source"}
        </button>
      </div>

      {showAddForm ? (
        <div className="mb-4 space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="source-provider" className="mb-1 block text-xs font-medium text-slate-500">
                Provider
              </label>
              <select
                id="source-provider"
                value={newProvider}
                onChange={(e) => setNewProvider(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                {SUPPORTED_SOURCE_PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="source-name" className="mb-1 block text-xs font-medium text-slate-500">
                Name
              </label>
              <input
                id="source-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Bedpage — Los Angeles"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="source-url" className="mb-1 block text-xs font-medium text-slate-500">
                Source URL
              </label>
              <input
                id="source-url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://www.bedpage.com/city/losangeles"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">
                Must be an https:// URL on an approved hostname for the chosen provider — validated server-side
                before anything is saved.
              </p>
            </div>
          </div>
          {addError ? <p className="text-sm text-red-600">{addError}</p> : null}
          <button
            type="button"
            onClick={handleAddSource}
            disabled={adding || !newName.trim() || !newUrl.trim()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {adding ? "Saving…" : "Save source"}
          </button>
        </div>
      ) : null}

      {error ? <ErrorState message={error} /> : null}
      {actionError ? <p className="mb-2 text-sm text-red-600">{actionError}</p> : null}
      {testError ? <p className="mb-2 text-sm text-red-600">{testError}</p> : null}
      {!error && sources === null ? <LoadingState /> : null}
      {!error && sources !== null && sources.length === 0 ? (
        <EmptyState title="No import sources configured yet." />
      ) : null}
      {!error && sources && sources.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Provider</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Access method</th>
                <th className="px-4 py-2">Source URL</th>
                <th className="px-4 py-2">Enabled</th>
                <th className="px-4 py-2">Schedule</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sources.map((source) => (
                <Fragment key={source.id}>
                  <tr>
                    <td className="px-4 py-3 font-medium text-slate-900">{source.provider}</td>
                    <td className="px-4 py-3 text-slate-700">{source.name}</td>
                    <td className="px-4 py-3">
                      <Badge tone={source.accessMethod === "API" ? "blue" : "neutral"}>{source.accessMethod}</Badge>
                    </td>
                    <td className="max-w-xs truncate px-4 py-3">
                      <SourceLink url={source.sourceUrl} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={source.enabled ? "green" : "neutral"}>{source.enabled ? "Enabled" : "Disabled"}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{source.cronSchedule ?? "Daily (global schedule)"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => handleTestSource(source)}
                          disabled={testingId === source.id}
                          className="text-slate-600 hover:underline disabled:opacity-50"
                        >
                          {testingId === source.id ? "Testing…" : "Test source"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRunSource(source)}
                          disabled={runningId === source.id}
                          className="text-blue-600 hover:underline disabled:opacity-50"
                        >
                          {runningId === source.id ? "Running…" : "Run now"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleEnabled(source)}
                          disabled={togglingId === source.id}
                          className="text-slate-600 hover:underline disabled:opacity-50"
                        >
                          {source.enabled ? "Disable" : "Enable"}
                        </button>
                        <button
                          type="button"
                          onClick={() => onViewHistory(source.provider)}
                          className="text-slate-600 hover:underline"
                        >
                          View history
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedTestId === source.id && testResults[source.id] ? (
                    <tr>
                      <td colSpan={7} className="bg-slate-50 px-4 py-4">
                        <TestSourceDiagnostic
                          diagnostic={testResults[source.id]!}
                          onClose={() => setExpandedTestId(null)}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Admin surface for the content importer (see docs/importer.md): import
 * sources (add/enable/disable/run a real, authorized source like Bedpage),
 * job history + a manual "run now" button for the built-in mock source,
 * per-job expandable diagnostics (what happened to every processed record
 * and exactly why), and the imported listings produced so far. Reuses the
 * existing admin listing table/detail page (`ListingDetailPage`, linked
 * from each row) for review/edit/approve — this page itself takes no
 * moderation action.
 */
export function ImportsPage() {
  const [jobs, setJobs] = useState<AdminImportJob[] | null>(null);
  const [jobProviderFilter, setJobProviderFilter] = useState<string>("");
  const [listings, setListings] = useState<AdminListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [jobDetails, setJobDetails] = useState<Record<string, AdminImportJobDetail>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  function load() {
    listImportJobs({ limit: 10, provider: jobProviderFilter || undefined })
      .then((result) => setJobs(result.items))
      .catch(() => setError("Could not load import history."));
    listAdminListings({ imported: true, limit: 20 })
      .then((result) => setListings(result.items))
      .catch(() => setError("Could not load imported listings."));
  }

  useEffect(load, [jobProviderFilter]);

  function cacheJobResult(job: AdminImportJobDetail) {
    // The run response already carries the full per-record diagnostics —
    // cache it immediately so expanding this job needs no extra request.
    setJobDetails((prev) => ({ ...prev, [job.id]: job }));
    setExpandedJobId(job.id);
    load();
  }

  async function handleRunImport() {
    setRunning(true);
    setRunError(null);
    try {
      const job = await runImport();
      cacheJobResult(job);
    } catch (err) {
      setRunError(err instanceof ApiClientError ? err.message : "The import run could not be started.");
    } finally {
      setRunning(false);
    }
  }

  async function toggleDetails(jobId: string) {
    if (expandedJobId === jobId) {
      setExpandedJobId(null);
      return;
    }
    setExpandedJobId(jobId);
    if (jobDetails[jobId]) return;
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await getImportJob(jobId);
      setJobDetails((prev) => ({ ...prev, [jobId]: detail }));
    } catch (err) {
      setDetailError(err instanceof ApiClientError ? err.message : "Could not load this job's diagnostics.");
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Content imports</h1>
        <button
          type="button"
          onClick={handleRunImport}
          disabled={running}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {running ? "Running…" : "Run mock import now"}
        </button>
      </div>
      {runError ? <ErrorState message={runError} /> : null}

      <ImportSourcesPanel onSourceRan={cacheJobResult} onViewHistory={setJobProviderFilter} />

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">Import history</h2>
          {jobProviderFilter ? (
            <button
              type="button"
              onClick={() => setJobProviderFilter("")}
              className="text-sm text-blue-600 hover:underline"
            >
              Showing "{jobProviderFilter}" only — clear filter
            </button>
          ) : null}
        </div>
        {error ? <ErrorState message={error} /> : null}
        {!error && jobs === null ? <LoadingState /> : null}
        {!error && jobs !== null && jobs.length === 0 ? <EmptyState title="No imports have run yet." /> : null}
        {!error && jobs && jobs.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Provider</th>
                  <th className="px-4 py-2">Source</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Started</th>
                  <th className="px-4 py-2">Completed</th>
                  <th className="px-4 py-2">Total</th>
                  <th className="px-4 py-2">Imported</th>
                  <th className="px-4 py-2">Duplicates</th>
                  <th className="px-4 py-2">Failed</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobs.map((job) => (
                  <Fragment key={job.id}>
                    <tr>
                      <td className="px-4 py-3 font-medium text-slate-900">{job.provider}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex gap-1">
                            <Badge tone="neutral">{job.sourceType}</Badge>
                            <Badge tone={job.accessMethod === "API" ? "blue" : "neutral"}>{job.accessMethod}</Badge>
                          </div>
                          <span className="max-w-[220px] truncate text-xs">
                            <SourceLink url={job.sourceUrl} />
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={jobStatusTone[job.status]}>{job.status}</Badge>
                        {job.failureStage ? (
                          <p className="mt-1 max-w-[200px] text-xs text-red-600" title={job.failureReason ?? undefined}>
                            {job.failureStage}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{new Date(job.startedAt).toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {job.completedAt ? new Date(job.completedAt).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3">{job.fetchedCount}</td>
                      <td className="px-4 py-3">{job.importedCount}</td>
                      <td className="px-4 py-3">{job.duplicateCount}</td>
                      <td className="px-4 py-3">{job.failedCount}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => toggleDetails(job.id)}
                          className="text-blue-600 hover:underline"
                        >
                          {expandedJobId === job.id ? "Hide details" : "View details"}
                        </button>
                      </td>
                    </tr>
                    {expandedJobId === job.id ? (
                      <tr>
                        <td colSpan={10} className="bg-slate-50 px-4 py-4">
                          {detailError ? <ErrorState message={detailError} /> : null}
                          {!detailError && detailLoading && !jobDetails[job.id] ? <LoadingState /> : null}
                          {!detailError && jobDetails[job.id] ? (
                            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                              <table className="w-full min-w-[820px] text-left text-sm">
                                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                                  <tr>
                                    <th className="px-4 py-2">External ID</th>
                                    <th className="px-4 py-2">Source item</th>
                                    <th className="px-4 py-2">Result</th>
                                    <th className="px-4 py-2">Listing</th>
                                    <th className="px-4 py-2">Failure stage</th>
                                    <th className="px-4 py-2">Failure reason</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  <JobDetailRows job={jobDetails[job.id]!} />
                                </tbody>
                              </table>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div>
        <h2 className="mb-2 text-base font-semibold text-slate-900">Imported listings</h2>
        <p className="mb-3 text-sm text-slate-500">
          Every imported listing starts as a Draft and must be reviewed, submitted, and approved through the
          same listing detail page as any other listing — nothing here publishes automatically.
        </p>
        {!error && listings === null ? <LoadingState /> : null}
        {!error && listings !== null && listings.length === 0 ? (
          <EmptyState title="No imported listings yet — run the mock import above." />
        ) : null}
        {!error && listings && listings.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Title</th>
                  <th className="px-4 py-2">Provider</th>
                  <th className="px-4 py-2">External ID</th>
                  <th className="px-4 py-2">Category</th>
                  <th className="px-4 py-2">Location</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Moderation</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {listings.map((listing) => (
                  <tr key={listing.id}>
                    <td className="max-w-xs truncate px-4 py-3 font-medium text-slate-900">{listing.title}</td>
                    <td className="px-4 py-3 text-slate-500">{listing.source?.provider ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{listing.source?.externalId ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{listing.category?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {[listing.location.city?.name, listing.location.state?.name].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <ListingStatusBadge status={listing.status} />
                    </td>
                    <td className="px-4 py-3">
                      <ModerationStatusBadge status={listing.moderationStatus} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/listings/${listing.id}`} className="text-blue-600 hover:underline">
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
