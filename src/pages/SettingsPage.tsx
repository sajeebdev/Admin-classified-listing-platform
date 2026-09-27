import { MAX_IMAGES_OPTIONS, MAX_IMAGE_SIZE_MB_OPTIONS } from "../shared";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ErrorState, LoadingState } from "../components/States";
import { ApiClientError } from "../lib/api";
import {
  getSiteSettings,
  updateEmailVerificationEnabled,
  updateListingAutoApprove,
  updateListingImageSettings,
} from "../lib/settings";
import type { SiteSettings } from "../lib/types";

/**
 * Site-wide configuration. Three setting groups today, each its own titled
 * section (Listing Moderation — Task F; Listing Image Settings; Email
 * Verification below) —
 * meant to grow by adding another section like these, not by restructuring
 * into a tabbed "settings app". Both reuse the one `SiteSettings`
 * document/API (`getSiteSettings`/`settings.service.ts`) — no separate
 * settings system.
 */
export function SettingsPage() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [pendingValue, setPendingValue] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Listing image settings — a local draft, committed only on "Save
  // settings" (matching the brief's mockup: one Save button for all three
  // fields together, not an auto-save-per-toggle like the moderation
  // setting above). Reset from the real settings once they load.
  const [maxImages, setMaxImages] = useState<(typeof MAX_IMAGES_OPTIONS)[number]>(MAX_IMAGES_OPTIONS[0]);
  const [maxImageSizeMB, setMaxImageSizeMB] = useState<(typeof MAX_IMAGE_SIZE_MB_OPTIONS)[number]>(
    MAX_IMAGE_SIZE_MB_OPTIONS[0],
  );
  const [optimizationEnabled, setOptimizationEnabled] = useState(true);
  const [imageSettingsSaving, setImageSettingsSaving] = useState(false);
  const [imageSettingsError, setImageSettingsError] = useState<string | null>(null);
  const [imageSettingsSaved, setImageSettingsSaved] = useState(false);

  // Email verification — same confirm-then-save-immediately pattern as the
  // moderation toggle above, since it changes what login enforces.
  const [pendingEmailVerification, setPendingEmailVerification] = useState<boolean | null>(null);
  const [emailVerificationSaving, setEmailVerificationSaving] = useState(false);
  const [emailVerificationError, setEmailVerificationError] = useState<string | null>(null);

  useEffect(() => {
    getSiteSettings()
      .then((result) => {
        setSettings(result);
        setMaxImages(result.listingImages.maxImages as (typeof MAX_IMAGES_OPTIONS)[number]);
        setMaxImageSizeMB(result.listingImages.maxImageSizeMB as (typeof MAX_IMAGE_SIZE_MB_OPTIONS)[number]);
        setOptimizationEnabled(result.listingImages.optimizationEnabled);
      })
      .catch((err) => setLoadError(err instanceof ApiClientError ? err.message : "Could not load settings."));
  }, []);

  async function confirmToggle() {
    if (pendingValue === null) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateListingAutoApprove(pendingValue);
      // Merge rather than replace: defends this page against ever going
      // blank from a save response that's missing a group it didn't touch
      // (the backend is expected to always return everything now, but a
      // stale/un-restarted backend process — or any future bug of the same
      // shape — must never crash this page instead of just doing nothing).
      setSettings((prev) => (prev ? { ...prev, ...updated } : updated));
      setPendingValue(null);
    } catch (err) {
      setSaveError(err instanceof ApiClientError ? err.message : "Could not update this setting.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmEmailVerificationToggle() {
    if (pendingEmailVerification === null) return;
    setEmailVerificationSaving(true);
    setEmailVerificationError(null);
    try {
      const updated = await updateEmailVerificationEnabled(pendingEmailVerification);
      setSettings((prev) => (prev ? { ...prev, ...updated } : updated));
      setPendingEmailVerification(null);
    } catch (err) {
      setEmailVerificationError(
        err instanceof ApiClientError ? err.message : "Could not update email verification setting.",
      );
    } finally {
      setEmailVerificationSaving(false);
    }
  }

  async function saveImageSettings() {
    setImageSettingsSaving(true);
    setImageSettingsError(null);
    setImageSettingsSaved(false);
    try {
      const updated = await updateListingImageSettings({ maxImages, maxImageSizeMB, optimizationEnabled });
      setSettings((prev) => (prev ? { ...prev, ...updated } : updated));
      setImageSettingsSaved(true);
    } catch (err) {
      setImageSettingsError(
        err instanceof ApiClientError ? err.message : "Could not update listing image settings.",
      );
    } finally {
      setImageSettingsSaving(false);
    }
  }

  if (loadError) return <ErrorState message={loadError} />;
  if (!settings) return <LoadingState />;

  const autoApprove = settings.listingModeration.autoApprove;
  // Defaults to enabled if an older backend response lacks the group — the
  // backend's own default, so this never displays a looser state than the
  // server actually enforces.
  const emailVerificationEnabled = settings.authentication?.emailVerificationEnabled ?? true;

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Settings</h1>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Listing Moderation</h2>
          <p className="mt-1 text-sm text-slate-500">
            Controls what happens when a seller submits a listing. Changing this only affects listings
            submitted from now on — it never changes the status of a listing that is already published,
            pending, or rejected.
          </p>
        </div>

        <label className="flex items-start gap-3 rounded-md border border-slate-200 p-3">
          <input
            type="checkbox"
            checked={autoApprove}
            disabled={saving}
            onChange={(e) => setPendingValue(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="block text-sm font-medium text-slate-900">Automatically approve new listings</span>
            <span className="mt-0.5 block text-sm text-slate-500">
              {autoApprove
                ? "On — newly submitted listings are published immediately after validation."
                : "Off — newly submitted listings require admin approval before they appear publicly."}
            </span>
          </span>
        </label>

        {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Listing Image Settings</h2>
          <p className="mt-1 text-sm text-slate-500">
            Controls how many images a seller may upload per listing, how large each image may be, and
            whether uploaded images are optimized when served. Changing these never deletes or
            recompresses a listing's existing images — they apply to new uploads going forward.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Maximum images</span>
            <select
              value={maxImages}
              disabled={imageSettingsSaving}
              onChange={(e) => setMaxImages(Number(e.target.value) as (typeof MAX_IMAGES_OPTIONS)[number])}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              {MAX_IMAGES_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Maximum file size</span>
            <select
              value={maxImageSizeMB}
              disabled={imageSettingsSaving}
              onChange={(e) =>
                setMaxImageSizeMB(Number(e.target.value) as (typeof MAX_IMAGE_SIZE_MB_OPTIONS)[number])
              }
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              {MAX_IMAGE_SIZE_MB_OPTIONS.map((mb) => (
                <option key={mb} value={mb}>
                  {mb} MB
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex items-start gap-3 rounded-md border border-slate-200 p-3">
          <input
            type="checkbox"
            checked={optimizationEnabled}
            disabled={imageSettingsSaving}
            onChange={(e) => setOptimizationEnabled(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="block text-sm font-medium text-slate-900">Image optimization</span>
            <span className="mt-0.5 block text-sm text-slate-500">
              When enabled, uploaded listing images are optimized before/while being served. Disable this
              if you want to reduce image optimization usage/cost.
            </span>
          </span>
        </label>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={saveImageSettings}
            disabled={imageSettingsSaving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {imageSettingsSaving ? "Saving…" : "Save settings"}
          </button>
          {imageSettingsSaved ? <p className="text-sm text-green-700">Settings saved successfully.</p> : null}
        </div>

        {imageSettingsError ? <p className="text-sm text-red-600">{imageSettingsError}</p> : null}
      </section>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Email Verification</h2>
          <p className="mt-1 text-sm text-slate-500">
            Require users to verify their email before logging in. Changing this never modifies any existing
            account's verification status — accounts that are still unverified can log in while this is
            disabled, and will need to verify again if it is re-enabled.
          </p>
        </div>

        <label className="flex items-start gap-3 rounded-md border border-slate-200 p-3">
          <input
            type="checkbox"
            checked={emailVerificationEnabled}
            disabled={emailVerificationSaving}
            onChange={(e) => setPendingEmailVerification(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="block text-sm font-medium text-slate-900">
              Email Verification: {emailVerificationEnabled ? "Enabled" : "Disabled"}
            </span>
            <span className="mt-0.5 block text-sm text-slate-500">
              {emailVerificationEnabled
                ? "Enabled — new users receive a verification email and cannot log in until they verify."
                : "Disabled — new users can log in immediately after registering; no verification email is sent."}
            </span>
          </span>
        </label>

        {emailVerificationError ? <p className="text-sm text-red-600">{emailVerificationError}</p> : null}
      </section>

      <ConfirmDialog
        open={pendingEmailVerification !== null}
        title={pendingEmailVerification ? "Enable email verification?" : "Disable email verification?"}
        description={
          pendingEmailVerification
            ? "New users will need to verify their email before logging in. Existing accounts that are still unverified will also be blocked from logging in until they verify."
            : "New users will be able to log in immediately without verifying their email. Existing unverified accounts will also be able to log in."
        }
        confirmLabel={pendingEmailVerification ? "Enable" : "Disable"}
        danger={!pendingEmailVerification}
        busy={emailVerificationSaving}
        onConfirm={confirmEmailVerificationToggle}
        onCancel={() => setPendingEmailVerification(null)}
      />

      <ConfirmDialog
        open={pendingValue !== null}
        title={pendingValue ? "Turn on automatic approval?" : "Require admin approval for new listings?"}
        description={
          pendingValue
            ? "New listings will be published automatically after validation, with no review step."
            : "New listings will require admin approval before appearing publicly. Nothing already published or already in the queue is affected."
        }
        confirmLabel={pendingValue ? "Turn on" : "Turn off"}
        danger={!pendingValue}
        busy={saving}
        onConfirm={confirmToggle}
        onCancel={() => setPendingValue(null)}
      />
    </div>
  );
}
