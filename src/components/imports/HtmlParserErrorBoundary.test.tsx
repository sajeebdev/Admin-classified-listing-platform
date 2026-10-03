import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HtmlListingParser } from "./HtmlListingParser";
import { HtmlParserErrorBoundary } from "./HtmlParserErrorBoundary";
import { parseListingHtml, type HtmlListingExtraction } from "../../lib/imports";
import { listAdminCategories } from "../../lib/categories";
import { listAdminCountries, listAdminStates } from "../../lib/locations";

vi.mock("../../lib/imports", () => ({
  parseListingHtml: vi.fn(),
  uploadImportFile: vi.fn(),
}));
vi.mock("../../lib/categories", () => ({ listAdminCategories: vi.fn() }));
vi.mock("../../lib/locations", () => ({ listAdminCountries: vi.fn(), listAdminStates: vi.fn() }));

const taxonomyCategories = [
  { id: "cat-social", name: "Social", slug: "social", description: null, icon: null, image: null, seoTitle: null, seoDescription: null, isActive: true },
];
const taxonomyCountries = [
  { id: "country-bd", name: "Bangladesh", slug: "bangladesh", code: "BD", seoTitle: null, seoDescription: null, isActive: true },
  { id: "country-us", name: "United States", slug: "united-states", code: "US", seoTitle: null, seoDescription: null, isActive: true },
];
const taxonomyStates = {
  "country-bd": [{ id: "state-dhaka", countryId: "country-bd", name: "Dhaka Division", slug: "dhaka-division", code: "DH", seoTitle: null, seoDescription: null, isActive: true }],
  "country-us": [{ id: "state-ca", countryId: "country-us", name: "California", slug: "california", code: "CA", seoTitle: null, seoDescription: null, isActive: true }],
};

function extraction(overrides: Partial<HtmlListingExtraction["listing"]> = {}): HtmlListingExtraction {
  return {
    listing: {
      externalId: "listing-1",
      sourceUrl: "https://partner.example/listing-1",
      title: "A listing title",
      description: "A sufficiently detailed listing description.",
      category: "",
      subcategory: "",
      country: "",
      state: "",
      city: "Dhaka",
      price: null,
      publishedAt: "",
      images: [],
      ...overrides,
    },
    imageReferences: [],
    videos: [],
    details: { postId: "listing-1", age: "", mobile: "", address: "", city: "Dhaka", state: "", postalCode: "", tags: [] },
    missingFields: [],
    warnings: [],
  };
}

async function clickParseButton() {
  await waitFor(() => expect((screen.getByRole("button", { name: /Loading taxonomy|Parse HTML/ }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Parse HTML" }));
}

describe("HTML parser error handling", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.mocked(parseListingHtml).mockReset();
    vi.mocked(listAdminCategories).mockResolvedValue({ items: taxonomyCategories } as never);
    vi.mocked(listAdminCountries).mockResolvedValue({ items: taxonomyCountries } as never);
    vi.mocked(listAdminStates).mockImplementation(async (countryId) => ({ items: taxonomyStates[countryId as keyof typeof taxonomyStates] ?? [] }) as never);
  });

  it("shows parser failures inline and preserves the controlled raw HTML string", async () => {
    const html = '<script>const userDescription = "untrusted";</script><template shadowrootmode="open">source</template>';
    vi.mocked(parseListingHtml).mockRejectedValue(new Error("Malformed source HTML"));

    render(
      <HtmlParserErrorBoundary>
        <HtmlListingParser html={html} onHtmlChange={vi.fn()} onImported={vi.fn()} />
      </HtmlParserErrorBoundary>,
    );

    const textarea = screen.getByLabelText("Raw HTML source") as HTMLTextAreaElement;
    expect(textarea.value).toBe(html);
    await clickParseButton();

    expect(await screen.findByText("HTML could not be parsed.")).toBeTruthy();
    expect((screen.getByLabelText("Raw HTML source") as HTMLTextAreaElement).value).toBe(html);
  });

  it("catches unexpected render exceptions and shows an inline recovery state", async () => {
    function ThrowingChild(): never {
      throw new Error("unexpected child render exception");
    }
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      render(
        <HtmlParserErrorBoundary>
          <ThrowingChild />
        </HtmlParserErrorBoundary>,
      );
      await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("rendering error"));
      expect(screen.getByRole("button", { name: "Retry parser" })).toBeTruthy();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("keeps image exclusion behavior in generated JSON", async () => {
    const mappedExtraction: HtmlListingExtraction = {
      ...extraction({ category: "social", country: "Bangladesh", state: "Dhaka Division", publishedAt: "2026-10-03T10:00:00.000Z" }),
      imageReferences: ["https://partner.example/image.jpg"],
      videos: ["https://partner.example/video.mp4"],
    };
    vi.mocked(parseListingHtml).mockResolvedValue(mappedExtraction);

    render(<HtmlListingParser html="<h1>A listing title</h1>" onHtmlChange={vi.fn()} onImported={vi.fn()} />);
    await clickParseButton();
    const exclusion = await screen.findByLabelText("Include this image reference");
    fireEvent.click(exclusion);
    fireEvent.click(screen.getByRole("button", { name: "Generate JSON" }));

    const generated = screen.getByLabelText("Generated JSON") as HTMLTextAreaElement;
    expect(JSON.parse(generated.value)[0].images).toEqual([]);
    expect(screen.getByText(/current listing model does not support video imports/)).toBeTruthy();
  });

  it("keeps missing taxonomy/date fields empty, gates import, and resets dependent state when country changes", async () => {
    vi.mocked(parseListingHtml).mockResolvedValue(extraction({ city: "Dhaka" }));
    render(<HtmlListingParser html="<h1>A listing title</h1>" onHtmlChange={vi.fn()} onImported={vi.fn()} />);

    await clickParseButton();
    const category = (await screen.findByLabelText("Category *")) as HTMLSelectElement;
    const country = screen.getByLabelText("Country *") as HTMLSelectElement;
    const state = screen.getByLabelText("State *") as HTMLSelectElement;
    const publishedAt = screen.getByLabelText("Published Date *") as HTMLInputElement;
    expect(category.value).toBe("");
    expect(country.value).toBe("");
    expect(state.value).toBe("");
    expect(publishedAt.type).toBe("datetime-local");
    expect(publishedAt.value).toBe("");

    await screen.findByText("Category is required before import.");
    expect(screen.getByText("Country is required before import.")).toBeTruthy();
    expect(screen.getByText("State is required before import.")).toBeTruthy();
    expect(screen.getByText("Published date is required before import.")).toBeTruthy();
    const importButton = screen.getByRole("button", { name: "Import using existing pipeline" }) as HTMLButtonElement;
    expect(importButton.disabled).toBe(true);

    fireEvent.change(category, { target: { value: "social" } });
    fireEvent.change(country, { target: { value: "Bangladesh" } });
    await waitFor(() => expect(screen.getByRole("option", { name: "Dhaka Division" })).toBeTruthy());
    fireEvent.change(state, { target: { value: "Dhaka Division" } });

    fireEvent.change(country, { target: { value: "United States" } });
    expect(state.value).toBe("");
    await waitFor(() => expect(screen.getByRole("option", { name: "California" })).toBeTruthy());
    fireEvent.change(state, { target: { value: "California" } });
    fireEvent.change(publishedAt, { target: { value: "2026-10-03T10:00" } });
    expect(importButton.disabled).toBe(false);
  });

  it("preselects only exact active taxonomy matches and a reliable extracted date", async () => {
    vi.mocked(parseListingHtml).mockResolvedValue(
      extraction({
        category: "Social",
        country: "Bangladesh",
        state: "DH",
        publishedAt: "2026-10-03T10:00:00.000Z",
      }),
    );
    render(<HtmlListingParser html="<h1>A listing title</h1>" onHtmlChange={vi.fn()} onImported={vi.fn()} />);

    await clickParseButton();
    await screen.findByLabelText("Category *");
    await waitFor(() => expect((screen.getByLabelText("State *") as HTMLSelectElement).value).toBe("Dhaka Division"));
    expect((screen.getByLabelText("Category *") as HTMLSelectElement).value).toBe("social");
    expect((screen.getByLabelText("Country *") as HTMLSelectElement).value).toBe("Bangladesh");
    expect((screen.getByLabelText("Published Date *") as HTMLInputElement).value).not.toBe("");
  });
});