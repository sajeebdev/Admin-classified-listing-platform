import { useEffect, useState, type ChangeEvent } from "react";
import { ApiClientError } from "../../lib/api";
import { listAdminCategories } from "../../lib/categories";
import { listAdminCountries, listAdminStates } from "../../lib/locations";
import {
  parseListingHtml,
  uploadImportFile,
  type HtmlListingExtraction,
  type HtmlParserField,
  type HtmlParserSelectors,
} from "../../lib/imports";
import type { CategorySummary, CountrySummary, StateSummary } from "../../lib/types";
import type { AdminImportJobDetail } from "../../lib/types";

const SELECTOR_FIELDS: HtmlParserField[] = [
  "externalId",
  "sourceUrl",
  "title",
  "description",
  "category",
  "subcategory",
  "country",
  "state",
  "city",
  "price",
  "publishedAt",
  "images",
];
const MAX_HTML_SOURCE_BYTES = 400_000;

const SELECTOR_LABELS: Record<HtmlParserField, string> = {
  externalId: "External ID",
  sourceUrl: "Source URL",
  title: "Title",
  description: "Description",
  category: "Category",
  subcategory: "Subcategory",
  country: "Country",
  state: "State",
  city: "City",
  price: "Price",
  publishedAt: "Published date",
  images: "Images",
};

const REQUIRED_FIELDS: (keyof EditableListing)[] = [
  "externalId",
  "title",
  "description",
  "city",
];

type EditableListing = Omit<HtmlListingExtraction["listing"], "price" | "images"> & { price: string };
type ImageMapping = { reference: string; included: boolean; file: File | null };

function editableListing(extraction: HtmlListingExtraction): EditableListing {
  const fields = extraction.listing;
  return {
    externalId: fields.externalId,
    sourceUrl: fields.sourceUrl,
    title: fields.title,
    description: fields.description,
    category: fields.category,
    subcategory: fields.subcategory,
    country: fields.country,
    state: fields.state,
    city: fields.city,
    publishedAt: toDateTimeLocal(fields.publishedAt),
    price: fields.price === null ? "" : String(fields.price),
  };
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function toDateTimeLocal(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function toPublishedAtIso(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function findCategory(value: string, categories: CategorySummary[]): CategorySummary | undefined {
  const normalized = normalizeName(value);
  if (!normalized) return undefined;
  return categories.find(
    (category) => category.isActive !== false && [category.name, category.slug].some((entry) => normalizeName(entry) === normalized),
  );
}

function findCountry(value: string, countries: CountrySummary[]): CountrySummary | undefined {
  const normalized = normalizeName(value);
  if (!normalized) return undefined;
  return countries.find(
    (country) =>
      country.isActive !== false &&
      [country.name, country.slug, country.code].some((entry) => normalizeName(entry) === normalized),
  );
}

function findState(value: string, states: StateSummary[]): StateSummary | undefined {
  const normalized = normalizeName(value);
  if (!normalized) return undefined;
  return states.find(
    (state) =>
      state.isActive !== false &&
      [state.name, state.slug, state.code ?? ""].some((entry) => normalizeName(entry) === normalized),
  );
}

function generatedFilename(file: File, index: number): string {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return `html-image-${index + 1}.${extensions[file.type] ?? "img"}`;
}

export function HtmlListingParser({
  html,
  onHtmlChange,
  onImported,
}: {
  html: string;
  onHtmlChange: (html: string) => void;
  onImported: (job: AdminImportJobDetail) => void;
}) {
  const [sourceName, setSourceName] = useState("HTML parser import");
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [countries, setCountries] = useState<CountrySummary[]>([]);
  const [states, setStates] = useState<StateSummary[]>([]);
  const [taxonomyLoading, setTaxonomyLoading] = useState(true);
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null);
  const [stateSuggestion, setStateSuggestion] = useState("");
  const [selectors, setSelectors] = useState<HtmlParserSelectors>({});
  const [extraction, setExtraction] = useState<HtmlListingExtraction | null>(null);
  const [listing, setListing] = useState<EditableListing | null>(null);
  const [imageMappings, setImageMappings] = useState<ImageMapping[]>([]);
  const [generatedJson, setGeneratedJson] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [parseLoading, setParseLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [htmlTooLarge, setHtmlTooLarge] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([listAdminCategories({ limit: 100 }), listAdminCountries({ limit: 100 })])
      .then(([categoryResult, countryResult]) => {
        if (!active) return;
        setCategories(categoryResult.items.filter((category) => category.isActive !== false));
        setCountries(countryResult.items.filter((country) => country.isActive !== false));
      })
      .catch(() => {
        if (active) setTaxonomyError("Could not load the existing category and country lists.");
      })
      .finally(() => {
        if (active) setTaxonomyLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedCountry = countries.find((country) => country.name === listing?.country);
  useEffect(() => {
    let active = true;
    if (!selectedCountry) {
      setStates([]);
      return () => {
        active = false;
      };
    }

    setStates([]);
    listAdminStates(selectedCountry.id, { limit: 100 })
      .then((result) => {
        if (!active) return;
        const activeStates = result.items.filter((state) => state.isActive !== false);
        setStates(activeStates);
        if (stateSuggestion) {
          const matchingState = findState(stateSuggestion, activeStates);
          if (matchingState) {
            setListing((current) =>
              current && current.country === selectedCountry.name && !current.state
                ? { ...current, state: matchingState.name }
                : current,
            );
          }
          setStateSuggestion("");
        }
      })
      .catch(() => {
        if (active) setTaxonomyError(`Could not load states for ${selectedCountry.name}.`);
      });
    return () => {
      active = false;
    };
  }, [selectedCountry?.id, selectedCountry?.name, stateSuggestion]);

  async function handleHtmlFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_HTML_SOURCE_BYTES) {
      setParseError("HTML files must be 400 KB or smaller.");
      return;
    }
    setParseError(null);
    onHtmlChange(await file.text());
    setHtmlTooLarge(false);
    setExtraction(null);
    setListing(null);
    setImageMappings([]);
    setGeneratedJson("");
  }

  async function handleParse() {
    setParseLoading(true);
    setParseError(null);
    setValidationErrors([]);
    setGeneratedJson("");
    try {
      const result = await parseListingHtml(html, selectors);
      setExtraction(result);
      setListing((current) => {
        const parsed = editableListing(result);
        const parsedCategory = findCategory(result.listing.category, categories);
        const existingCategory = current ? findCategory(current.category, categories) : undefined;
        const parsedCountry = findCountry(result.listing.country, countries);
        const existingCountry = current ? findCountry(current.country, countries) : undefined;
        const category = existingCategory?.slug ?? parsedCategory?.slug ?? "";
        const country = existingCountry?.name ?? parsedCountry?.name ?? "";
        const state =
          current?.country === country && current.state && findState(current.state, states)
            ? findState(current.state, states)!.name
            : "";
        const publishedAt = current?.publishedAt && toPublishedAtIso(current.publishedAt)
          ? current.publishedAt
          : parsed.publishedAt;
        return { ...parsed, category, country, state, publishedAt };
      });
      setStateSuggestion(result.listing.state);
      setImageMappings(result.imageReferences.map((reference) => ({ reference, included: true, file: null })));
      setParseWarnings(result.warnings);
    } catch (err) {
      setParseError(err instanceof ApiClientError ? err.message : "HTML could not be parsed.");
      setExtraction(null);
      setListing(null);
    } finally {
      setParseLoading(false);
    }
  }

  function updateField<K extends keyof EditableListing>(field: K, value: EditableListing[K]) {
    setListing((current) => (current ? { ...current, [field]: value } : current));
    setGeneratedJson("");
    setValidationErrors([]);
  }

  function handleCountryChange(countryName: string) {
    setListing((current) => (current ? { ...current, country: countryName, state: "" } : current));
    setStateSuggestion("");
    setGeneratedJson("");
    setValidationErrors([]);
    setTaxonomyError(null);
  }

  function updateImage(index: number, change: Partial<ImageMapping>) {
    setImageMappings((current) => current.map((image, imageIndex) => (imageIndex === index ? { ...image, ...change } : image)));
    setGeneratedJson("");
    setValidationErrors([]);
  }

  function buildRecord() {
    if (!listing) return null;
    const selectedMappings = imageMappings.filter((mapping) => mapping.included && mapping.file);
    const filenames = selectedMappings.map((mapping, index) => generatedFilename(mapping.file!, index));
    const record: Record<string, unknown> = {
      externalId: listing.externalId.trim(),
      sourceUrl: listing.sourceUrl.trim(),
      title: listing.title.trim(),
      description: listing.description.trim(),
      category: listing.category.trim(),
      subcategory: listing.subcategory.trim(),
      country: listing.country.trim(),
      state: listing.state.trim(),
      city: listing.city.trim(),
      publishedAt: toPublishedAtIso(listing.publishedAt),
      images: filenames,
    };
    if (listing.price.trim()) record.price = Number(listing.price);
    return { record, selectedMappings };
  }

  function validateRecord(): string[] {
    if (!listing) return ["Parse HTML before generating a listing record."];
    const errors = REQUIRED_FIELDS.filter((field) => !listing[field].trim()).map(
      (field) => `${SELECTOR_LABELS[field]} is required before import.`,
    );
    if (!listing.category.trim()) errors.push("Category is required before import.");
    else if (!findCategory(listing.category, categories)) errors.push("Select a valid active category before import.");
    if (!listing.country.trim()) errors.push("Country is required before import.");
    else if (!findCountry(listing.country, countries)) errors.push("Select a valid active country before import.");
    if (!listing.state.trim()) errors.push("State is required before import.");
    else if (!states.some((state) => state.name === listing.state && state.countryId === selectedCountry?.id)) {
      errors.push("Select a valid state for the selected country before import.");
    }
    if (!listing.publishedAt.trim()) errors.push("Published date is required before import.");
    else if (!toPublishedAtIso(listing.publishedAt)) errors.push("Published date must be valid before import.");
    if (listing.price.trim() && (!Number.isFinite(Number(listing.price)) || Number(listing.price) < 0)) {
      errors.push("Price must be a non-negative number.");
    }
    if (!sourceName.trim()) errors.push("Source name is required.");
    imageMappings.forEach((mapping, index) => {
      if (mapping.included && !mapping.file) errors.push(`Image reference ${index + 1} needs a local file or must be excluded.`);
    });
    return errors;
  }

  function handleGenerateJson() {
    const built = buildRecord();
    if (!built) return;
    setGeneratedJson(JSON.stringify([built.record], null, 2));
    setValidationErrors(validateRecord());
  }

  function handleDownloadJson() {
    if (!generatedJson) return;
    const blob = new Blob([generatedJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "html-listing-import.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    const errors = validateRecord();
    setValidationErrors(errors);
    const built = buildRecord();
    if (!built || errors.length > 0) return;

    const json = JSON.stringify([built.record], null, 2);
    setGeneratedJson(json);
    const formData = new FormData();
    formData.set("sourceName", sourceName.trim());
    formData.set("file", new Blob([json], { type: "application/json" }), "html-listing-import.json");
    built.selectedMappings.forEach((mapping, index) => {
      formData.append("images", mapping.file!, generatedFilename(mapping.file!, index));
    });

    setImportLoading(true);
    setImportMessage(null);
    try {
      const job = await uploadImportFile(formData);
      onImported(job);
      setImportMessage(`Import complete: ${job.importedCount} imported, ${job.duplicateCount} duplicates, ${job.failedCount} failed.`);
    } catch (err) {
      setImportMessage(err instanceof ApiClientError ? err.message : "The extracted listing could not be imported.");
    } finally {
      setImportLoading(false);
    }
  }

  const currentValidationErrors = listing ? validateRecord() : [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900">HTML-to-JSON listing parser</h2>
        <p className="mt-1 text-sm text-slate-600">
          Parse authorized source HTML locally. Scripts are never run, and no source or image URL is fetched.
        </p>
      </div>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <label htmlFor="html-source-file" className="mb-1 block text-xs font-medium text-slate-600">
              HTML file
            </label>
            <input
              id="html-source-file"
              type="file"
              accept=".html,.htm,text/html"
              onChange={handleHtmlFile}
              className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:text-sm"
            />
          </div>
          <span className="text-xs text-slate-500">or paste source below</span>
        </div>
        <label htmlFor="html-source" className="block text-xs font-medium text-slate-600">
          Raw HTML source
        </label>
        <textarea
          id="html-source"
          rows={12}
          value={html}
          onChange={(event) => {
            const value = event.target.value;
            const tooLarge = new TextEncoder().encode(value).length > MAX_HTML_SOURCE_BYTES;
            onHtmlChange(value);
            setHtmlTooLarge(tooLarge);
            setParseError(tooLarge ? "HTML source must be 400 KB or smaller; the pasted text has been preserved." : null);
          }}
          placeholder="Paste authorized listing page HTML here"
          spellCheck={false}
          className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs text-slate-800"
        />

        <details className="rounded-md border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">Listing-specific CSS selectors (optional)</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SELECTOR_FIELDS.map((field) => (
              <label key={field} className="text-xs font-medium text-slate-600">
                {SELECTOR_LABELS[field]}
                <input
                  value={selectors[field] ?? ""}
                  onChange={(event) => setSelectors((current) => ({ ...current, [field]: event.target.value }))}
                  placeholder={field === "images" ? ".gallery img" : `Selector for ${field}`}
                  maxLength={256}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 font-normal"
                />
              </label>
            ))}
          </div>
        </details>

        {parseError ? <p className="text-sm text-red-600">{parseError}</p> : null}
        {taxonomyError ? <p role="alert" className="text-sm text-red-600">{taxonomyError}</p> : null}
        <button
          type="button"
          onClick={handleParse}
          disabled={parseLoading || taxonomyLoading || !html.trim() || htmlTooLarge}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {parseLoading ? "Parsing…" : taxonomyLoading ? "Loading taxonomy…" : "Parse HTML"}
        </button>
      </section>

      {extraction && listing ? (
        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Extraction preview and editable fields</h3>
            <p className="mt-1 text-xs text-slate-500">
              Missing values remain blank and are flagged for review. Values are rendered as text; source markup is never inserted into the page.
            </p>
          </div>
          {parseWarnings.length > 0 ? (
            <ul className="list-inside list-disc text-sm text-amber-700">
              {parseWarnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
            </ul>
          ) : null}
          <section className="space-y-3 border-y border-slate-200 py-4">
            <h4 className="text-sm font-semibold text-slate-900">Required Listing Information</h4>
            {taxonomyError ? <p role="alert" className="text-sm text-red-600">{taxonomyError}</p> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-slate-600">
                Category *
                <select
                  value={listing.category}
                  onChange={(event) => updateField("category", event.target.value)}
                  disabled={taxonomyLoading || categories.length === 0}
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
                >
                  <option value="">Select category</option>
                  {categories.map((category) => <option key={category.id} value={category.slug}>{category.name}</option>)}
                </select>
              </label>
              <label className="text-xs font-medium text-slate-600">
                Country *
                <select
                  value={listing.country}
                  onChange={(event) => handleCountryChange(event.target.value)}
                  disabled={taxonomyLoading || countries.length === 0}
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
                >
                  <option value="">Select country</option>
                  {countries.map((country) => <option key={country.id} value={country.name}>{country.name}</option>)}
                </select>
              </label>
              <label className="text-xs font-medium text-slate-600">
                State *
                <select
                  value={listing.state}
                  onChange={(event) => updateField("state", event.target.value)}
                  disabled={!selectedCountry || states.length === 0}
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
                >
                  <option value="">Select state</option>
                  {states.map((state) => <option key={state.id} value={state.name}>{state.name}</option>)}
                </select>
              </label>
              <label className="text-xs font-medium text-slate-600">
                Published Date *
                <input
                  type="datetime-local"
                  value={listing.publishedAt}
                  onChange={(event) => updateField("publishedAt", event.target.value)}
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
                />
              </label>
            </div>
          </section>
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(SELECTOR_LABELS) as (keyof EditableListing)[])
              .filter((field) => !["description", "category", "country", "state", "publishedAt"].includes(field))
              .map((field) => (
              <label key={field} className="text-xs font-medium text-slate-600">
                {SELECTOR_LABELS[field]}
                <input
                  value={listing[field]}
                  onChange={(event) => updateField(field, event.target.value)}
                  type={field === "price" ? "number" : "text"}
                  min={field === "price" ? "0" : undefined}
                  step={field === "price" ? "any" : undefined}
                  className={`mt-1 w-full rounded-md border px-3 py-2 text-sm font-normal ${extraction.missingFields.includes(field) && !listing[field].trim() ? "border-amber-400" : "border-slate-300"}`}
                />
              </label>
            ))}
            <label className="text-xs font-medium text-slate-600 sm:col-span-2">
              Description
              <textarea
                rows={5}
                value={listing.description}
                onChange={(event) => updateField("description", event.target.value)}
                className={`mt-1 w-full rounded-md border px-3 py-2 text-sm font-normal ${!listing.description.trim() ? "border-amber-400" : "border-slate-300"}`}
              />
            </label>
          </div>

          <div className="grid gap-2 border-t border-slate-200 pt-3 text-sm sm:grid-cols-2">
            <p><span className="font-medium text-slate-700">Post ID:</span> {extraction.details.postId || "Not found"}</p>
            <p><span className="font-medium text-slate-700">Age:</span> {extraction.details.age || "Not found"}</p>
            <p><span className="font-medium text-slate-700">Mobile:</span> {extraction.details.mobile || "Not found"}</p>
            <p><span className="font-medium text-slate-700">Address:</span> {extraction.details.address || "Not found"}</p>
            <p><span className="font-medium text-slate-700">City:</span> {extraction.details.city || "Not found"}</p>
            <p><span className="font-medium text-slate-700">State:</span> {extraction.details.state || "Not confidently identified"}</p>
            <p><span className="font-medium text-slate-700">ZIP/postal code:</span> {extraction.details.postalCode || "Not confidently identified"}</p>
            <p className="sm:col-span-2"><span className="font-medium text-slate-700">Tags:</span> {extraction.details.tags.join(", ") || "Not found"}</p>
          </div>

          <div className="space-y-2 border-t border-slate-200 pt-3">
            <h4 className="text-sm font-semibold text-slate-800">Video references</h4>
            <p className="text-xs text-slate-500">Video URLs are review-only. The current listing model does not support video imports.</p>
            {extraction.videos.length === 0 ? <p className="text-sm text-slate-500">No video references found.</p> : null}
            {extraction.videos.map((video, index) => (
              <p key={`${video}-${index}`} className="break-all font-mono text-xs text-slate-700">{video}</p>
            ))}
          </div>

          <div className="space-y-2 border-t border-slate-200 pt-3">
            <h4 className="text-sm font-semibold text-slate-800">Extracted image references</h4>
            <p className="text-xs text-slate-500">
              These URLs are shown as text only and are never downloaded. Map each reference to a local image file or exclude it.
            </p>
            {imageMappings.length === 0 ? <p className="text-sm text-slate-500">No image references found.</p> : null}
            {imageMappings.map((mapping, index) => (
              <div key={`${mapping.reference}-${index}`} className="grid gap-2 border-b border-slate-100 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="break-all font-mono text-xs text-slate-700">{mapping.reference}</p>
                  <label className="mt-1 flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={mapping.included}
                      onChange={(event) => updateImage(index, { included: event.target.checked })}
                    />
                    Include this image reference
                  </label>
                </div>
                {mapping.included ? (
                  <label className="text-xs text-slate-600">
                    Local file
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={(event) => updateImage(index, { file: event.target.files?.[0] ?? null })}
                      className="mt-1 block max-w-72 text-xs"
                    />
                    {mapping.file ? <span className="mt-1 block text-slate-500">Mapped: {mapping.file.name}</span> : null}
                  </label>
                ) : null}
              </div>
            ))}
          </div>

          {extraction.missingFields.length > 0 ? (
            <p className="text-xs text-amber-700">
              Needs manual review: {extraction.missingFields.map((field) => SELECTOR_LABELS[field]).join(", ")}
            </p>
          ) : null}
          <label className="block max-w-lg text-xs font-medium text-slate-600">
            Import source name
            <input
              value={sourceName}
              onChange={(event) => setSourceName(event.target.value)}
              maxLength={120}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"
            />
          </label>

          {validationErrors.length > 0 || currentValidationErrors.length > 0 ? (
            <ul className="list-inside list-disc text-sm text-red-600">
              {(validationErrors.length > 0 ? validationErrors : currentValidationErrors).map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}
            </ul>
          ) : null}
          {importMessage ? <p className="text-sm text-slate-700">{importMessage}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleGenerateJson} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Generate JSON
            </button>
            <button type="button" onClick={handleDownloadJson} disabled={!generatedJson} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              Download JSON
            </button>
            <button type="button" onClick={handleImport} disabled={importLoading || validateRecord().length > 0} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {importLoading ? "Importing…" : "Import using existing pipeline"}
            </button>
          </div>
          {generatedJson ? (
            <label className="block text-xs font-medium text-slate-600">
              Generated JSON
              <textarea readOnly rows={12} value={generatedJson} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs text-slate-800" />
            </label>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}