import { AppShell } from "../components/layout/AppShell";
import { FormMenu } from "../components/navigation/FormMenu";
import type { MaintenancePhotoKind } from "../types";

type MaintenancePhotoPreviewScreenProps = {
  kind: MaintenancePhotoKind;
  photoDataUrl?: string | null;
  onBack: () => void;
  onRetake: () => void;
  onConfirm: () => void;
};

const titleByKind: Record<MaintenancePhotoKind, string> = {
  NOTAFISCAL: "Foto da nota fiscal",
  FOTO1: "Foto 1 de 3",
  FOTO2: "Foto 2 de 3",
  FOTO3: "Foto 3 de 3"
};

export function MaintenancePhotoPreviewScreen({
  kind,
  photoDataUrl,
  onBack,
  onRetake,
  onConfirm
}: MaintenancePhotoPreviewScreenProps) {
  const isInvoice = kind === "NOTAFISCAL";

  return (
    <AppShell screenLabel="TelaPreviewFotoManutenção">
      <FormMenu title={titleByKind[kind]} onBack={onBack} />
      <section className="main-panel maintenance-preview-main">
        <article className="maintenance-preview-card">
          <div className="maintenance-preview-title">A foto está legível e ideal?</div>
          <div className="maintenance-preview-body">
            <div className={`maintenance-preview-image ${isInvoice ? "invoice" : "vehicle"}`} aria-label="Preview da foto">
              {photoDataUrl ? (
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
            <div className="maintenance-preview-actions">
              <button className="maintenance-preview-secondary" onClick={onRetake}>Não, refazer</button>
              <button className="maintenance-preview-primary" onClick={onConfirm}>Sim, Confirmar</button>
            </div>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
