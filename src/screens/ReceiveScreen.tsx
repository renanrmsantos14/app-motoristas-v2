import { useRef, useState } from "react";
import invoiceReceiptIcon from "../assets/icons/invoice-receipt.svg";
import { ActionBar, ActionButton, type ActionButtonState } from "../components/common/ActionButton";
import { PhotoAddButton } from "../components/common/PhotoAddButton";
import { AppShell } from "../components/layout/AppShell";
import { FormMenu } from "../components/navigation/FormMenu";
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
  submitState?: ActionButtonState;
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
  const isVideo = (photo: ExpensePhoto) => photo.mediaType === "video" || Boolean(photo.rawBlob) || photo.dataUrl.startsWith("data:video/");

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
                <label className="form-field-label">
                  <span>Comprovante(s) de pagamento</span>
                  <span className="form-field-required" aria-hidden="true">*</span>
                </label>
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
                  <PhotoAddButton disabled={isSubmitting} onClick={addPhoto} ariaLabel="Adicionar comprovante" />
                </div>
                {photosError ? <div className="field-error">{photosError}</div> : null}
              </div>
            </div>
          </div>

          <ActionBar className={`finalize-actions receive-actions ${canGeneratePersonalReceipt ? "has-personal-receipt" : ""}`}>
            <ActionButton className="finalize-secondary receive-secondary" label="Voltar" disabled={isSubmitting} onClick={onBack} />
            {canGeneratePersonalReceipt ? (
              <ActionButton
                className="finalize-secondary receive-receipt"
                label="Abrir recibo personalizado"
                disabled={isSubmitting}
                onClick={generatePersonalReceipt}
                icon={<img src={invoiceReceiptIcon} alt="" />}
              />
            ) : null}
            <ActionButton className="finalize-primary receive-primary" variant="primary" idleLabel="FINALIZAR" loadingLabel="ENVIANDO" successLabel="ENVIADO" state={submitState} onClick={continueFlow} />
          </ActionBar>
        </article>
      </section>
    </AppShell>
  );
}
