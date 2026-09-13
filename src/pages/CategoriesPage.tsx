import { useEffect, useState } from "react";
import { ActiveBadge } from "../components/Badge";
import { CategoryFormDialog } from "../components/CategoryFormDialog";
import { ErrorState, LoadingState } from "../components/States";
import {
  createCategory,
  createSubcategory,
  deactivateCategory,
  deactivateSubcategory,
  listAdminCategories,
  listAdminSubcategories,
  updateCategory,
  updateSubcategory,
  type CategoryInput,
} from "../lib/categories";
import type { CategorySummary, SubcategorySummary } from "../lib/types";

type CategoryDialog =
  | { kind: "create-category" }
  | { kind: "edit-category"; category: CategorySummary }
  | { kind: "create-subcategory"; categoryId: string }
  | { kind: "edit-subcategory"; subcategory: SubcategorySummary }
  | null;

/** A distinct key per dialog target forces `CategoryFormDialog` to remount (and re-derive its fields from `initial`) instead of resetting them via an effect. */
function dialogKey(dialog: CategoryDialog): string {
  if (!dialog) return "closed";
  if (dialog.kind === "edit-category") return `edit-category-${dialog.category.id}`;
  if (dialog.kind === "create-subcategory") return `create-subcategory-${dialog.categoryId}`;
  if (dialog.kind === "edit-subcategory") return `edit-subcategory-${dialog.subcategory.id}`;
  return dialog.kind;
}

export function CategoriesPage() {
  const [categories, setCategories] = useState<CategorySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dialog, setDialog] = useState<CategoryDialog>(null);

  // Deliberately doesn't reset `categories`/`error` to a loading state
  // before fetching — only `.then`/`.catch` ever call setState here, so a
  // reload (after a save) simply keeps showing the previous list until the
  // new one arrives, rather than flashing a loading state on every action.
  function load() {
    listAdminCategories({ limit: 100 })
      .then((r) => setCategories(r.items))
      .catch(() => setError("Could not load categories."));
  }

  useEffect(load, []);

  async function handleSave(input: CategoryInput) {
    if (!dialog) return;
    if (dialog.kind === "create-category") await createCategory(input);
    else if (dialog.kind === "edit-category") await updateCategory(dialog.category.id, input);
    else if (dialog.kind === "create-subcategory") await createSubcategory(dialog.categoryId, input);
    else if (dialog.kind === "edit-subcategory") await updateSubcategory(dialog.subcategory.id, input);
    load();
  }

  async function toggleCategoryActive(category: CategorySummary) {
    if (category.isActive) await deactivateCategory(category.id);
    else await updateCategory(category.id, { isActive: true });
    load();
  }

  if (error) return <ErrorState message={error} />;
  if (!categories) return <LoadingState />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Categories</h1>
        <button
          type="button"
          onClick={() => setDialog({ kind: "create-category" })}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New category
        </button>
      </div>

      <div className="space-y-3">
        {categories.map((category) => (
          <div key={category.id} className="rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium text-slate-900">{category.name}</p>
                <p className="text-xs text-slate-500">/{category.slug}</p>
              </div>
              <div className="flex items-center gap-3">
                <ActiveBadge isActive={category.isActive ?? true} />
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === category.id ? null : category.id)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {expanded === category.id ? "Hide subcategories" : "Subcategories"}
                </button>
                <button
                  type="button"
                  onClick={() => setDialog({ kind: "edit-category", category })}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => toggleCategoryActive(category)}
                  className="text-sm text-slate-600 hover:underline"
                >
                  {category.isActive ?? true ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
            {expanded === category.id ? (
              <SubcategoryList categoryId={category.id} onEdit={(sub) => setDialog({ kind: "edit-subcategory", subcategory: sub })} onCreate={() => setDialog({ kind: "create-subcategory", categoryId: category.id })} />
            ) : null}
          </div>
        ))}
      </div>

      <CategoryFormDialog
        key={dialogKey(dialog)}
        open={dialog !== null}
        title={
          dialog?.kind === "create-category"
            ? "New category"
            : dialog?.kind === "edit-category"
              ? "Edit category"
              : dialog?.kind === "create-subcategory"
                ? "New subcategory"
                : "Edit subcategory"
        }
        initial={dialog?.kind === "edit-category" ? dialog.category : dialog?.kind === "edit-subcategory" ? dialog.subcategory : undefined}
        onSave={handleSave}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}

function SubcategoryList({
  categoryId,
  onEdit,
  onCreate,
}: {
  categoryId: string;
  onEdit: (sub: SubcategorySummary) => void;
  onCreate: () => void;
}) {
  const [subcategories, setSubcategories] = useState<SubcategorySummary[] | null>(null);

  function load() {
    listAdminSubcategories(categoryId, { limit: 100 })
      .then((r) => setSubcategories(r.items))
      .catch(() => setSubcategories([]));
  }

  useEffect(load, [categoryId]);

  async function toggleActive(sub: SubcategorySummary) {
    if (sub.isActive) await deactivateSubcategory(sub.id);
    else await updateSubcategory(sub.id, { isActive: true });
    load();
  }

  return (
    <div className="border-t border-slate-100 bg-slate-50 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase text-slate-500">Subcategories</p>
        <button type="button" onClick={onCreate} className="text-sm text-blue-600 hover:underline">
          Add subcategory
        </button>
      </div>
      {subcategories === null ? (
        <LoadingState />
      ) : subcategories.length === 0 ? (
        <p className="text-sm text-slate-400">No subcategories yet.</p>
      ) : (
        <ul className="space-y-2">
          {subcategories.map((sub) => (
            <li key={sub.id} className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm">
              <span>{sub.name}</span>
              <span className="flex items-center gap-3">
                <ActiveBadge isActive={sub.isActive ?? true} />
                <button type="button" onClick={() => onEdit(sub)} className="text-blue-600 hover:underline">
                  Edit
                </button>
                <button type="button" onClick={() => toggleActive(sub)} className="text-slate-600 hover:underline">
                  {sub.isActive ?? true ? "Deactivate" : "Activate"}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
