const externalUrlPattern = /^https?:\/\/\S+$/i;
const urlPattern = /https?:\/\/[^\s<>"']+/gi;

export function isMaintenancePhotoPreviewField(label: string, value: string) {
  const cleanLabel = label.trim();
  if (!cleanLabel || extractMaintenancePhotoUrls(value).length === 0) return false;
  return /^link foto\b/i.test(cleanLabel);
}

export function extractMaintenancePhotoUrls(value: string) {
  return Array.from(value.matchAll(urlPattern), (match) => match[0].trim()).filter((url) => externalUrlPattern.test(url));
}

export function buildOneDrivePreviewCandidates(url: string) {
  const cleanUrl = url.trim();
  const candidates: string[] = [];
  try {
    const parsed = new URL(cleanUrl);
    const hostname = parsed.hostname.toLowerCase();
    const isMicrosoftFileLink =
      hostname.endsWith(".sharepoint.com") ||
      hostname === "1drv.ms" ||
      hostname.endsWith(".1drv.ms") ||
      hostname === "onedrive.live.com";

    if (isMicrosoftFileLink) {
      parsed.searchParams.set("download", "1");
      candidates.push(parsed.toString());
    }
  } catch {
    // keep original fallback below
  }
  candidates.push(cleanUrl);
  return Array.from(new Set(candidates));
}
