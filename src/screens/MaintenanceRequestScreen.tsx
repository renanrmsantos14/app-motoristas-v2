import { useEffect, useMemo, useRef, useState } from "react";
import { ActionBar, ActionButton, type ActionButtonState } from "../components/common/ActionButton";
import { FormField, SelectField, TextAreaField, TextInputField } from "../components/common/FormFields";
import { AppShell } from "../components/layout/AppShell";
import { FormMenu } from "../components/navigation/FormMenu";
import type { MaintenanceRequestVehicleOption } from "../lib/dataverse";

export type MaintenanceRequestFields = {
  descricao: string;
  kmAtual: number;
  veiculoId: string;
  gravidade: number;
};

export type MaintenanceRequestPhoto = {
  id: string;
  dataUrl: string;
  previewUrl?: string;
  posterUrl?: string;
  durationLabel?: string;
  mediaType?: "foto" | "video";
};

export type MaintenanceRequestDraft = {
  descricao: string;
  kmAtual: string;
  veiculoId: string;
  gravidade: string;
};

type MaintenanceRequestErrors = Partial<Record<"descricao" | "kmAtual" | "veiculoId" | "gravidade" | "photos", string>>;

type MaintenanceRequestScreenProps = {
  draft: MaintenanceRequestDraft;
  photos: MaintenanceRequestPhoto[];
  onDraftChange: (draft: MaintenanceRequestDraft) => void;
  onAddPhoto: () => void;
  onPreviewPhoto: (photoId: string) => void;
  onBack: () => void;
  onSubmit: (fields: MaintenanceRequestFields) => void;
  submitState: ActionButtonState;
  vehicles: MaintenanceRequestVehicleOption[];
  initialVehicleId?: string;
  vehiclesLoading?: boolean;
};

const severityOptions = [
  { value: 1, label: "Baixa" },
  { value: 2, label: "Media" },
  { value: 3, label: "Alta" },
  { value: 4, label: "Urgente" }
] as const;

function parseKm(value: string) {
  return Number(value.replace(/[^\d]/g, ""));
}

function focusInvalidField(element: HTMLElement | null) {
  element?.focus({ preventScroll: false });
  element?.scrollIntoView({ block: "center", behavior: "smooth" });
}

export function MaintenanceRequestScreen({
  draft,
  photos,
  onDraftChange,
  onAddPhoto,
  onPreviewPhoto,
  onBack,
  onSubmit,
  submitState,
  vehicles,
  initialVehicleId = "",
  vehiclesLoading = false
}: MaintenanceRequestScreenProps) {
  const isSubmitting = submitState !== "idle";
  const vehicleRef = useRef<HTMLButtonElement | null>(null);
  const kmRef = useRef<HTMLInputElement | null>(null);
  const severityRef = useRef<HTMLButtonElement | null>(null);
  const descricaoRef = useRef<HTMLTextAreaElement | null>(null);
  const photoRef = useRef<HTMLButtonElement | null>(null);
  const [errors, setErrors] = useState<MaintenanceRequestErrors>({});

  const vehicleOptions = useMemo(
    () => vehicles.map((vehicle) => ({
      value: vehicle.id,
      label: vehicle.isCurrent ? `${vehicle.label} - atual` : vehicle.label
    })),
    [vehicles]
  );
  const gravityOptions = useMemo(
    () => severityOptions.map((option) => ({ value: String(option.value), label: option.label })),
    []
  );

  useEffect(() => {
    if (initialVehicleId && !draft.veiculoId) onDraftChange({ ...draft, veiculoId: initialVehicleId });
  }, [draft, initialVehicleId, onDraftChange]);

  const updateDraft = (updates: Partial<MaintenanceRequestDraft>) => {
    onDraftChange({ ...draft, ...updates });
  };

  const clearError = (key: keyof MaintenanceRequestErrors) => {
    if (!errors[key]) return;
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = () => {
    if (isSubmitting) return;
    const parsedKm = parseKm(draft.kmAtual);
    const nextErrors: MaintenanceRequestErrors = {};

    if (!draft.veiculoId) nextErrors.veiculoId = "Selecione o veículo.";
    if (!Number.isFinite(parsedKm) || parsedKm <= 0) nextErrors.kmAtual = "Informe o km atual.";
    if (!draft.gravidade) nextErrors.gravidade = "Selecione a gravidade.";
    if (!draft.descricao.trim()) nextErrors.descricao = "Descreva o problema.";
    if (!photos.length) nextErrors.photos = "Adicione ao menos uma foto do pedido.";

    setErrors(nextErrors);
    if (nextErrors.veiculoId) return focusInvalidField(vehicleRef.current);
    if (nextErrors.kmAtual) return focusInvalidField(kmRef.current);
    if (nextErrors.gravidade) return focusInvalidField(severityRef.current);
    if (nextErrors.descricao) return focusInvalidField(descricaoRef.current);
    if (nextErrors.photos) return focusInvalidField(photoRef.current);

    onSubmit({
      descricao: draft.descricao,
      kmAtual: parsedKm,
      veiculoId: draft.veiculoId,
      gravidade: Number(draft.gravidade)
    });
  };

  const addPhoto = () => {
    clearError("photos");
    onAddPhoto();
  };

  const errorCount = Object.values(errors).filter(Boolean).length;
  const isVideo = (photo: MaintenanceRequestPhoto) => photo.mediaType === "video" || photo.dataUrl.startsWith("data:video/");

  return (
    <AppShell screenLabel="TelaSolicitarManutencao">
      <FormMenu title="Solicitar manutenção" onBack={isSubmitting ? undefined : onBack} />
      <section className="main-panel maintenance-request-main">
        <article className="finalize-card maintenance-request-card">
          <div className="finalize-scroll">
            <div className="finalize-form maintenance maintenance-request-form">
              {errorCount ? <div className="form-error-summary">Revise {errorCount} campo(s) destacado(s).</div> : null}

              <SelectField
                ref={vehicleRef}
                label="Veículo"
                error={errors.veiculoId}
                value={draft.veiculoId}
                options={vehicleOptions}
                placeholder={vehiclesLoading ? "Carregando veículos" : "Selecione"}
                ariaLabel="Selecionar veículo"
                disabled={vehiclesLoading || isSubmitting}
                onChange={(value) => {
                  updateDraft({ veiculoId: value });
                  clearError("veiculoId");
                }}
              />

              <TextInputField
                ref={kmRef}
                label="Km atual"
                error={errors.kmAtual}
                inputMode="numeric"
                placeholder="Ex.: 58230"
                value={draft.kmAtual}
                onChange={(event) => {
                  updateDraft({ kmAtual: event.target.value });
                  clearError("kmAtual");
                }}
              />

              <SelectField
                ref={severityRef}
                label="Gravidade"
                error={errors.gravidade}
                value={draft.gravidade}
                options={gravityOptions}
                placeholder="Selecione"
                ariaLabel="Selecionar gravidade"
                disabled={isSubmitting}
                onChange={(value) => {
                  updateDraft({ gravidade: value });
                  clearError("gravidade");
                }}
              />

              <TextAreaField
                ref={descricaoRef}
                label="Descrição"
                error={errors.descricao}
                placeholder="Ex.: barulho ao frear, luz acesa no painel, pneu vibrando"
                rows={5}
                value={draft.descricao}
                onChange={(event) => {
                  updateDraft({ descricao: event.target.value });
                  clearError("descricao");
                }}
              />

              <FormField label="Fotos" error={errors.photos}>
                <div className="maintenance-photo-grid">
                  {photos.map((photo, index) => (
                    <button
                      type="button"
                      className="maintenance-photo-thumb"
                      key={photo.id}
                      disabled={isSubmitting}
                      onClick={() => onPreviewPhoto(photo.id)}
                      aria-label={`Ver foto ${index + 1}`}
                    >
                      {isVideo(photo) ? (
                        <>
                          {photo.posterUrl ? <img src={photo.posterUrl} alt={`Vídeo ${index + 1}`} /> : <video src={photo.previewUrl || photo.dataUrl} muted playsInline preload="metadata" />}
                          <span className="media-video-badge">{photo.durationLabel || "Vídeo"}</span>
                        </>
                      ) : (
                        <img src={photo.dataUrl} alt={`Foto ${index + 1}`} />
                      )}
                    </button>
                  ))}
                  <button
                    type="button"
                    ref={photoRef}
                    className="maintenance-photo-add"
                    disabled={isSubmitting}
                    onClick={addPhoto}
                    aria-invalid={Boolean(errors.photos)}
                    aria-label="Adicionar foto"
                  >
                    <span>+</span>
                  </button>
                </div>
              </FormField>
            </div>
          </div>
          <ActionBar className="finalize-actions maintenance-actions">
            <ActionButton className="finalize-primary" variant="primary" idleLabel="ENVIAR" loadingLabel="ENVIANDO" successLabel="ENVIADO" state={submitState} onClick={submit} />
          </ActionBar>
        </article>
      </section>
    </AppShell>
  );
}
