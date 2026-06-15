import { useRef, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { FormMenu } from "../components/navigation/FormMenu";
import type { FlowSubmitState } from "../components/common/FlowSubmitButton";
import type { DetailData } from "../types";
import type { ExpensePhoto } from "../lib/expenses";

type ReceiveScreenProps = {
  detail: DetailData;
  photos: ExpensePhoto[];
  onAddPhoto: () => void;
  onPreviewPhoto: (photoId: string) => void;
  onBack: () => void;
  onContinue: () => void;
  onGeneratePersonalReceipt?: () => void;
  canGeneratePersonalReceipt?: boolean;
  submitState?: FlowSubmitState;
};

function focusInvalidField(element: HTMLElement | null) {
  element?.focus({ preventScroll: false });
  element?.scrollIntoView({ block: "center", behavior: "smooth" });
}

export function ReceiveScreen({
  detail,
  photos,
  onAddPhoto,
  onPreviewPhoto,
  onBack,
  onContinue,
  onGeneratePersonalReceipt,
  canGeneratePersonalReceipt = false,
  submitState = "idle"
}: ReceiveScreenProps) {
  const isSubmitting = submitState !== "idle";
  const photosRef = useRef<HTMLDivElement | null>(null);
  const [photosError, setPhotosError] = useState("");
  const isVideo = (photo: ExpensePhoto) => photo.mediaType === "video" || photo.dataUrl.startsWith("data:video/");

  const addPhoto = () => {
    setPhotosError("");
    onAddPhoto();
  };

  const continueFlow = () => {
    if (isSubmitting) return;
    if (photos.length === 0) {
      setPhotosError("Adicione ao menos um comprovante para continuar.");
      focusInvalidField(photosRef.current);
      return;
    }
    onContinue();
  };

  const generatePersonalReceipt = () => {
    if (isSubmitting) return;
    if (photos.length === 0) {
      setPhotosError("Adicione ao menos um comprovante para gerar o recibo.");
      focusInvalidField(photosRef.current);
      return;
    }
    onGeneratePersonalReceipt?.();
  };

  return (
    <AppShell screenLabel="TelaReceber">
      <FormMenu title="Enviar comprovante" onBack={isSubmitting ? undefined : onBack} />
      <section className="main-panel maintenance-request-main">
        <article className="finalize-card maintenance-request-card receive-card">
          <div className="finalize-title">Recebimento - {detail.id}</div>
          <div className="finalize-scroll">
            <div className="finalize-form maintenance maintenance-request-form expense-form receive-form">

              <div ref={photosRef} className={`finalize-input-block ${photosError ? "is-invalid" : ""}`} tabIndex={-1}>
                <label>Comprrovante(s) de pagamento</label>
                <div className="maintenance-photo-grid">
                  {photos.map((photo, index) => (
                    <button
                      type="button"
                      className="maintenance-photo-thumb"
                      key={photo.id}
                      disabled={isSubmitting}
                      onClick={() => onPreviewPhoto(photo.id)}
                      aria-label={`Ver comprovante ${index + 1}`}
                    >
                      {isVideo(photo) ? (
                        <>
                          {photo.posterUrl ? <img src={photo.posterUrl} alt={`Vídeo ${index + 1}`} /> : <video src={photo.previewUrl || photo.dataUrl} muted playsInline preload="metadata" />}
                          <span className="media-video-badge">{photo.durationLabel || "Vídeo"}</span>
                        </>
                      ) : (
                        <img src={photo.dataUrl} alt={`Comprovante ${index + 1}`} />
                      )}
                    </button>
                  ))}
                  <button type="button" className="maintenance-photo-add" disabled={isSubmitting} onClick={addPhoto} aria-label="Adicionar comprovante">
                    <span>+</span>
                  </button>
                </div>
                <div className="field-hint">{photos.length} comprovante(s)</div>
                {photosError ? <div className="field-error">{photosError}</div> : null}
              </div>
            </div>
          </div>

          <div className="receive-actions">
            <button type="button" className="finalize-secondary receive-secondary" disabled={isSubmitting} onClick={onBack}>Voltar</button>
            <button type="button" className="finalize-primary receive-primary" disabled={isSubmitting} onClick={continueFlow}>Finalizar serviço</button>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
