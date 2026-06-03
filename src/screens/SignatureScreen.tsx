import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SystemIcon } from "../components/icons/SystemIcon";
import { AppShell } from "../components/layout/AppShell";
import { FormMenu } from "../components/navigation/FormMenu";
import type { DetailData } from "../types";

type SignatureScreenProps = {
  detail: DetailData;
  onBack: () => void;
  onConfirm: (signatureDataUrl: string | null) => void;
};

type Point = {
  x: number;
  y: number;
};

export function SignatureScreen({ onBack, onConfirm }: SignatureScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const padWrapRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef(false);
  const movedRef = useRef(false);
  const signedRef = useRef(false);
  const lastPointRef = useRef<Point>({ x: 0, y: 0 });
  const startPointRef = useRef<Point>({ x: 0, y: 0 });
  const imageSnapshotRef = useRef<string | null>(null);
  const [signed, setSigned] = useState(false);
  const [wideMode, setWideMode] = useState(false);
  const [signatureError, setSignatureError] = useState("");

  const prepareCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (signedRef.current) {
      imageSnapshotRef.current = canvas.toDataURL("image/png");
    }

    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));

    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#000000";
    context.fillStyle = "#000000";

    const snapshot = imageSnapshotRef.current;
    if (snapshot) {
      const image = new Image();
      image.onload = () => context.drawImage(image, 0, 0, rect.width, rect.height);
      image.src = snapshot;
    }
  };

  useLayoutEffect(() => {
    prepareCanvas();
  }, [wideMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver(prepareCanvas);
    observer.observe(canvas);
    window.addEventListener("resize", prepareCanvas);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", prepareCanvas);
    };
  }, []);

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const point = getPoint(event);
    drawingRef.current = true;
    movedRef.current = false;
    startPointRef.current = point;
    lastPointRef.current = point;
    canvas.setPointerCapture(event.pointerId);
    context.beginPath();
    context.moveTo(point.x, point.y);
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;

    const point = getPoint(event);
    const distanceFromStart = Math.hypot(point.x - startPointRef.current.x, point.y - startPointRef.current.y);
    if (distanceFromStart > 1.5) movedRef.current = true;

    context.beginPath();
    context.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    context.lineTo(point.x, point.y);
    context.stroke();

    lastPointRef.current = point;
    signedRef.current = true;
    imageSnapshotRef.current = null;
    setSignatureError("");
    setSigned(true);
  };

  const finishDrawing = (event?: React.PointerEvent<HTMLCanvasElement>) => {
    const context = canvasRef.current?.getContext("2d");
    if (drawingRef.current && context && !movedRef.current) {
      const point = event ? getPoint(event) : startPointRef.current;
      context.beginPath();
      context.arc(point.x, point.y, 2.1, 0, Math.PI * 2);
      context.fill();
      signedRef.current = true;
      imageSnapshotRef.current = null;
      setSignatureError("");
      setSigned(true);
    }
    drawingRef.current = false;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.restore();
    signedRef.current = false;
    imageSnapshotRef.current = null;
    setSigned(false);
    setSignatureError("");
  };

  const confirmSignature = () => {
    if (!signedRef.current) {
      setSignatureError("Assine antes de confirmar.");
      window.setTimeout(() => {
        padWrapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        canvasRef.current?.focus({ preventScroll: true });
      }, 40);
      return;
    }
    onConfirm(signedRef.current ? canvasRef.current?.toDataURL("image/png") ?? null : null);
  };

  const toggleWideMode = async () => {
    const next = !wideMode;
    setWideMode(next);

    try {
      const orientation = screen.orientation as (ScreenOrientation & {
        lock?: (orientation: OrientationLockType) => Promise<void>;
        unlock?: () => void;
      }) | undefined;

      if (next) {
        await document.documentElement.requestFullscreen?.();
        await orientation?.lock?.("landscape");
      } else {
        orientation?.unlock?.();
        if (document.fullscreenElement) await document.exitFullscreen?.();
      }
    } catch {
      // Fallback visual interno quando o navegador bloqueia rotação.
    }
  };

  return (
    <AppShell screenLabel="TelaAssinaturaPassageiro">
      <FormMenu title="Assinatura do Passageiro" onBack={onBack} />
      <section className={`main-panel signature-main ${wideMode ? "signature-wide" : ""}`}>
        <article className="signature-card">
          <header className="signature-top">
            <div className="signature-title">
              <span>Assinatura</span>
              <small>{"Faça a assinatura no espaço em branco."}</small>
            </div>
            <button className="signature-icon-action" aria-label="Apagar assinatura" onClick={clearSignature} type="button">
              <SystemIcon name="eraser" />
            </button>
          </header>

          <div className="signature-body">
            <div ref={padWrapRef} className={`signature-pad-wrap ${signatureError ? "is-invalid" : ""}`}>
              <canvas
                ref={canvasRef}
                className={`signature-pad ${signed ? "signed" : ""}`}
                aria-invalid={Boolean(signatureError)}
                tabIndex={0}
                aria-label="Área de assinatura"
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={finishDrawing}
                onPointerCancel={finishDrawing}
                onPointerLeave={finishDrawing}
              />
              {signatureError ? <div className="signature-error">{signatureError}</div> : null}
            </div>

            <div className="signature-actions">
              <div className="signature-status">{signed ? "Assinatura capturada" : "Aguardando assinatura"}</div>
              <button className="signature-confirm" onClick={confirmSignature} type="button">
                Confirmar
              </button>
              <button className="signature-rotate" aria-label="Virar tela" onClick={toggleWideMode} type="button">
                <SystemIcon name="rotate" />
              </button>
            </div>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
