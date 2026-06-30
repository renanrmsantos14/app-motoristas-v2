import { createVideoPosterDataUrl, getVideoDurationLabelFromUrl, readBlobAsDataUrl } from "./photoOrientation";

export type MediaDraftLike = {
  dataUrl?: string | null;
  previewUrl?: string;
  rawBlob?: Blob | null;
  mediaType?: "foto" | "video";
};

export function isVideoDraft(value: MediaDraftLike) {
  return value.mediaType === "video" || String(value.dataUrl ?? "").startsWith("data:video/") || Boolean(value.rawBlob);
}

export function hasMediaDraftContent(value: MediaDraftLike) {
  if (isVideoDraft(value)) return Boolean(value.rawBlob || value.dataUrl);
  return Boolean(String(value.dataUrl ?? "").trim());
}

export function revokePreviewUrl(url?: string) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}

export async function prepareVideoBlobForUpload(blob: Blob) {
  const previewUrl = URL.createObjectURL(blob);
  try {
    const [dataUrl, posterUrl, durationLabel] = await Promise.all([
      readBlobAsDataUrl(blob),
      createVideoPosterDataUrl(previewUrl),
      getVideoDurationLabelFromUrl(previewUrl)
    ]);
    return { dataUrl, posterUrl, durationLabel };
  } finally {
    revokePreviewUrl(previewUrl);
  }
}
