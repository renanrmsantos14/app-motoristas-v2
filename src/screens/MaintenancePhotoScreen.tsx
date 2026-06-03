import { useEffect, useRef, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { FormMenu } from "../components/navigation/FormMenu";
import { SystemIcon } from "../components/icons/SystemIcon";
import type { MaintenancePhotoKind } from "../types";

type MaintenancePhotoScreenProps = {
  kind: MaintenancePhotoKind;
  onBack: () => void;
  onCapture: (photoDataUrl: string) => void;
  onSwitchCamera: () => void;
};

const titleByKind: Record<MaintenancePhotoKind, string> = {
  NOTAFISCAL: "Tire a foto da nota fiscal",
  FOTO1: "Tire a foto 1 de 3",
  FOTO2: "Tire a foto 2 de 3",
  FOTO3: "Tire a foto 3 de 3"
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function MaintenancePhotoScreen({ kind, onBack, onCapture, onSwitchCamera }: MaintenancePhotoScreenProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [cameraError, setCameraError] = useState("");
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startedByUser, setStartedByUser] = useState(false);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setReady(false);
  };

  useEffect(() => () => stopStream(), []);

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
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode },
          audio: false
        });
      }

      streamRef.current = stream;
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

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    onCapture(canvas.toDataURL("image/jpeg", 0.92));
  };

  const switchCamera = () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    onSwitchCamera();
    if (startedByUser) void startCamera(next);
  };

  const openNativeCamera = () => {
    fileInputRef.current?.click();
  };

  const handleNativeCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    onCapture(dataUrl);
    event.target.value = "";
  };

  return (
    <AppShell screenLabel="TelaFotoManutenção">
      <FormMenu title="" onBack={onBack} />
      <section className="main-panel photo-main">
        <article className="photo-card">
          <div className="photo-title">{titleByKind[kind]}</div>
          <div className="photo-body">
            <div className="camera-view real-camera-view">
              <video ref={videoRef} className="real-camera-video" playsInline muted autoPlay />

              {!startedByUser && !starting ? (
                <div className="camera-start-panel">
                  <strong>Abra a câmera</strong>
                  <span>No iPhone, toque no botão para liberar o vídeo.</span>
                  <button onClick={() => startCamera()}>Abrir câmera</button>
                  <button className="native-camera-link" onClick={openNativeCamera}>Usar câmera nativa</button>
                </div>
              ) : null}

              {cameraError ? (
                <div className="camera-error">
                  <strong>Câmera indisponível</strong>
                  <span>{cameraError}</span>
                  <small>No iPhone, prefira “Usar câmera nativa” se o vídeo travar.</small>
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
              accept="image/*"
              capture={facingMode === "environment" ? "environment" : "user"}
              onChange={handleNativeCapture}
            />

            <div className="photo-actions photo-actions-ios">
              <button className="photo-native" onClick={openNativeCamera}>Câmera nativa</button>
              <button className="photo-capture" onClick={capture} aria-label="Tirar foto" disabled={!ready}>
                <SystemIcon name="camera" />
              </button>
              <button className="photo-switch" onClick={switchCamera} aria-label="Mudar câmera">
                <SystemIcon name="sync" />
              </button>
            </div>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
