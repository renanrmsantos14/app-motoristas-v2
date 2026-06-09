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
  const candidates = [cleanUrl];
  try {
    const parsed = new URL(cleanUrl);
    parsed.searchParams.set("download", "1");
    candidates.push(parsed.toString());
  } catch {
    // keep original only
  }
  return Array.from(new Set(candidates));
}

export async function loadImagePreviewDataUrl(url: string) {
  for (const candidate of buildOneDrivePreviewCandidates(url)) {
    try {
      const response = await fetch(candidate, {
        credentials: "include",
        mode: "cors"
      });
      if (!response.ok) continue;
      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) continue;
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler imagem."));
        reader.readAsDataURL(blob);
      });
    } catch {
      // try next candidate
    }
  }
  return "";
}
