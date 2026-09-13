import { api } from "./api";
import type { SiteSettings } from "./types";

export async function getSiteSettings(): Promise<SiteSettings> {
  const { settings } = await api.get<{ settings: SiteSettings }>("/admin/settings");
  return settings;
}

export async function updateListingAutoApprove(autoApprove: boolean): Promise<SiteSettings> {
  const { settings } = await api.patch<{ settings: SiteSettings }>("/admin/settings/listing-moderation", {
    autoApprove,
  });
  return settings;
}

export async function updateListingImageSettings(input: {
  maxImages: number;
  maxImageSizeMB: number;
  optimizationEnabled: boolean;
}): Promise<SiteSettings> {
  const { settings } = await api.patch<{ settings: SiteSettings }>(
    "/admin/settings/listing-images",
    input,
  );
  return settings;
}
