export function isLandscapeViewport() {
  if (typeof window === "undefined") return false;
  return window.innerWidth / Math.max(window.innerHeight, 1) >= 1.45;
}

export function getViewportOrientationAngle() {
  if (typeof window === "undefined") return 0;
  const angle = Number(window.screen?.orientation?.angle ?? 0);
  if (isLandscapeViewport() && (angle === 90 || angle === -270)) return 90;
  if (isLandscapeViewport() && (angle === 270 || angle === -90)) return 270;
  if (!isLandscapeViewport() && Math.abs(angle) === 180) return 180;
  return isLandscapeViewport() ? 90 : 0;
}

export function normalizeAngle(angle: number) {
  const normalized = ((Math.round(angle / 90) * 90) % 360 + 360) % 360;
  return normalized as 0 | 90 | 180 | 270;
}

function drawRotated(image: CanvasImageSource, sourceWidth: number, sourceHeight: number, angle: 0 | 90 | 180 | 270) {
  const canvas = document.createElement("canvas");
  canvas.width = angle === 90 || angle === 270 ? sourceHeight : sourceWidth;
  canvas.height = angle === 90 || angle === 270 ? sourceWidth : sourceHeight;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((angle * Math.PI) / 180);
  context.drawImage(image, -sourceWidth / 2, -sourceHeight / 2, sourceWidth, sourceHeight);
  return canvas.toDataURL("image/jpeg", 0.92);
}

function getRotationForOrientation(sourceWidth: number, sourceHeight: number, orientationAngle: 0 | 90 | 180 | 270) {
  const sourceIsLandscape = sourceWidth >= sourceHeight;
  if (orientationAngle === 0) return 0;
  if (orientationAngle === 180) return 180;
  if (orientationAngle === 90) return sourceIsLandscape ? 0 : 90;
  return sourceIsLandscape ? 180 : 270;
}

export function captureVideoFrameDataUrl(video: HTMLVideoElement, orientationAngle = getViewportOrientationAngle()) {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  const normalizedAngle = normalizeAngle(orientationAngle);
  const rotation = getRotationForOrientation(sourceWidth, sourceHeight, normalizedAngle);

  if (rotation) {
    const rotated = drawRotated(video, sourceWidth, sourceHeight, rotation);
    if (rotated) return rotated;
  }

  const canvas = document.createElement("canvas");
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;
  const context = canvas.getContext("2d");
  if (!context) return "";

  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.92);
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export async function readBlobAsDataUrl(blob: Blob) {
  const mimeType = blob.type || "application/octet-stream";
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return `data:${mimeType};base64,${bytesToBase64(bytes)}`;
}

export function formatVideoDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function getVideoDurationLabelFromUrl(sourceUrl: string) {
  if (typeof document === "undefined" || !sourceUrl) return Promise.resolve("");

  return new Promise<string>((resolve) => {
    const video = document.createElement("video");
    let settled = false;
    let timeoutId = 0;

    const finish = (value: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      video.pause();
      video.removeAttribute("src");
      video.load();
      resolve(value);
    };

    timeoutId = window.setTimeout(() => finish(""), 4500);
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.addEventListener("loadedmetadata", () => {
      finish(Number.isFinite(video.duration) && video.duration > 0 ? formatVideoDuration(video.duration) : "");
    }, { once: true });
    video.addEventListener("error", () => finish(""), { once: true });
    video.src = sourceUrl;
    video.load();
  });
}

export function createVideoPosterDataUrl(sourceUrl: string) {
  if (typeof document === "undefined" || !sourceUrl) return Promise.resolve("");

  return new Promise<string>((resolve) => {
    const video = document.createElement("video");
    let settled = false;
    let timeoutId = 0;

    const finish = (value: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      video.pause();
      video.removeAttribute("src");
      video.load();
      resolve(value);
    };

    const draw = () => {
      const sourceWidth = video.videoWidth;
      const sourceHeight = video.videoHeight;
      if (!sourceWidth || !sourceHeight) return finish("");

      const canvas = document.createElement("canvas");
      const targetWidth = Math.min(sourceWidth, 640);
      const ratio = targetWidth / sourceWidth;
      canvas.width = targetWidth;
      canvas.height = Math.max(1, Math.round(sourceHeight * ratio));
      const context = canvas.getContext("2d");
      if (!context) return finish("");

      try {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        finish(canvas.toDataURL("image/jpeg", 0.82));
      } catch {
        finish("");
      }
    };

    const drawAfterSeek = () => {
      if (settled) return;
      if (Number.isFinite(video.duration) && video.duration > 0.2) {
        const seekTime = Math.min(0.12, video.duration / 2);
        const handleSeeked = () => draw();
        video.addEventListener("seeked", handleSeeked, { once: true });
        try {
          video.currentTime = seekTime;
          window.setTimeout(() => {
            if (!settled) draw();
          }, 700);
          return;
        } catch {
          video.removeEventListener("seeked", handleSeeked);
        }
      }
      draw();
    };

    timeoutId = window.setTimeout(() => finish(""), 4500);
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.addEventListener("loadeddata", drawAfterSeek, { once: true });
    video.addEventListener("error", () => finish(""), { once: true });
    video.src = sourceUrl;
    video.load();
  });
}

export function dataUrlToBase64(value = "") {
  const marker = ";base64,";
  const markerIndex = value.toLowerCase().indexOf(marker);
  const raw = markerIndex >= 0
    ? value.slice(markerIndex + marker.length)
    : value.slice(value.lastIndexOf(",") + 1);
  return raw.replace(/\s/g, "");
}

export function dataUrlToObjectUrl(dataUrl: string) {
  const markerIndex = dataUrl.toLowerCase().indexOf(";base64,");
  const commaIndex = dataUrl.lastIndexOf(",");
  const header = markerIndex >= 0
    ? dataUrl.slice(0, markerIndex)
    : commaIndex >= 0
      ? dataUrl.slice(0, commaIndex)
      : "";
  const payload = dataUrlToBase64(dataUrl);
  if (!header || !payload) return dataUrl;

  const mimeType = header.match(/^data:([^;,]+)/)?.[1] || "application/octet-stream";
  const binary = markerIndex >= 0 ? atob(payload) : decodeURIComponent(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

export async function readPhotoFileAsDataUrl(file: File, orientationAngle = getViewportOrientationAngle()) {
  const fallbackDataUrl = await readFileAsDataUrl(file);
  const normalizedAngle = normalizeAngle(orientationAngle);
  if (normalizedAngle === 0) return fallbackDataUrl;

  try {
    const image = await createImageBitmap(file);
    const rotation = getRotationForOrientation(image.width, image.height, normalizedAngle);
    if (!rotation) {
      image.close();
      return fallbackDataUrl;
    }

    const rotated = drawRotated(image, image.width, image.height, rotation);
    image.close();
    return rotated || fallbackDataUrl;
  } catch {
    return fallbackDataUrl;
  }
}
