import { useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { SignaturePoint, SignatureStrokes } from "../../lib/comunicados";

type Props = { value: SignatureStrokes; onChange: (value: SignatureStrokes) => void };

export function SignatureDrawing({ value }: { value: SignatureStrokes }) {
  return (
    <svg viewBox="0 0 1000 400" preserveAspectRatio="xMidYMid meet" aria-label="Assinatura registrada" role="img">
      {value.map((stroke, index) => (
        <polyline
          key={index}
          points={stroke.map(([x, y]) => `${Math.round(x * 1000)},${Math.round(y * 400)}`).join(" ")}
          pathLength={1}
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

export function SignaturePad({ value, onChange }: Props) {
  const padRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef(false);
  const [activeStroke, setActiveStroke] = useState<SignaturePoint[]>([]);

  const pointFromEvent = (event: PointerEvent<HTMLDivElement>): SignaturePoint => {
    const rect = padRef.current!.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
    ];
  };

  const finish = (event: PointerEvent<HTMLDivElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    padRef.current?.releasePointerCapture(event.pointerId);
    if (activeStroke.length > 1) onChange([...value, activeStroke]);
    setActiveStroke([]);
  };

  return (
    <div className="comunicado-signature">
      <div
        ref={padRef}
        className="comunicado-signature-pad"
        role="img"
        aria-label="Área para desenhar sua assinatura"
        onPointerDown={(event) => {
          event.preventDefault();
          drawingRef.current = true;
          padRef.current?.setPointerCapture(event.pointerId);
          setActiveStroke([pointFromEvent(event)]);
        }}
        onPointerMove={(event) => {
          if (!drawingRef.current) return;
          event.preventDefault();
          const point = pointFromEvent(event);
          setActiveStroke((current) => current.length < 4000 ? [...current, point] : current);
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
      >
        <SignatureDrawing value={activeStroke.length ? [...value, activeStroke] : value} />
      </div>
      <button type="button" className="comunicado-text-button" onClick={() => { onChange([]); setActiveStroke([]); }}>
        Limpar assinatura
      </button>
    </div>
  );
}
