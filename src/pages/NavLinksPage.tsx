import { useEffect, useState } from "react";
import { ActiveBadge } from "../components/Badge";
import { NavLinkFormDialog } from "../components/NavLinkFormDialog";
import { ErrorState, LoadingState } from "../components/States";
import { createNavLink, deactivateNavLink, listAdminNavLinks, updateNavLink, type NavLinkInput } from "../lib/navLinks";
import type { NavLinkSummary } from "../lib/types";

type NavLinkDialog = { kind: "create" } | { kind: "edit"; link: NavLinkSummary } | null;

function dialogKey(dialog: NavLinkDialog): string {
  if (!dialog) return "closed";
  if (dialog.kind === "edit") return `edit-${dialog.link.id}`;
  return dialog.kind;
}

/**
 * Manages the public `SecondaryNav`'s links (see frontend's `SecondaryNav.tsx`)
 * — plain label + URL pairs an admin controls directly, never a page this app
 * generates itself. Same list/dialog/toggle shape as `CategoriesPage`.
 */
export function NavLinksPage() {
  const [links, setLinks] = useState<NavLinkSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<NavLinkDialog>(null);

  // Deliberately doesn't reset `links`/`error` to a loading state before
  // fetching — same "keep showing the previous list until the new one
  // arrives" convention `CategoriesPage.load` uses.
  function load() {
    listAdminNavLinks({ limit: 100 })
      .then((r) => setLinks(r.items))
      .catch(() => setError("Could not load nav links."));
  }

  useEffect(load, []);

  async function handleSave(input: NavLinkInput) {
    if (!dialog) return;
    if (dialog.kind === "create") await createNavLink(input);
    else await updateNavLink(dialog.link.id, input);
    load();
  }

  async function toggleActive(link: NavLinkSummary) {
    if (link.isActive) await deactivateNavLink(link.id);
    else await updateNavLink(link.id, { isActive: true });
    load();
  }

  if (error) return <ErrorState message={error} />;
  if (!links) return <LoadingState />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Nav Links</h1>
          <p className="text-sm text-slate-500">
            Links shown in the secondary navigation bar on the public site. These never create a page — they only
            point somewhere else.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialog({ kind: "create" })}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New link
        </button>
      </div>

      <div className="space-y-3">
        {links.length === 0 ? <p className="text-sm text-slate-400">No nav links yet.</p> : null}
        {links.map((link) => (
          <div key={link.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
            <div>
              <p className="font-medium text-slate-900">{link.label}</p>
              <p className="max-w-md truncate text-xs text-slate-500">{link.url}</p>
            </div>
            <div className="flex items-center gap-3">
              <ActiveBadge isActive={link.isActive} />
              <button
                type="button"
                onClick={() => setDialog({ kind: "edit", link })}
                className="text-sm text-blue-600 hover:underline"
              >
                Edit
              </button>
              <button type="button" onClick={() => toggleActive(link)} className="text-sm text-slate-600 hover:underline">
                {link.isActive ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <NavLinkFormDialog
        key={dialogKey(dialog)}
        open={dialog !== null}
        title={dialog?.kind === "create" ? "New nav link" : "Edit nav link"}
        initial={dialog?.kind === "edit" ? dialog.link : undefined}
        onSave={handleSave}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}
