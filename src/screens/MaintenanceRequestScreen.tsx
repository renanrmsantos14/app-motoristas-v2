import { useEffect, useRef, useState } from "react";
import { FlowSubmitButton, type FlowSubmitState } from "../components/common/FlowSubmitButton";
import { AppShell } from "../components/layout/AppShell";
import { FormMenu } from "../components/navigation/FormMenu";
import type { MaintenanceRequestVehicleOption } from "../lib/dataverse";
import { readPhotoFileAsDataUrl } from "../lib/photoOrientation";

export type MaintenanceRequestFields = {
  descricao: string;
  kmAtual: number;
  veiculoId: string;
  gravidade: number;
};

export type MaintenanceRequestPhoto = {
  id: string;
  dataUrl: string;
};

export type MaintenanceRequestDraft = {
  descricao: string;
  kmAtual: string;
  veiculoId: string;
  gravidade: string;
};

type MaintenanceRequestErrors = Partial<Record<"descricao" | "kmAtual" | "veiculoId" | "gravidade", string>>;

type MaintenanceRequestScreenProps = {
  draft: MaintenanceRequestDraft;
  photos: MaintenanceRequestPhoto[];
  onDraftChange: (draft: MaintenanceRequestDraft) => void;
  onAddPhoto: () => void;
  onNativeAddPhoto: (photoDataUrl: string) => void;
  onPreviewPhoto: (photoId: string) => void;
  onBack: () => void;
  onSubmit: (fields: MaintenanceRequestFields) => void;
  submitState: FlowSubmitState;
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

function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";
  return /iPad|iPhone|iPod/i.test(userAgent) || (platform === "MacIntel" && navigator.maxTouchPoints > 1);
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
  onNativeAddPhoto,
  onPreviewPhoto,
  onBack,
  onSubmit,
  submitState,
  vehicles,
  initialVehicleId = "",
  vehiclesLoading = false
}: MaintenanceRequestScreenProps) {
  const isSubmitting = submitState !== "idle";
  const vehicleRef = useRef<HTMLSelectElement | null>(null);
  const kmRef = useRef<HTMLInputElement | null>(null);
  const severityRef = useRef<HTMLSelectElement | null>(null);
  const descricaoRef = useRef<HTMLTextAreaElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [errors, setErrors] = useState<MaintenanceRequestErrors>({});
  const iosDevice = isIosDevice();

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

    if (!draft.veiculoId) nextErrors.veiculoId = "Selecione o veiculo.";
    if (!Number.isFinite(parsedKm) || parsedKm <= 0) nextErrors.kmAtual = "Informe o km atual.";
    if (!draft.gravidade) nextErrors.gravidade = "Selecione a gravidade.";
    if (!draft.descricao.trim()) nextErrors.descricao = "Descreva o problema.";

    setErrors(nextErrors);
    if (nextErrors.veiculoId) return focusInvalidField(vehicleRef.current);
    if (nextErrors.kmAtual) return focusInvalidField(kmRef.current);
    if (nextErrors.gravidade) return focusInvalidField(severityRef.current);
    if (nextErrors.descricao) return focusInvalidField(descricaoRef.current);

    onSubmit({
      descricao: draft.descricao,
      kmAtual: parsedKm,
      veiculoId: draft.veiculoId,
      gravidade: Number(draft.gravidade)
    });
  };

  const addPhoto = () => {
    if (iosDevice) {
      photoInputRef.current?.click();
      return;
    }
    onAddPhoto();
  };

  const handleNativePhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await readPhotoFileAsDataUrl(file);
    onNativeAddPhoto(dataUrl);
    event.target.value = "";
  };

  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <AppShell screenLabel="TelaSolicitarManutencao">
      <FormMenu title="Solicitar manutenção" onBack={isSubmitting ? undefined : onBack} />
      <section className="main-panel maintenance-request-main">
        <article className="finalize-card maintenance-request-card">
          <div className="finalize-scroll">
            <div className="finalize-form maintenance maintenance-request-form">
              {errorCount ? <div className="form-error-summary">Revise {errorCount} campo(s) destacado(s).</div> : null}
              <div className={`finalize-input-block ${errors.veiculoId ? "is-invalid" : ""}`}>
                <label>Veículo</label>
                <select
                  ref={vehicleRef}
                  aria-invalid={Boolean(errors.veiculoId)}
                  value={draft.veiculoId}
                  disabled={vehiclesLoading || isSubmitting}
                  onChange={(event) => {
                    updateDraft({ veiculoId: event.target.value });
                    clearError("veiculoId");
                  }}
                >
                  <option value="" disabled>{vehiclesLoading ? "Carregando veiculos" : "Selecione"}</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>{vehicle.isCurrent ? `${vehicle.label} - atual` : vehicle.label}</option>
                  ))}
                </select>
                {errors.veiculoId ? <div className="field-error">{errors.veiculoId}</div> : null}
              </div>
              <div className={`finalize-input-block ${errors.kmAtual ? "is-invalid" : ""}`}>
                <label>Km atual</label>
                <input
                  ref={kmRef}
                  aria-invalid={Boolean(errors.kmAtual)}
                  inputMode="numeric"
                  placeholder="Ex.: 58230"
                  value={draft.kmAtual}
                  onChange={(event) => {
                    updateDraft({ kmAtual: event.target.value });
                    clearError("kmAtual");
                  }}
                />
                {errors.kmAtual ? <div className="field-error">{errors.kmAtual}</div> : null}
              </div>
              <div className={`finalize-input-block ${errors.gravidade ? "is-invalid" : ""}`}>
                <label>Gravidade</label>
                <select
                  ref={severityRef}
                  aria-invalid={Boolean(errors.gravidade)}
                  value={draft.gravidade}
                  disabled={isSubmitting}
                  onChange={(event) => {
                    updateDraft({ gravidade: event.target.value });
                    clearError("gravidade");
                  }}
                >
                  <option value="" disabled />
                  {severityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                {errors.gravidade ? <div className="field-error">{errors.gravidade}</div> : null}
              </div>
              <div className={`finalize-input-block ${errors.descricao ? "is-invalid" : ""}`}>
                <label>Descrição</label>
                <textarea
                  ref={descricaoRef}
                  aria-invalid={Boolean(errors.descricao)}
                  placeholder="Ex.: barulho ao frear, luz acesa no painel, pneu vibrando"
                  rows={5}
                  value={draft.descricao}
                  onChange={(event) => {
                    updateDraft({ descricao: event.target.value });
                    clearError("descricao");
                  }}
                />
                {errors.descricao ? <div className="field-error">{errors.descricao}</div> : null}
              </div>
              <div className="finalize-input-block">
                <label>Fotos</label>
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
                      <img src={photo.dataUrl} alt={`Foto ${index + 1}`} />
                    </button>
                  ))}
                  <button type="button" className="maintenance-photo-add" disabled={isSubmitting} onClick={addPhoto} aria-label="Adicionar foto">
                    <span>+</span>
                  </button>
                  <input
                    ref={photoInputRef}
                    className="native-camera-input"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleNativePhoto}
                  />
                </div>
              </div>
              <div className="finalize-actions maintenance-actions">
                <FlowSubmitButton className="finalize-primary" idleLabel="ENVIAR" loadingLabel="ENVIANDO" successLabel="ENVIADO" state={submitState} onClick={submit} />
              </div>
            </div>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
