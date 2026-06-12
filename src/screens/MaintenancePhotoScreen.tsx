import { useEffect, useRef, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { FormMenu } from "../components/navigation/FormMenu";
import { SystemIcon } from "../components/icons/SystemIcon";
import {
  captureVideoFrameDataUrl,
  createVideoPosterDataUrl,
  formatVideoDuration,
  getVideoDurationLabelFromUrl,
  getViewportOrientationAngle,
  isLandscapeViewport,
  normalizeAngle,
  readBlobAsDataUrl,
  readPhotoFileAsDataUrl
} from "../lib/photoOrientation";
import type { MaintenancePhotoKind } from "../types";

type MaintenancePhotoScreenProps = {
  kind: MaintenancePhotoKind;
  title?: string;
  onBack: () => void;
  onCapture: (photoDataUrl: string) => void;
  onCaptureVideo?: (videoDataUrl: string, previewUrl: string, posterUrl: string, durationLabel: string) => void;
  onSwitchCamera: () => void;
};

type TorchMediaTrackCapabilities = MediaTrackCapabilities & {
  torch?: boolean;
};

type TorchMediaTrackConstraintSet = MediaTrackConstraintSet & {
  torch?: boolean;
};

function getTitleByKind(kind: MaintenancePhotoKind) {
  if (kind.startsWith("NOTAFISCAL")) return "Tire a foto da nota fiscal";
  if (kind === "FOTO1") return "Tire a foto 1 de 3";
  if (kind === "FOTO2") return "Tire a foto 2 de 3";
  return "Tire a foto 3 de 3";
}

function getCameraVideoConstraints(mode: "environment" | "user"): MediaTrackConstraints {
  const landscape = isLandscapeViewport();
  return {
    facingMode: { ideal: mode },
    width: { ideal: landscape ? 1920 : 1280 },
    height: { ideal: landscape ? 1080 : 720 }
  };
}

function getPreferredVideoMimeType() {
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const isSafari = /Safari/i.test(userAgent) && !/Chrome|Chromium|Android/i.test(userAgent);
  const candidates = isSafari
    ? ["video/mp4;codecs=h264,aac", "video/mp4", "video/webm;codecs=vp8", "video/webm"]
    : ["video/webm;codecs=vp8", "video/webm", "video/webm;codecs=vp9", "video/mp4"];
  return candidates.find((candidate) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate)) ?? "";
}

function isVideoFile(file: File) {
  return file.type.startsWith("video/") || /\.(mov|mp4|webm|m4v)$/i.test(file.name);
}

function revokeObjectPreviewUrl(url: string) {
  if (url.startsWith("blob:")) URL.revokeObjectURL(url);
}

export function MaintenancePhotoScreen({ kind, title, onBack, onCapture, onCaptureVideo, onSwitchCamera }: MaintenancePhotoScreenProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef(0);
  const defaultLaunchAttemptedRef = useRef(false);
  const orientationAngleRef = useRef(getViewportOrientationAngle());
  const lastDeviceOrientationAtRef = useRef(0);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [cameraError, setCameraError] = useState("");
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startedByUser, setStartedByUser] = useState(false);
  const [flashSupported, setFlashSupported] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

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
    setFlashSupported(false);
    setFlashOn(false);
    setRecording(false);
  };

  useEffect(() => () => stopStream(), []);

  useEffect(() => {
    if (!recording) {
      setRecordingSeconds(0);
      return;
    }

    const timer = window.setInterval(() => {
      setRecordingSeconds((Date.now() - recordingStartedAtRef.current) / 1000);
    }, 250);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    const syncViewportOrientation = () => {
      if (Date.now() - lastDeviceOrientationAtRef.current < 800) return;
      orientationAngleRef.current = getViewportOrientationAngle();
    };

    const syncDeviceOrientation = (event: DeviceOrientationEvent) => {
      if (typeof event.gamma !== "number" || typeof event.beta !== "number") return;
      lastDeviceOrientationAtRef.current = Date.now();
      const currentAngle = orientationAngleRef.current;
      const tiltX = Math.abs(event.gamma);
      const enterLandscapeAt = 72;
      const exitLandscapeAt = 58;

      if (tiltX >= enterLandscapeAt) {
        orientationAngleRef.current = event.gamma > 0 ? 90 : 270;
        return;
      }
      if (event.beta < -125) {
        orientationAngleRef.current = 180;
        return;
      }
      if ((currentAngle === 90 || currentAngle === 270) && tiltX > exitLandscapeAt) return;
      if (tiltX <= exitLandscapeAt && event.beta > -25) {
        orientationAngleRef.current = 0;
      }
    };

    syncViewportOrientation();
    window.addEventListener("resize", syncViewportOrientation);
    window.addEventListener("orientationchange", syncViewportOrientation);
    window.addEventListener("deviceorientation", syncDeviceOrientation);

    return () => {
      window.removeEventListener("resize", syncViewportOrientation);
      window.removeEventListener("orientationchange", syncViewportOrientation);
      window.removeEventListener("deviceorientation", syncDeviceOrientation);
    };
  }, []);

  const startCamera = async (mode = facingMode) => {
    if (recording) return;
    setStarting(true);
    setReady(false);
    setCameraError("");
    stopStream();

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Este navegador não liberou câmera por vídeo.");
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: getCameraVideoConstraints(mode),
          audio: false
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode },
          audio: false
        });
      }

      streamRef.current = stream;
      const videoTrack = stream.getVideoTracks()[0];
      const capabilities = videoTrack?.getCapabilities?.() as TorchMediaTrackCapabilities | undefined;
      setFlashSupported(Boolean(capabilities?.torch));
      setFlashOn(false);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.muted = true;
        await videoRef.current.play();
      }
      setStartedByUser(true);
      setReady(true);
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "Não foi possível abrir a câmera.");
    } finally {
      setStarting(false);
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (recording || processing) return;
    if (!video || !ready || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError("Câmera ainda não está pronta. Toque em Abrir câmera ou use câmera nativa.");
      return;
    }

    const photoDataUrl = captureVideoFrameDataUrl(video, normalizeAngle(orientationAngleRef.current));
    if (photoDataUrl) onCapture(photoDataUrl);
  };

  const switchCamera = () => {
    if (recording || processing) return;
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    onSwitchCamera();
    if (startedByUser) void startCamera(next);
  };

  const toggleFlash = async () => {
    const videoTrack = streamRef.current?.getVideoTracks()[0];
    if (!videoTrack || !ready) {
      setCameraError("Abra a câmera antes de ativar o flash.");
      return;
    }

    if (!flashSupported) {
      setCameraError("Este dispositivo não liberou controle de flash pelo navegador.");
      return;
    }

    const nextFlashOn = !flashOn;
    try {
      await videoTrack.applyConstraints({
        advanced: [{ torch: nextFlashOn } as TorchMediaTrackConstraintSet]
      });
      setFlashOn(nextFlashOn);
      setCameraError("");
    } catch (error) {
      setFlashOn(false);
      setCameraError(error instanceof Error ? error.message : "Não foi possível controlar o flash.");
    }
  };

  const openNativeCamera = () => {
    fileInputRef.current?.click();
  };

  const handleNativeCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (isVideoFile(file)) {
      if (!onCaptureVideo) {
        setCameraError("Vídeo indisponível nesta tela.");
        event.target.value = "";
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
        setCameraError(error instanceof Error ? error.message : "Não foi possível preparar o vídeo.");
      } finally {
        revokeObjectPreviewUrl(previewUrl);
        event.target.value = "";
      }
      return;
    }
    const dataUrl = await readPhotoFileAsDataUrl(file, normalizeAngle(orientationAngleRef.current));
    onCapture(dataUrl);
    event.target.value = "";
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!onCaptureVideo) {
      setCameraError("Vídeo indisponível nesta tela.");
      return;
    }
    if (!stream || !ready) {
      setCameraError("Abra a câmera antes de gravar.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setCameraError("Este navegador não liberou gravação por vídeo. Use a câmera nativa.");
      return;
    }

    try {
      recordedChunksRef.current = [];
      const mimeType = getPreferredVideoMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setRecording(false);
        setProcessing(false);
        setCameraError("Falha durante a gravação do vídeo.");
      };
      recorder.onstop = async () => {
        const chunks = recordedChunksRef.current;
        recordedChunksRef.current = [];
        setRecording(false);
        setProcessing(true);
        let previewUrl = "";
        try {
          if (!chunks.length) throw new Error("Nenhum dado de vídeo capturado.");
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
          setCameraError(error instanceof Error ? error.message : "Não foi possível preparar o vídeo.");
        } finally {
          if (previewUrl) revokeObjectPreviewUrl(previewUrl);
          setProcessing(false);
          recorderRef.current = null;
        }
      };
      recordingStartedAtRef.current = Date.now();
      setRecordingSeconds(0);
      recorder.start(250);
      setRecording(true);
      setCameraError("");
    } catch (error) {
      setRecording(false);
      setProcessing(false);
      setCameraError(error instanceof Error ? error.message : "Não foi possível iniciar a gravação.");
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  };

  useEffect(() => {
    if (defaultLaunchAttemptedRef.current) return;
    defaultLaunchAttemptedRef.current = true;

    void startCamera("environment");
  }, []);

  return (
    <AppShell screenLabel="TelaCameraMidia">
      <FormMenu title="" onBack={onBack} />
      <section className="main-panel photo-main">
        <article className="photo-card camera-capture-card">
          <div className="photo-title camera-capture-title">
            <strong>{title ?? getTitleByKind(kind)}</strong>
            <span>{recording ? `REC ${formatVideoDuration(recordingSeconds)}` : processing ? "Preparando vídeo" : "Foto ou vídeo"}</span>
          </div>
          <div className="photo-body">
            <div className="camera-view real-camera-view">
              <video ref={videoRef} className="real-camera-video" playsInline muted autoPlay />

              {recording ? (
                <div className="camera-recording-pill" aria-live="polite">
                  <span />
                  <strong>{formatVideoDuration(recordingSeconds)}</strong>
                </div>
              ) : null}

              {processing ? <div className="camera-loading camera-processing">Preparando vídeo...</div> : null}

              {!startedByUser && !starting && !cameraError ? (
                <div className="camera-start-panel">
                  <strong>Abra a câmera</strong>
                  <span>Use foto ou vídeo no mesmo fluxo.</span>
                  <button onClick={() => startCamera()}>Abrir câmera</button>
                  <button className="native-camera-link" onClick={openNativeCamera}>Usar câmera nativa</button>
                </div>
              ) : null}

              {cameraError ? (
                <div className="camera-error">
                  <strong>Câmera indisponível</strong>
                  <span>{cameraError}</span>
                  <small>Use a câmera nativa se o navegador bloquear foto ou vídeo.</small>
                  <button onClick={() => startCamera()}>Tentar novamente</button>
                  <button className="native-camera-link" onClick={openNativeCamera}>Usar câmera nativa</button>
                </div>
              ) : null}

              {!cameraError && starting ? <div className="camera-loading">Abrindo câmera...</div> : null}
            </div>

            <input
              ref={fileInputRef}
              className="native-camera-input"
              type="file"
              accept="image/*,video/*,.mov,video/quicktime"
              capture={facingMode === "environment" ? "environment" : "user"}
              onChange={handleNativeCapture}
            />

            <div className="photo-actions photo-actions-ios camera-actions-pro">
              <button
                className={`photo-flash ${flashOn ? "is-active" : ""}`}
                onClick={toggleFlash}
                aria-label={flashOn ? "Desativar flash" : "Ativar flash"}
                disabled={!ready || !flashSupported || recording || processing}
              >
                <SystemIcon name="flash" />
              </button>
              <button className="photo-capture" onClick={capture} aria-label="Tirar foto" disabled={!ready || recording || processing}>
                <SystemIcon name="camera" />
              </button>
              <button
                className={`photo-record ${recording ? "is-recording" : ""}`}
                onClick={recording ? stopRecording : startRecording}
                aria-label={recording ? "Parar gravação" : "Gravar vídeo"}
                disabled={processing || (!ready && !recording)}
              >
                <SystemIcon name="video" />
              </button>
              <button className="photo-switch" onClick={switchCamera} aria-label="Mudar câmera" disabled={recording || processing}>
                <SystemIcon name="sync" />
              </button>
            </div>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
