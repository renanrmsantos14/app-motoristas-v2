import { useEffect, useRef, useState } from "react";
import { TextInputControl } from "../components/common/FormFields";
import { SystemIcon } from "../components/icons/SystemIcon";
import { AppShell } from "../components/layout/AppShell";
import { FormMenu } from "../components/navigation/FormMenu";
import { reportAppError } from "../lib/appErrorLogger";
import {
  captureVideoFrameDataUrlAsync,
  formatVideoDuration,
  readBlobAsDataUrl,
  readPhotoFileAsDataUrl
} from "../lib/photoOrientation";
import type { CapturedVideoDraft, MaintenancePhotoKind } from "../types";

type MediaCaptureScreenProps = {
  kind: MaintenancePhotoKind;
  title?: string;
  onBack: () => void;
  onCapture: (photoDataUrl: string) => void;
  onCaptureVideo?: (video: CapturedVideoDraft) => void;
  onSwitchCamera: () => void;
};

type VideoCaptureProfile = {
  label: "hdPlus" | "hd";
  frameRate: number;
  bitRate: number;
};

type BrowserImageCapture = {
  takePhoto: (settings?: { imageWidth?: number; imageHeight?: number }) => Promise<Blob>;
  getPhotoCapabilities?: () => Promise<{
    imageWidth?: { max?: number };
    imageHeight?: { max?: number };
  }>;
};

type BrowserImageCaptureConstructor = new (track: MediaStreamTrack) => BrowserImageCapture;

type FocusAwareMediaTrackCapabilities = MediaTrackCapabilities & {
  focusMode?: string[];
};

type FocusAwareMediaTrackConstraints = MediaTrackConstraints & {
  focusMode?: ConstrainDOMString;
};

const CAMERA_SUPPORT_MESSAGE_DELAY_MS = 1000;

function getTitleByKind(kind: MaintenancePhotoKind) {
  if (kind.startsWith("NOTAFISCAL")) return "Tire a foto da nota fiscal";
  if (kind === "FOTO1") return "Tire a foto 1 de 3";
  if (kind === "FOTO2") return "Tire a foto 2 de 3";
  return "Tire a foto 3 de 3";
}

function isVideoFile(file: File) {
  return file.type.startsWith("video/") || /\.(mov|mp4|webm|m4v)$/i.test(file.name);
}

function revokeObjectPreviewUrl(url: string) {
  if (url.startsWith("blob:")) URL.revokeObjectURL(url);
}

function isFreshNativeCapture(file: File, requestedAt: number) {
  const freshnessToleranceMs = 15_000;
  return file.lastModified >= requestedAt - freshnessToleranceMs;
}

function shouldUseLiveCameraCapture() {
  const userAgent = globalThis.navigator?.userAgent ?? "";
  const isMobileCameraDevice = /Android|iPhone|iPad|iPod/i.test(userAgent);
  return isMobileCameraDevice && Boolean(globalThis.navigator?.mediaDevices?.getUserMedia);
}

function isAppleMobileDevice() {
  return /iPhone|iPad|iPod/i.test(globalThis.navigator?.userAgent ?? "");
}

function getPreferredCameraVideoConstraints(mode: "environment" | "user"): MediaTrackConstraints {
  return {
    facingMode: { ideal: mode },
    height: { ideal: 1080, min: 720 },
    frameRate: { ideal: 30, max: 30 }
  };
}

function getFallbackCameraVideoConstraints(mode: "environment" | "user"): MediaTrackConstraints {
  return {
    facingMode: mode,
    frameRate: { ideal: 30, max: 30 }
  };
}

function getPreferredVideoProfile(track: MediaStreamTrack): VideoCaptureProfile {
  const capabilities = track.getCapabilities?.();
  const widthMax = Math.floor(Number(capabilities?.width?.max ?? 0));
  const heightMax = Math.floor(Number(capabilities?.height?.max ?? 0));
  const frameRateMax = Math.floor(Number(capabilities?.frameRate?.max ?? 0));
  const deviceMemory = Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 0);
  const hardwareConcurrency = Number(navigator.hardwareConcurrency ?? 0);
  const supportsHdPlus = widthMax >= 1280 && heightMax >= 720 && frameRateMax >= 30;
  const highTierDevice = deviceMemory >= 8 && hardwareConcurrency >= 8;

  if (supportsHdPlus && highTierDevice) {
    return {
      label: "hdPlus",
      frameRate: 30,
      bitRate: 12_000_000
    };
  }

  return {
    label: "hd",
    frameRate: 30,
    bitRate: 8_000_000
  };
}

function buildTrackConstraints(
  mode: "environment" | "user",
  profile: VideoCaptureProfile,
  continuousFocus = false
): MediaTrackConstraints {
  const constraints: FocusAwareMediaTrackConstraints = {
    facingMode: { ideal: mode },
    height: { ideal: 1080, min: 720 },
    frameRate: { ideal: profile.frameRate, min: 24, max: profile.frameRate }
  };

  if (continuousFocus) {
    constraints.focusMode = { ideal: "continuous" };
  }

  return constraints;
}

async function preferTrackProfile(track: MediaStreamTrack, mode: "environment" | "user") {
  const preferredProfile = getPreferredVideoProfile(track);
  let supportsContinuousFocus = false;

  try {
    const capabilities = track.getCapabilities?.() as FocusAwareMediaTrackCapabilities | undefined;
    supportsContinuousFocus = capabilities?.focusMode?.includes("continuous") ?? false;
  } catch {
    // Keep current browser-selected focus behavior when capabilities are unavailable.
  }

  const applyProfile = async (profile: VideoCaptureProfile, withContinuousFocus: boolean) => {
    try {
      await track.applyConstraints(buildTrackConstraints(mode, profile, withContinuousFocus));
      return true;
    } catch {
      return false;
    }
  };

  if (await applyProfile(preferredProfile, supportsContinuousFocus)) {
    return preferredProfile;
  }
  if (supportsContinuousFocus && await applyProfile(preferredProfile, false)) {
    return preferredProfile;
  }

  const fallbackProfile: VideoCaptureProfile = {
    label: "hd",
    frameRate: 30,
    bitRate: 8_000_000
  };

  if (await applyProfile(fallbackProfile, supportsContinuousFocus)) {
    return fallbackProfile;
  }
  if (supportsContinuousFocus && await applyProfile(fallbackProfile, false)) {
    return fallbackProfile;
  }

  return fallbackProfile;
}

function getPreferredVideoMimeType() {
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const isAndroid = /Android/i.test(userAgent);
  const isSafari = /Safari/i.test(userAgent) && !/Chrome|Chromium|Android/i.test(userAgent);
  const candidates = isSafari
    ? ["video/mp4;codecs=avc1.64001F", "video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp8", "video/webm"]
    : isAndroid
      ? [
          "video/mp4;codecs=avc1.64001F",
          "video/mp4;codecs=avc1.42E01E",
          "video/mp4",
          "video/webm;codecs=vp9",
          "video/webm;codecs=vp8",
          "video/webm"
        ]
      : ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
  return candidates.find((candidate) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate)) ?? "";
}

function configureInlineCameraVideo(video: HTMLVideoElement) {
  video.playsInline = true;
  video.muted = true;
  video.defaultMuted = true;
  video.autoplay = true;
  video.controls = false;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.setAttribute("x5-playsinline", "");
  video.setAttribute("x5-video-player-type", "h5");
  video.setAttribute("x5-video-player-fullscreen", "false");
  if ("disablePictureInPicture" in video) video.disablePictureInPicture = true;
}

async function captureTrackPhotoDataUrl(stream: MediaStream) {
  const ImageCaptureConstructor = (globalThis as typeof globalThis & { ImageCapture?: BrowserImageCaptureConstructor }).ImageCapture;
  const videoTrack = stream.getVideoTracks()[0];
  if (!ImageCaptureConstructor || !videoTrack) return "";

  const imageCapture = new ImageCaptureConstructor(videoTrack);
  const capabilities = await imageCapture.getPhotoCapabilities?.();
  const maxWidth = Math.floor(Number(capabilities?.imageWidth?.max ?? 0));
  const maxHeight = Math.floor(Number(capabilities?.imageHeight?.max ?? 0));
  const settings = maxWidth > 0 && maxHeight > 0 ? { imageWidth: maxWidth, imageHeight: maxHeight } : undefined;
  const photoBlob = await imageCapture.takePhoto(settings);
  return readBlobAsDataUrl(photoBlob);
}

export function MediaCaptureScreen({ kind, title, onBack, onCapture, onCaptureVideo, onSwitchCamera }: MediaCaptureScreenProps) {
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef(0);
  const defaultLaunchAttemptedRef = useRef(false);
  const cameraRequestSequenceRef = useRef(0);
  const supportMessageTimerRef = useRef<number | null>(null);
  const captureRequestedAtRef = useRef(Date.now());
  const activeVideoProfileRef = useRef<VideoCaptureProfile>({
    label: "hd",
    frameRate: 30,
    bitRate: 8_000_000
  });
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [cameraError, setCameraError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [capturingPhoto, setCapturingPhoto] = useState(false);
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [showSupportMessage, setShowSupportMessage] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const useLiveCamera = shouldUseLiveCameraCapture();
  const useAppleMobile = isAppleMobileDevice();
  const useLiveRecording = useLiveCamera && !useAppleMobile;
  const useLivePreview = useLiveRecording;
  const nativeCaptureMode = facingMode === "environment" ? "environment" : "user";
  const nativeVideoAccept = useAppleMobile ? "video/*" : "video/*,.mov,video/quicktime";

  const stopStream = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
      recorder.stop();
    }
    recorderRef.current = null;
    recordedChunksRef.current = [];
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setReady(false);
    setRecording(false);
    setRecordingSeconds(0);
  };

  const updateTrackContentHint = (isRecording: boolean) => {
    const videoTrack = streamRef.current?.getVideoTracks?.()[0];
    if (!videoTrack) return;
    try {
      videoTrack.contentHint = isRecording ? "motion" : "detail";
    } catch {
      // Ignore browsers that expose contentHint as read-only.
    }
  };

  const clearSupportMessageTimer = () => {
    if (supportMessageTimerRef.current === null) return;
    window.clearTimeout(supportMessageTimerRef.current);
    supportMessageTimerRef.current = null;
  };

  const startLiveCamera = async (mode = facingMode) => {
    if (!useLiveCamera || recording || processing) return false;

    const requestSequence = ++cameraRequestSequenceRef.current;

    setStarting(true);
    setReady(false);
    setCameraError("");
    setShowSupportMessage(false);
    clearSupportMessageTimer();
    supportMessageTimerRef.current = window.setTimeout(() => {
      if (cameraRequestSequenceRef.current === requestSequence) setShowSupportMessage(true);
    }, CAMERA_SUPPORT_MESSAGE_DELAY_MS);
    stopStream();

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Este dispositivo nao liberou camera direta no navegador.");
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: getPreferredCameraVideoConstraints(mode),
          audio: false
        });
      } catch {
        if (cameraRequestSequenceRef.current !== requestSequence) return false;
        stream = await navigator.mediaDevices.getUserMedia({
          video: getFallbackCameraVideoConstraints(mode),
          audio: false
        });
      }

      if (cameraRequestSequenceRef.current !== requestSequence) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }

      streamRef.current = stream;
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        activeVideoProfileRef.current = await preferTrackProfile(videoTrack, mode);
        updateTrackContentHint(false);
      }

      if (videoRef.current && useLivePreview) {
        configureInlineCameraVideo(videoRef.current);
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setReady(true);
      return true;
    } catch (error) {
      if (cameraRequestSequenceRef.current !== requestSequence) return false;
      reportAppError(error, {
        severity: "error",
        source: "media-capture",
        action: "start-live-camera",
        component: "MediaCaptureScreen",
        screen: "TelaCameraMidia",
        payload: { mode, useLiveCamera }
      });
      setCameraError(error instanceof Error ? error.message : "Nao foi possivel abrir a camera.");
      return false;
    } finally {
      if (cameraRequestSequenceRef.current === requestSequence) {
        clearSupportMessageTimer();
        setShowSupportMessage(false);
        setStarting(false);
      }
    }
  };

  const openNativePhotoCamera = () => {
    if (useLivePreview) {
      void startLiveCamera();
      return;
    }
    setCameraError("");
    captureRequestedAtRef.current = Date.now();
    photoInputRef.current?.click();
  };

  const openNativeVideoCamera = () => {
    if (!onCaptureVideo) {
      setCameraError("Video indisponivel nesta tela.");
      return;
    }
    if (useLiveRecording) {
      if (!ready) {
        void startLiveRecording();
        return;
      }
      return;
    }
    setCameraError("");
    captureRequestedAtRef.current = Date.now();
    videoInputRef.current?.click();
  };

  const switchCamera = () => {
    if (processing || recording) return;
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    onSwitchCamera();
    if (useLivePreview) void startLiveCamera(next);
  };

  const captureLivePhoto = async () => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if ((!video && !stream) || !ready || processing || recording) {
      setCameraError("Abra a camera para tirar a foto.");
      return;
    }

    try {
      setCameraError("");
      setCapturingPhoto(true);
      setProcessing(true);
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });
      let photoDataUrl = "";
      if (stream) {
        try {
          photoDataUrl = await captureTrackPhotoDataUrl(stream);
        } catch {
          photoDataUrl = "";
        }
      }
      if (!photoDataUrl && video) photoDataUrl = await captureVideoFrameDataUrlAsync(video);
      if (!photoDataUrl) throw new Error("Nao foi possivel capturar a foto.");
      onCapture(photoDataUrl);
    } catch (error) {
      reportAppError(error, {
        severity: "error",
        source: "media-capture",
        action: "capture-live-photo",
        component: "MediaCaptureScreen",
        screen: "TelaCameraMidia"
      });
      setCameraError(error instanceof Error ? error.message : "Nao foi possivel capturar a foto.");
    } finally {
      setCapturingPhoto(false);
      setProcessing(false);
    }
  };

  const startLiveRecording = async () => {
    let stream = streamRef.current;
    if (!onCaptureVideo) {
      setCameraError("Video indisponivel nesta tela.");
      return;
    }
    if (!useLiveRecording) {
      openNativeVideoCamera();
      return;
    }
    if (!stream || !ready) {
      const started = await startLiveCamera();
      stream = streamRef.current;
      if (!started || !stream) {
        setCameraError("Nao foi possivel abrir a camera para gravar.");
        return;
      }
    }
    if (typeof MediaRecorder === "undefined") {
      setCameraError("Este dispositivo nao liberou gravacao direta no navegador.");
      return;
    }

    try {
      updateTrackContentHint(true);
      recordedChunksRef.current = [];
      const mimeType = getPreferredVideoMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType
          ? {
              mimeType,
              videoBitsPerSecond: activeVideoProfileRef.current.bitRate
            }
          : {
              videoBitsPerSecond: activeVideoProfileRef.current.bitRate
            }
      );
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setRecording(false);
        setProcessing(false);
        setCameraError("Falha durante a gravacao do video.");
      };
      recorder.onstop = async () => {
        const chunks = recordedChunksRef.current;
        recordedChunksRef.current = [];
        setRecording(false);
        let previewUrl = "";
        try {
          if (!chunks.length) throw new Error("Nenhum dado de video capturado.");
          const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
          previewUrl = URL.createObjectURL(blob);
          onCaptureVideo({
            rawBlob: blob,
            previewUrl,
            durationLabel: formatVideoDuration((Date.now() - recordingStartedAtRef.current) / 1000)
          });
          previewUrl = "";
        } catch (error) {
          reportAppError(error, {
            severity: "error",
            source: "media-capture",
            action: "finalize-live-video",
            component: "MediaCaptureScreen",
            screen: "TelaCameraMidia"
          });
          setCameraError(error instanceof Error ? error.message : "Nao foi possivel preparar o video.");
        } finally {
          if (previewUrl) revokeObjectPreviewUrl(previewUrl);
          recorderRef.current = null;
        }
      };
      recordingStartedAtRef.current = Date.now();
      setRecordingSeconds(0);
      recorder.start(1000);
      setRecording(true);
      setCameraError("");
    } catch (error) {
      reportAppError(error, {
        severity: "error",
        source: "media-capture",
        action: "start-live-recording",
        component: "MediaCaptureScreen",
        screen: "TelaCameraMidia"
      });
      setRecording(false);
      setProcessing(false);
      setCameraError(error instanceof Error ? error.message : "Nao foi possivel iniciar a gravacao.");
    }
  };

  const stopLiveRecording = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    updateTrackContentHint(false);
    recorder.stop();
  };

  const handleNativeCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || processing) return;

    setCameraError("");
    setProcessing(true);

    if (!isFreshNativeCapture(file, captureRequestedAtRef.current)) {
      setCameraError("Use a camera para registrar agora. Arquivos antigos da galeria nao sao aceitos.");
      event.target.value = "";
      setProcessing(false);
      return;
    }

    if (isVideoFile(file)) {
      if (!onCaptureVideo) {
        setCameraError("Video indisponivel nesta tela.");
        event.target.value = "";
        setProcessing(false);
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      try {
        onCaptureVideo({ rawBlob: file, previewUrl });
        event.target.value = "";
        setProcessing(false);
        return;
      } catch (error) {
        reportAppError(error, {
          severity: "error",
          source: "media-capture",
          action: "prepare-native-video",
          component: "MediaCaptureScreen",
          screen: "TelaCameraMidia",
          payload: { fileName: file.name, fileType: file.type }
        });
        setCameraError(error instanceof Error ? error.message : "Nao foi possivel preparar o video.");
      } finally {
        event.target.value = "";
        setProcessing(false);
      }
      return;
    }

    try {
      const dataUrl = await readPhotoFileAsDataUrl(file, 0);
      onCapture(dataUrl);
    } catch (error) {
      reportAppError(error, {
        severity: "error",
        source: "media-capture",
        action: "prepare-native-photo",
        component: "MediaCaptureScreen",
        screen: "TelaCameraMidia",
        payload: { fileName: file.name, fileType: file.type }
      });
      setCameraError(error instanceof Error ? error.message : "Nao foi possivel preparar a foto.");
    } finally {
      event.target.value = "";
      setProcessing(false);
    }
  };

  useEffect(() => {
    return () => {
      cameraRequestSequenceRef.current += 1;
      clearSupportMessageTimer();
      stopStream();
    };
  }, []);

  useEffect(() => {
    if (!recording) {
      setRecordingSeconds(0);
      return;
    }

    const timer = window.setInterval(() => {
      setRecordingSeconds((Date.now() - recordingStartedAtRef.current) / 1000);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    if (defaultLaunchAttemptedRef.current) return;
    defaultLaunchAttemptedRef.current = true;

    const timer = window.setTimeout(() => {
      if (useLivePreview) {
        void startLiveCamera();
        return;
      }
      openNativePhotoCamera();
    }, 120);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <AppShell screenLabel="TelaCameraMidia">
      <FormMenu title={title ?? getTitleByKind(kind)} onBack={onBack} />
      <section className="main-panel photo-main">
        <article className="photo-card camera-capture-card">
          <div className="photo-body">
            <div className="camera-view real-camera-view native-camera-view">
              {useLivePreview ? (
                <>
                  <video
                    ref={(element) => {
                      videoRef.current = element;
                      if (element) configureInlineCameraVideo(element);
                    }}
                    className="real-camera-video"
                    playsInline
                    muted
                    autoPlay
                    controls={false}
                    disablePictureInPicture
                  />
                </>
              ) : null}

              {useLiveCamera && capturingPhoto ? <div className="camera-shutter-flash" aria-hidden="true" /> : null}

              {useLiveCamera && recording ? (
                <div className="camera-recording-pill" aria-live="polite">
                  <span />
                  <strong>{formatVideoDuration(recordingSeconds)}</strong>
                </div>
              ) : null}

              {!useLiveRecording ? (
                <div className="camera-start-panel native-camera-panel">
                  <strong>Camera do dispositivo</strong>
                  <span>{nativeCaptureMode === "environment" ? "Traseira preferencial" : "Frontal preferencial"}</span>
                  <button onClick={openNativePhotoCamera} disabled={processing}>Tirar foto</button>
                  {onCaptureVideo ? (
                    <button className="native-camera-link" onClick={openNativeVideoCamera} disabled={processing}>Gravar video</button>
                  ) : null}
                </div>
              ) : null}

              {useLivePreview && !cameraError && !ready && !starting ? (
                <div className="camera-start-panel native-camera-panel">
                  <strong>Camera ao vivo</strong>
                  <span>A captura acontece direto na tela para manter qualidade e bloquear galeria.</span>
                  <button onClick={() => void startLiveCamera()} disabled={processing}>Abrir camera</button>
                </div>
              ) : null}

              {processing ? <div className="camera-loading camera-processing">{capturingPhoto ? "Capturando foto..." : "Preparando midia..."}</div> : null}
              {starting ? (
                <div className="camera-loading camera-permission-loading" aria-live="polite">
                  <span>Abrindo camera...</span>
                  {showSupportMessage ? <span>Camera nao respondeu. Fale com o suporte de TI da Betinhos.</span> : null}
                </div>
              ) : null}

              {cameraError ? (
                <div className="camera-error">
                  <strong>Camera indisponivel</strong>
                  <span>{cameraError}</span>
                  <small>{useLiveRecording ? "Permita acesso a camera para capturar agora." : "Toque em tirar foto ou gravar video para abrir a camera do dispositivo."}</small>
                </div>
              ) : null}
            </div>

            <TextInputControl
              ref={photoInputRef}
              className="native-camera-input"
              type="file"
              accept="image/*"
              capture={nativeCaptureMode}
              onChange={handleNativeCapture}
            />

            {!useLivePreview ? (
              <>
                <TextInputControl
                  ref={videoInputRef}
                  className="native-camera-input"
                  type="file"
                  accept={nativeVideoAccept}
                  capture={nativeCaptureMode}
                  onChange={handleNativeCapture}
                />
              </>
            ) : null}

            <div className="photo-actions photo-actions-ios camera-actions-pro">
              <div className="camera-side-action camera-side-action-left">
                {onCaptureVideo ? (
                  <button
                    className={`photo-record camera-secondary-action ${recording ? "is-recording" : ""}`}
                    onClick={useLiveRecording ? (recording ? stopLiveRecording : startLiveRecording) : openNativeVideoCamera}
                    aria-label={recording ? "Parar gravacao" : "Gravar video"}
                    disabled={processing || starting || (useLivePreview && !ready && !recording)}
                  >
                    <SystemIcon name="video" />
                  </button>
                ) : (
                  <div className="camera-action-spacer" aria-hidden="true" />
                )}
              </div>

              <button
                className="photo-capture camera-primary-action"
                onClick={useLivePreview ? captureLivePhoto : openNativePhotoCamera}
                aria-label="Tirar foto"
                disabled={processing || starting || (useLivePreview && (!ready || recording))}
              >
                <span className="camera-shutter-shell">
                  <span className="camera-shutter-core" />
                </span>
              </button>

              <div className="camera-side-action camera-side-action-right">
                <button className="photo-switch camera-secondary-action" onClick={switchCamera} aria-label="Mudar camera" disabled={processing || recording || starting}>
                  <SystemIcon name="sync" />
                </button>
              </div>
            </div>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
