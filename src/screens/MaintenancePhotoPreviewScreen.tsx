import { useEffect, useState } from "react";
import { SystemIcon } from "../components/icons/SystemIcon";
import { AppShell } from "../components/layout/AppShell";
import { FormMenu } from "../components/navigation/FormMenu";
import { dataUrlToObjectUrl } from "../lib/photoOrientation";
import type { MaintenancePhotoKind } from "../types";

type MaintenancePhotoPreviewScreenProps = {
  kind: MaintenancePhotoKind;
  title?: string;
  prompt?: string;
  photoDataUrl?: string | null;
  onBack: () => void;
  onRetake: () => void;
  onConfirm: () => void;
  onDelete?: () => void;
  videoPreviewUrl?: string;
  confirmLabel?: string;
  deleteOnly?: boolean;
};

function getTitleByKind(kind: MaintenancePhotoKind) {
  if (kind.startsWith("NOTAFISCAL")) return "Foto da nota fiscal";
  if (kind === "FOTO1") return "Foto 1 de 3";
  if (kind === "FOTO2") return "Foto 2 de 3";
  return "Foto 3 de 3";
}

export function MaintenancePhotoPreviewScreen({
  kind,
  title,
  prompt,
  photoDataUrl,
  onBack,
  onRetake,
  onConfirm,
  onDelete,
  videoPreviewUrl: externalVideoPreviewUrl = "",
  confirmLabel = "Sim, Confirmar",
  deleteOnly = false
}: MaintenancePhotoPreviewScreenProps) {
  const isInvoice = kind.startsWith("NOTAFISCAL");
  const isVideo = Boolean(photoDataUrl?.startsWith("data:video/"));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState("");
  const [videoPreviewError, setVideoPreviewError] = useState(false);

  useEffect(() => {
    setVideoPreviewError(false);
    if (!isVideo || !photoDataUrl) {
      setVideoPreviewUrl("");
      return;
    }

    if (externalVideoPreviewUrl) {
      setVideoPreviewUrl(externalVideoPreviewUrl);
      return;
    }

    let objectUrl = "";
    try {
      objectUrl = dataUrlToObjectUrl(photoDataUrl);
    } catch {
      setVideoPreviewError(true);
      setVideoPreviewUrl("");
      return;
    }
    setVideoPreviewUrl(objectUrl);
    return () => {
      if (objectUrl.startsWith("blob:")) URL.revokeObjectURL(objectUrl);
    };
  }, [externalVideoPreviewUrl, isVideo, photoDataUrl]);

  const requestDelete = () => {
    if (!onDelete) return;
    setConfirmDelete(true);
  };

  const confirmDeletePhoto = () => {
    setConfirmDelete(false);
    onDelete?.();
  };

  return (
    <AppShell screenLabel="TelaPreviewFotoManutencao">
      <FormMenu title={title ?? getTitleByKind(kind)} onBack={onBack} />
      <section className="main-panel maintenance-preview-main">
        <article className={`maintenance-preview-card ${deleteOnly ? "is-delete-only" : ""}`}>
          {deleteOnly ? null : <div className="maintenance-preview-title">{prompt ?? "A foto está legível e ideal?"}</div>}
          <div className="maintenance-preview-body">
            <div className={`maintenance-preview-image ${isInvoice ? "invoice" : "vehicle"}`} aria-label="Preview da foto">
              {isVideo && photoDataUrl ? (
                <>
                  {videoPreviewUrl ? (
                    <video key={videoPreviewUrl} className="maintenance-preview-real-image" src={videoPreviewUrl} controls playsInline preload="auto" muted onCanPlay={() => setVideoPreviewError(false)} onLoadedMetadata={() => setVideoPreviewError(false)} onError={() => setVideoPreviewError(true)} />
                  ) : (
                    <div className="camera-loading">Preparando previa...</div>
                  )}
                  {videoPreviewError ? (
                    <div className="video-preview-fallback">
                      <strong>Vídeo anexado</strong>
                      <span>Prévia indisponível neste navegador. Pode confirmar e enviar.</span>
                    </div>
                  ) : null}
                </>
              ) : photoDataUrl ? (
                <img className="maintenance-preview-real-image" src={photoDataUrl} alt="Foto capturada" />
              ) : isInvoice ? (
                <div className="mock-invoice">
                  <div />
                  <span />
                  <span />
                  <span />
                  <strong>R$ 480,00</strong>
                </div>
              ) : (
                <div className="mock-maintenance-photo">
                  <span />
                  <strong>MANUTENÇÃO</strong>
                </div>
              )}
            </div>
            <div className={`maintenance-preview-actions ${deleteOnly ? "is-delete-only" : ""}`}>
              {deleteOnly && onDelete ? (
                <button className="maintenance-preview-delete" onClick={requestDelete} type="button">
                  <SystemIcon name="trash" />
                  <span>Apagar foto</span>
                </button>
              ) : (
                <>
                  {onDelete ? <button className="maintenance-preview-secondary" onClick={requestDelete} type="button">Apagar foto</button> : null}
                  <button className="maintenance-preview-secondary" onClick={onRetake} type="button">Não, refazer</button>
                  <button className="maintenance-preview-primary" onClick={onConfirm} type="button">{confirmLabel}</button>
                </>
              )}
            </div>
          </div>
        </article>
      </section>
      {confirmDelete ? (
        <div className="maintenance-delete-overlay" role="dialog" aria-modal="true" aria-labelledby="maintenance-delete-title">
          <div className="maintenance-delete-dialog">
            <div className="maintenance-delete-icon" aria-hidden="true">
              <SystemIcon name="trash" />
            </div>
            <div id="maintenance-delete-title" className="maintenance-delete-title">Apagar foto?</div>
            <p>Esta foto será removida da solicitação.</p>
            <div className="maintenance-delete-actions">
              <button className="maintenance-delete-cancel" onClick={() => setConfirmDelete(false)} type="button">Cancelar</button>
              <button className="maintenance-delete-confirm" onClick={confirmDeletePhoto} type="button">
                <SystemIcon name="trash" />
                <span>Apagar</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
