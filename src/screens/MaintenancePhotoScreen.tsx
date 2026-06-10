import { useEffect, useRef, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { FormMenu } from "../components/navigation/FormMenu";
import { SystemIcon } from "../components/icons/SystemIcon";
import { captureVideoFrameDataUrl, getViewportOrientationAngle, isLandscapeViewport, normalizeAngle, readPhotoFileAsDataUrl } from "../lib/photoOrientation";
import type { MaintenancePhotoKind } from "../types";

type MaintenancePhotoScreenProps = {
  kind: MaintenancePhotoKind;
  title?: string;
  onBack: () => void;
  onCapture: (photoDataUrl: string) => void;
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

function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";
  return /iPad|iPhone|iPod/i.test(userAgent) || (platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function getCameraVideoConstraints(mode: "environment" | "user"): MediaTrackConstraints {
  const landscape = isLandscapeViewport();
  return {
    facingMode: { ideal: mode },
    width: { ideal: landscape ? 1920 : 1280 },
    height: { ideal: landscape ? 1080 : 720 }
  };
}

export function MaintenancePhotoScreen({ kind, title, onBack, onCapture, onSwitchCamera }: MaintenancePhotoScreenProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const defaultLaunchAttemptedRef = useRef(false);
  const orientationAngleRef = useRef(getViewportOrientationAngle());
  const lastDeviceOrientationAtRef = useRef(0);
  const iosDevice = isIosDevice();
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [cameraError, setCameraError] = useState("");
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startedByUser, setStartedByUser] = useState(false);
  const [flashSupported, setFlashSupported] = useState(false);
  const [flashOn, setFlashOn] = useState(false);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setReady(false);
    setFlashSupported(false);
    setFlashOn(false);
  };

  useEffect(() => () => stopStream(), []);

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
    if (!video || !ready || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError("Câmera ainda não está pronta. Toque em Abrir câmera ou use câmera nativa.");
      return;
    }

    const photoDataUrl = captureVideoFrameDataUrl(video, normalizeAngle(orientationAngleRef.current));
    if (photoDataUrl) onCapture(photoDataUrl);
  };

  const switchCamera = () => {
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
    const dataUrl = await readPhotoFileAsDataUrl(file, normalizeAngle(orientationAngleRef.current));
    onCapture(dataUrl);
    event.target.value = "";
  };

  useEffect(() => {
    if (defaultLaunchAttemptedRef.current) return;
    defaultLaunchAttemptedRef.current = true;

    if (iosDevice) {
      setCameraError("");
      return;
    }

    void startCamera("environment");
  }, [iosDevice]);

  return (
    <AppShell screenLabel="TelaFotoManutenção">
      <FormMenu title="" onBack={onBack} />
      <section className="main-panel photo-main">
        <article className="photo-card">
          <div className="photo-title">{title ?? getTitleByKind(kind)}</div>
          <div className="photo-body">
            <div className="camera-view real-camera-view">
              <video ref={videoRef} className="real-camera-video" playsInline muted autoPlay />

              {iosDevice ? (
                <button className="ios-native-camera-hit" type="button" onClick={openNativeCamera}>
                  <SystemIcon name="camera" />
                  <span>Tocar para tirar foto</span>
                </button>
              ) : !startedByUser && !starting ? (
                <div className="camera-start-panel">
                  <strong>Abra a câmera</strong>
                  <span>No iPhone, toque no botão para liberar o vídeo.</span>
                  <button onClick={() => startCamera()}>Abrir câmera</button>
                  <button className="native-camera-link" onClick={openNativeCamera}>Usar câmera nativa</button>
                </div>
              ) : null}

              {!iosDevice && cameraError ? (
                <div className="camera-error">
                  <strong>Câmera indisponível</strong>
                  <span>{cameraError}</span>
                  <small>No iPhone, prefira “Usar câmera nativa” se o vídeo travar.</small>
                  <button onClick={() => startCamera()}>Tentar novamente</button>
                  <button className="native-camera-link" onClick={openNativeCamera}>Usar câmera nativa</button>
                </div>
              ) : null}

              {!iosDevice && !cameraError && starting ? <div className="camera-loading">Abrindo câmera...</div> : null}
            </div>

            <input
              ref={fileInputRef}
              className="native-camera-input"
              type="file"
              accept="image/*"
              capture={facingMode === "environment" ? "environment" : "user"}
              onChange={handleNativeCapture}
            />

            {!iosDevice ? (
              <div className="photo-actions photo-actions-ios">
                <button
                  className={`photo-flash ${flashOn ? "is-active" : ""}`}
                  onClick={toggleFlash}
                  aria-label={flashOn ? "Desativar flash" : "Ativar flash"}
                  disabled={!ready || !flashSupported}
                >
                  <SystemIcon name="flash" />
                </button>
                <button className="photo-capture" onClick={capture} aria-label="Tirar foto" disabled={!ready}>
                  <SystemIcon name="camera" />
                </button>
                <button className="photo-switch" onClick={switchCamera} aria-label="Mudar câmera">
                  <SystemIcon name="sync" />
                </button>
              </div>
            ) : null}
          </div>
        </article>
      </section>
    </AppShell>
  );
}
