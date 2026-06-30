import { useEffect, useRef, useState } from "react";
import { TextInputControl } from "../components/common/FormFields";
import { SystemIcon } from "../components/icons/SystemIcon";
import { AppShell } from "../components/layout/AppShell";
import { FormMenu } from "../components/navigation/FormMenu";
import { reportAppError } from "../lib/appErrorLogger";
import {
  captureVideoFrameDataUrl,
  createVideoPosterDataUrl,
  formatVideoDuration,
  getVideoDurationLabelFromUrl,
  readBlobAsDataUrl,
  readPhotoFileAsDataUrl
} from "../lib/photoOrientation";
import type { MaintenancePhotoKind } from "../types";

type MediaCaptureScreenProps = {
  kind: MaintenancePhotoKind;
  title?: string;
  onBack: () => void;
  onCapture: (photoDataUrl: string) => void;
  onCaptureVideo?: (videoDataUrl: string, previewUrl: string, posterUrl: string, durationLabel: string) => void;
  onSwitchCamera: () => void;
};

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

function isAndroidDevice() {
  return /Android/i.test(globalThis.navigator?.userAgent ?? "");
}

function getCameraVideoConstraints(mode: "environment" | "user"): MediaTrackConstraints {
  return {
    facingMode: { ideal: mode },
    width: { ideal: 1920, max: 1920 },
    height: { ideal: 1080, max: 1080 },
    aspectRatio: { ideal: 16 / 9 },
    frameRate: { ideal: 30, max: 30 }
  };
}

function getFallbackCameraVideoConstraints(mode: "environment" | "user"): MediaTrackConstraints {
  return {
    facingMode: mode,
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 30 }
  };
}

async function preferFullHdTrack(track: MediaStreamTrack, mode: "environment" | "user") {
  try {
    await track.applyConstraints(getCameraVideoConstraints(mode));
    return;
  } catch {
    // Ignore and keep fallback below.
  }

  try {
    await track.applyConstraints(getFallbackCameraVideoConstraints(mode));
  } catch {
    // Keep browser-selected defaults when explicit constraints fail.
  }
}

function getPreferredVideoMimeType() {
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const isSafari = /Safari/i.test(userAgent) && !/Chrome|Chromium|Android/i.test(userAgent);
  const candidates = isSafari
    ? ["video/mp4;codecs=h264,aac", "video/mp4", "video/webm;codecs=vp8", "video/webm"]
    : ["video/webm;codecs=vp8", "video/webm", "video/webm;codecs=vp9", "video/mp4"];
  return candidates.find((candidate) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate)) ?? "";
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
  const captureRequestedAtRef = useRef(Date.now());
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [cameraError, setCameraError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const useLiveCamera = isAndroidDevice();
  const nativeCaptureMode = facingMode === "environment" ? "environment" : "user";

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

  const startLiveCamera = async (mode = facingMode) => {
    if (!useLiveCamera || recording || processing) return;

    setStarting(true);
    setReady(false);
    setCameraError("");
    stopStream();

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Este Android nao liberou camera direta no navegador.");
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: getCameraVideoConstraints(mode),
          audio: false
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: getFallbackCameraVideoConstraints(mode),
          audio: false
        });
      }

      streamRef.current = stream;
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        await preferFullHdTrack(videoTrack, mode);
        try {
          videoTrack.contentHint = onCaptureVideo ? "motion" : "detail";
        } catch {
          // Ignore browsers that expose contentHint as read-only.
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.muted = true;
        await videoRef.current.play();
      }

      setReady(true);
    } catch (error) {
      reportAppError(error, {
        severity: "error",
        source: "media-capture",
        action: "start-live-camera",
        component: "MediaCaptureScreen",
        screen: "TelaCameraMidia",
        payload: { mode, useLiveCamera }
      });
      setCameraError(error instanceof Error ? error.message : "Nao foi possivel abrir a camera.");
    } finally {
      setStarting(false);
    }
  };

  const openNativePhotoCamera = () => {
    if (useLiveCamera) {
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
    if (useLiveCamera) {
      if (!ready) {
        void startLiveCamera();
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
    if (useLiveCamera) void startLiveCamera(next);
  };

  const captureLivePhoto = () => {
    const video = videoRef.current;
    if (!video || !ready || processing || recording) {
      setCameraError("Abra a camera para tirar a foto.");
      return;
    }

    try {
      const photoDataUrl = captureVideoFrameDataUrl(video);
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
    }
  };

  const startLiveRecording = () => {
    const stream = streamRef.current;
    if (!onCaptureVideo) {
      setCameraError("Video indisponivel nesta tela.");
      return;
    }
    if (!useLiveCamera) {
      openNativeVideoCamera();
      return;
    }
    if (!stream || !ready) {
      setCameraError("Abra a camera antes de gravar.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setCameraError("Este Android nao liberou gravacao direta no navegador.");
      return;
    }

    try {
      recordedChunksRef.current = [];
      const mimeType = getPreferredVideoMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType
          ? {
              mimeType,
              videoBitsPerSecond: 3_200_000
            }
          : {
              videoBitsPerSecond: 3_200_000
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
        setProcessing(true);
        let previewUrl = "";
        try {
          if (!chunks.length) throw new Error("Nenhum dado de video capturado.");
          const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
          previewUrl = URL.createObjectURL(blob);
          const fallbackDuration = formatVideoDuration((Date.now() - recordingStartedAtRef.current) / 1000);
          const [videoDataUrl, posterUrl, durationLabel] = await Promise.all([
            readBlobAsDataUrl(blob),
            createVideoPosterDataUrl(previewUrl),
            getVideoDurationLabelFromUrl(previewUrl)
          ]);
          onCaptureVideo(videoDataUrl, previewUrl, posterUrl, durationLabel || fallbackDuration);
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
          setProcessing(false);
          recorderRef.current = null;
        }
      };
      recordingStartedAtRef.current = Date.now();
      setRecordingSeconds(0);
      recorder.start();
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
        const [videoDataUrl, posterUrl, durationLabel] = await Promise.all([
          readBlobAsDataUrl(file),
          createVideoPosterDataUrl(previewUrl),
          getVideoDurationLabelFromUrl(previewUrl)
        ]);
        onCaptureVideo(videoDataUrl, previewUrl, posterUrl, durationLabel);
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
        revokeObjectPreviewUrl(previewUrl);
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
    return () => stopStream();
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
      if (useLiveCamera) {
        void startLiveCamera();
        return;
      }
      openNativePhotoCamera();
    }, 120);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <AppShell screenLabel="TelaCameraMidia">
      <FormMenu title="" onBack={onBack} />
      <section className="main-panel photo-main">
        <article className="photo-card camera-capture-card">
          <div className="photo-title camera-capture-title">
            <strong>{title ?? getTitleByKind(kind)}</strong>
            <span>
              {recording ? `REC ${formatVideoDuration(recordingSeconds)}` : processing ? "Preparando midia" : useLiveCamera ? "Camera ao vivo" : "Camera nativa"}
            </span>
          </div>
          <div className="photo-body">
            <div className="camera-view real-camera-view native-camera-view">
              {useLiveCamera ? <video ref={videoRef} className="real-camera-video" playsInline muted autoPlay /> : null}

              {useLiveCamera && recording ? (
                <div className="camera-recording-pill" aria-live="polite">
                  <span />
                  <strong>{formatVideoDuration(recordingSeconds)}</strong>
                </div>
              ) : null}

              {!useLiveCamera ? (
                <div className="camera-start-panel native-camera-panel">
                  <strong>Camera do dispositivo</strong>
                  <span>{nativeCaptureMode === "environment" ? "Traseira preferencial" : "Frontal preferencial"}</span>
                  <button onClick={openNativePhotoCamera} disabled={processing}>Tirar foto</button>
                  {onCaptureVideo ? (
                    <button className="native-camera-link" onClick={openNativeVideoCamera} disabled={processing}>Gravar video</button>
                  ) : null}
                </div>
              ) : null}

              {useLiveCamera && !cameraError && !ready && !starting ? (
                <div className="camera-start-panel native-camera-panel">
                  <strong>Camera ao vivo</strong>
                  <span>No Android a captura acontece direto na tela para bloquear galeria.</span>
                  <button onClick={() => void startLiveCamera()} disabled={processing}>Abrir camera</button>
                </div>
              ) : null}

              {processing ? <div className="camera-loading camera-processing">Preparando midia...</div> : null}
              {starting ? <div className="camera-loading">Abrindo camera...</div> : null}

              {cameraError ? (
                <div className="camera-error">
                  <strong>Camera indisponivel</strong>
                  <span>{cameraError}</span>
                  <small>{useLiveCamera ? "Permita acesso a camera para capturar agora." : "Toque em tirar foto ou gravar video para abrir a camera nativa."}</small>
                </div>
              ) : null}
            </div>

            {!useLiveCamera ? (
              <>
                <TextInputControl
                  ref={photoInputRef}
                  className="native-camera-input"
                  type="file"
                  accept="image/*"
                  capture={nativeCaptureMode}
                  onChange={handleNativeCapture}
                />
                <TextInputControl
                  ref={videoInputRef}
                  className="native-camera-input"
                  type="file"
                  accept="video/*,.mov,video/quicktime"
                  capture={nativeCaptureMode}
                  onChange={handleNativeCapture}
                />
              </>
            ) : null}

            <div className="photo-actions photo-actions-ios camera-actions-pro">
              <button
                className="photo-capture"
                onClick={useLiveCamera ? captureLivePhoto : openNativePhotoCamera}
                aria-label="Tirar foto"
                disabled={processing || (useLiveCamera && (!ready || recording))}
              >
                <SystemIcon name="camera" />
              </button>
              {onCaptureVideo ? (
                <button
                  className={`photo-record ${recording ? "is-recording" : ""}`}
                  onClick={useLiveCamera ? (recording ? stopLiveRecording : startLiveRecording) : openNativeVideoCamera}
                  aria-label={recording ? "Parar gravacao" : "Gravar video"}
                  disabled={processing || (useLiveCamera && !ready && !recording)}
                >
                  <SystemIcon name="video" />
                </button>
              ) : null}
              <button className="photo-switch" onClick={switchCamera} aria-label="Mudar camera" disabled={processing || recording || starting}>
                <SystemIcon name="sync" />
              </button>
            </div>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
