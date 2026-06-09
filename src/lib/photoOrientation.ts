export function isLandscapeViewport() {
  if (typeof window === "undefined") return false;
  return window.innerWidth / Math.max(window.innerHeight, 1) >= 1.2;
}

export function getViewportOrientationAngle() {
  if (typeof window === "undefined") return 0;
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
