import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const mediaCaptureScreen = readFileSync(new URL("../src/screens/MediaCaptureScreen.tsx", import.meta.url), "utf8");

function getBlocksContaining(selectorFragment: string) {
  return styles
    .split("}")
    .map((block) => `${block}}`)
    .filter((block) => block.includes(selectorFragment));
}

function assertMediaUsesContain(selectorFragment: string) {
  const blocks = getBlocksContaining(selectorFragment);

  assert.ok(blocks.length > 0, `Nenhum bloco CSS encontrado para ${selectorFragment}.`);
  assert.equal(
    blocks.some((block) => /object-fit:\s*contain\b/i.test(block)),
    true,
    `${selectorFragment} deveria usar object-fit: contain.`
  );
  assert.equal(
    blocks.some((block) => /object-fit:\s*cover\b/i.test(block)),
    false,
    `${selectorFragment} nao deveria usar object-fit: cover.`
  );
}

test("camera e previews principais sempre exibem a midia inteira", () => {
  assertMediaUsesContain(".real-camera-video");
  assertMediaUsesContain(".maintenance-preview-real-image");
  assertMediaUsesContain(".maintenance-photo-thumb img");
  assertMediaUsesContain(".maintenance-photo-thumb video");
  assertMediaUsesContain(".collision-evidence-thumb img");
  assertMediaUsesContain(".collision-evidence-thumb video");
  assertMediaUsesContain(".collision-video-thumb img");
  assertMediaUsesContain(".collision-video-thumb video");
});

test("controles mobile da camera preservam obturador circular", () => {
  assert.match(styles, /@media\s*\(max-width:\s*520px\)\s*{[\s\S]*?\.camera-actions-pro\s*{[\s\S]*?grid-template-columns:\s*56px\s+minmax\(0,\s*1fr\)\s+72px\s+minmax\(0,\s*1fr\)\s+56px;/);
  assert.match(styles, /\.camera-actions-pro\s+\.camera-primary-action\s*{[\s\S]*?width:\s*72px\s*!important;[\s\S]*?height:\s*72px\s*!important;/);
  assert.match(styles, /\.camera-actions-pro\s+\.camera-secondary-action\s*{[\s\S]*?width:\s*56px\s*!important;[\s\S]*?height:\s*56px\s*!important;/);
  assert.match(styles, /\.camera-side-action-left\s*{[\s\S]*?grid-column:\s*2;/);
  assert.match(styles, /\.camera-primary-action\s*{[\s\S]*?grid-column:\s*3;/);
  assert.match(styles, /\.camera-side-action-right\s*{[\s\S]*?grid-column:\s*5;/);
  assert.doesNotMatch(styles, /@media\s*\(max-width:\s*520px\)\s*{[\s\S]*?\.camera-actions-pro\s+button\s*{[\s\S]*?height:\s*54px\s*!important;/);
  assert.doesNotMatch(styles, /grid-template-columns:\s*66px\s+104px\s+66px;/);
  assert.doesNotMatch(styles, /grid-template-columns:\s*48px\s+72px\s+48px;/);
});

test("controles da camera seguem visual minimalista do app", () => {
  const cameraControls = getBlocksContaining(".camera-actions-pro");
  const shutterShell = getBlocksContaining(".camera-shutter-shell");
  const shutterCore = getBlocksContaining(".camera-shutter-core");
  const recordButton = getBlocksContaining(".photo-record");

  assert.equal(cameraControls.some((block) => /background:\s*rgba\(255,\s*255,\s*255,\s*0\.94\)/i.test(block)), true);
  assert.equal(shutterShell.some((block) => /background:\s*#ffffff\b/i.test(block)), true);
  assert.equal(shutterCore.some((block) => /background:\s*#000e23\b/i.test(block)), true);
  assert.equal(recordButton.some((block) => /background:\s*#c0272d\b/i.test(block)), true);
  assert.equal(recordButton.some((block) => /color:\s*#ffffff\b/i.test(block)), true);
  assert.equal([...cameraControls, ...shutterShell, ...shutterCore, ...recordButton].some((block) => /linear-gradient|radial-gradient/i.test(block)), false);
});

test("tela de captura usa titulo no topo e preview transparente", () => {
  const cameraView = getBlocksContaining(".camera-capture-card .camera-view");
  const realCameraVideo = getBlocksContaining(".camera-capture-card .real-camera-video");

  assert.match(mediaCaptureScreen, /<FormMenu title={title \?\? getTitleByKind\(kind\)} onBack={onBack} \/>/);
  assert.doesNotMatch(mediaCaptureScreen, /camera-capture-title/);
  assert.doesNotMatch(mediaCaptureScreen, /Camera nativa/i);
  assert.equal(cameraView.some((block) => /background:\s*transparent\s*!important/i.test(block)), true);
  assert.equal(realCameraVideo.some((block) => /background:\s*transparent\s*!important/i.test(block)), true);
});

test("camera ao vivo evita proporcao fixa e pede qualidade HD quando possivel", () => {
  assert.doesNotMatch(mediaCaptureScreen, /aspectRatio\s*:/);
  assert.doesNotMatch(mediaCaptureScreen, /width:\s*{\s*ideal:/);
  assert.doesNotMatch(mediaCaptureScreen, /width:\s*\d+/);
  assert.doesNotMatch(mediaCaptureScreen, /height:\s*\d+/);
  assert.match(mediaCaptureScreen, /height:\s*{\s*ideal:\s*1080,\s*min:\s*720\s*}/);
  assert.match(mediaCaptureScreen, /frameRate:\s*{\s*ideal:\s*30,\s*max:\s*30\s*}/);
  assert.match(mediaCaptureScreen, /iPhone\|iPad\|iPod/);
});

test("camera usa foco continuo somente quando o aparelho declara suporte", () => {
  assert.match(mediaCaptureScreen, /focusMode\?\: string\[\]/);
  assert.match(mediaCaptureScreen, /focusMode\?\.includes\("continuous"\)/);
  assert.match(mediaCaptureScreen, /constraints\.focusMode = \{ ideal: "continuous" \}/);
  assert.match(mediaCaptureScreen, /applyProfile\(preferredProfile, false\)/);
});

test("iphone usa captura nativa limpa para evitar fullscreen ao gravar video", () => {
  assert.match(mediaCaptureScreen, /configureInlineCameraVideo\(videoRef\.current\)/);
  assert.match(mediaCaptureScreen, /isAppleMobileDevice/);
  assert.match(mediaCaptureScreen, /const useLiveRecording = useLiveCamera && !useAppleMobile;/);
  assert.match(mediaCaptureScreen, /const useLivePreview = useLiveRecording;/);
  assert.match(mediaCaptureScreen, /const nativeVideoAccept = useAppleMobile \? "video\/\*" : "video\/\*,\.mov,video\/quicktime";/);
  assert.match(mediaCaptureScreen, /accept={nativeVideoAccept}/);
  assert.match(mediaCaptureScreen, /onClick={useLiveRecording \? \(recording \? stopLiveRecording : startLiveRecording\) : openNativeVideoCamera}/);
  assert.match(mediaCaptureScreen, /if \(videoRef\.current && useLivePreview\)/);
  assert.match(mediaCaptureScreen, /onClick={useLivePreview \? captureLivePhoto : openNativePhotoCamera}/);
  assert.match(mediaCaptureScreen, /disabled={processing \|\| starting \|\| \(useLivePreview && !ready && !recording\)}/);
  assert.match(mediaCaptureScreen, /setAttribute\("webkit-playsinline",\s*""\)/);
  assert.match(mediaCaptureScreen, /setAttribute\("playsinline",\s*""\)/);
  assert.match(mediaCaptureScreen, /controls={false}/);
  assert.match(mediaCaptureScreen, /disablePictureInPicture/);
  assert.doesNotMatch(mediaCaptureScreen, /real-camera-canvas/);
});

test("foto android prioriza ImageCapture e jpeg com baixa compressao", () => {
  const photoOrientation = readFileSync(new URL("../src/lib/photoOrientation.ts", import.meta.url), "utf8");

  assert.match(mediaCaptureScreen, /ImageCapture\?: BrowserImageCaptureConstructor/);
  assert.match(mediaCaptureScreen, /captureTrackPhotoDataUrl\(stream\)/);
  assert.match(mediaCaptureScreen, /imageCapture\.takePhoto\(settings\)/);
  assert.match(mediaCaptureScreen, /readBlobAsDataUrl\(photoBlob\)/);
  assert.match(mediaCaptureScreen, /if \(!photoDataUrl && video\) photoDataUrl = await captureVideoFrameDataUrlAsync\(video\);/);
  assert.match(photoOrientation, /const PHOTO_OUTPUT_QUALITY = 0\.98;/);
});

test("camera pendente mostra suporte apos um segundo", () => {
  assert.match(mediaCaptureScreen, /const CAMERA_SUPPORT_MESSAGE_DELAY_MS = 1000;/);
  assert.match(mediaCaptureScreen, /setShowSupportMessage\(true\)/);
  assert.match(mediaCaptureScreen, /Camera nao respondeu\. Fale com o suporte de TI da Betinhos\./);
  assert.doesNotMatch(mediaCaptureScreen, /Liberar Câmera/);
  assert.doesNotMatch(styles, /camera-permission-action/);
});
