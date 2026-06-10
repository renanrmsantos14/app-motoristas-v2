import { useEffect, useRef, useState } from "react";
import { FlowSubmitButton, type FlowSubmitState } from "../components/common/FlowSubmitButton";
import { AppShell } from "../components/layout/AppShell";
import { FormMenu } from "../components/navigation/FormMenu";
import {
  findExpenseCategory,
  getExpenseCategoryRules,
  normalizeExpenseFields,
  validateExpenseDraft,
  type ExpenseDraft,
  type ExpensePhoto,
  type ExpenseReferenceData,
  type ExpenseValidationErrors
} from "../lib/expenses";
import type { MaintenanceRequestVehicleOption } from "../lib/dataverse";
import { readPhotoFileAsDataUrl } from "../lib/photoOrientation";

type ExpenseScreenProps = {
  draft: ExpenseDraft;
  photos: ExpensePhoto[];
  referenceData: ExpenseReferenceData;
  referenceLoading: boolean;
  referenceError?: string;
  onDraftChange: (draft: ExpenseDraft) => void;
  onAddPhoto: () => void;
  onNativeAddPhoto: (photoDataUrl: string) => void;
  onPreviewPhoto: (photoId: string) => void;
  onBack: () => void;
  onSubmit: (draft: ExpenseDraft) => void;
  submitState: FlowSubmitState;
  vehicles: MaintenanceRequestVehicleOption[];
  vehiclesLoading: boolean;
  currentVehicleId: string;
};

function focusInvalidField(element: HTMLElement | null) {
  element?.focus({ preventScroll: false });
  element?.scrollIntoView({ block: "center", behavior: "smooth" });
}

function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";
  return /iPad|iPhone|iPod/i.test(userAgent) || (platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function ExpenseScreen({
  draft,
  photos,
  referenceData,
  referenceLoading,
  referenceError = "",
  onDraftChange,
  onAddPhoto,
  onNativeAddPhoto,
  onPreviewPhoto,
  onBack,
  onSubmit,
  submitState,
  vehicles,
  vehiclesLoading,
  currentVehicleId
}: ExpenseScreenProps) {
  const isSubmitting = submitState !== "idle";
  const categoryRef = useRef<HTMLSelectElement | null>(null);
  const vehicleRef = useRef<HTMLSelectElement | null>(null);
  const valueRef = useRef<HTMLInputElement | null>(null);
  const dateRef = useRef<HTMLInputElement | null>(null);
  const paymentRef = useRef<HTMLSelectElement | null>(null);
  const kmRef = useRef<HTMLInputElement | null>(null);
  const litersRef = useRef<HTMLInputElement | null>(null);
  const photosRef = useRef<HTMLDivElement | null>(null);
  const nativePhotoRef = useRef<HTMLInputElement | null>(null);
  const [errors, setErrors] = useState<ExpenseValidationErrors>({});
  const iosDevice = isIosDevice();

  const category = findExpenseCategory(referenceData, draft.categoriaId);
  const rules = getExpenseCategoryRules(category);
  const categoriesReady = referenceData.categories.length > 0;
  const paymentReady = referenceData.paymentMethods.length > 0;

  useEffect(() => {
    if (!currentVehicleId || draft.veiculoId) return;
    if (rules.exigeVeiculo) onDraftChange({ ...draft, veiculoId: currentVehicleId });
  }, [currentVehicleId, draft, onDraftChange, rules.exigeVeiculo]);

  const updateDraft = (updates: Partial<ExpenseDraft>) => onDraftChange({ ...draft, ...updates });
  const clearError = (key: keyof ExpenseValidationErrors) => {
    if (!errors[key]) return;
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = () => {
    if (isSubmitting) return;
    const nextErrors = validateExpenseDraft(draft, photos, referenceData);
    setErrors(nextErrors);
    if (nextErrors.categoriaId) return focusInvalidField(categoryRef.current);
    if (nextErrors.veiculoId) return focusInvalidField(vehicleRef.current);
    if (nextErrors.valor) return focusInvalidField(valueRef.current);
    if (nextErrors.dataGasto) return focusInvalidField(dateRef.current);
    if (nextErrors.formaPagamentoId) return focusInvalidField(paymentRef.current);
    if (nextErrors.kmInformado) return focusInvalidField(kmRef.current);
    if (nextErrors.litros) return focusInvalidField(litersRef.current);
    if (nextErrors.photos) return focusInvalidField(photosRef.current);
    normalizeExpenseFields(draft, photos, referenceData);
    onSubmit(draft);
  };

  const addPhoto = () => {
    if (iosDevice) {
      nativePhotoRef.current?.click();
      return;
    }
    clearError("photos");
    onAddPhoto();
  };

  const handleNativePhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await readPhotoFileAsDataUrl(file);
    clearError("photos");
    onNativeAddPhoto(dataUrl);
    event.target.value = "";
  };

  const errorCount = Object.values(errors).filter(Boolean).length;
  return (
    <AppShell screenLabel="TelaGastos">
      <FormMenu title="Registrar gasto" onBack={isSubmitting ? undefined : onBack} />
      <section className="main-panel maintenance-request-main">
        <article className="finalize-card maintenance-request-card">
          <div className="finalize-scroll">
            <div className="finalize-form maintenance maintenance-request-form expense-form">
              {referenceLoading ? <div className="form-error-summary">Carregando regras de despesa.</div> : null}
              {!referenceLoading && referenceError ? (
                <div className="form-error-summary">{referenceError}</div>
              ) : null}
              {!referenceLoading && !referenceError && (!categoriesReady || !paymentReady) ? (
                <div className="form-error-summary">Categorias ou formas de pagamento não encontradas no Dataverse.</div>
              ) : null}
              {errorCount ? <div className="form-error-summary">Revise {errorCount} campo(s) destacado(s).</div> : null}

              <div className={`finalize-input-block ${errors.categoriaId ? "is-invalid" : ""}`}>
                <label>Categoria</label>
                <select
                  ref={categoryRef}
                  aria-invalid={Boolean(errors.categoriaId)}
                  value={draft.categoriaId}
                  disabled={isSubmitting || referenceLoading}
                  onChange={(event) => {
                    const nextCategory = findExpenseCategory(referenceData, event.target.value);
                    const nextRules = getExpenseCategoryRules(nextCategory);
                    updateDraft({
                      categoriaId: event.target.value,
                      veiculoId: nextRules.exigeVeiculo ? draft.veiculoId || currentVehicleId : "",
                      kmInformado: nextRules.exigeKm ? draft.kmInformado : "",
                      litros: nextRules.exigeLitros ? draft.litros : ""
                    });
                    clearError("categoriaId");
                  }}
                >
                  <option value="" disabled>Selecione</option>
                  {referenceData.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                {errors.categoriaId ? <div className="field-error">{errors.categoriaId}</div> : null}
              </div>

              <div className={`finalize-input-block ${errors.valor ? "is-invalid" : ""}`}>
                <label>Valor</label>
                <input
                  ref={valueRef}
                  aria-invalid={Boolean(errors.valor)}
                  inputMode="decimal"
                  placeholder="Ex.: R$ 238,70"
                  value={draft.valor}
                  onChange={(event) => {
                    updateDraft({ valor: event.target.value });
                    clearError("valor");
                  }}
                />
                {errors.valor ? <div className="field-error">{errors.valor}</div> : null}
              </div>

              <div className={`finalize-input-block ${errors.dataGasto ? "is-invalid" : ""}`}>
                <label>Data do gasto</label>
                <input
                  ref={dateRef}
                  aria-invalid={Boolean(errors.dataGasto)}
                  type="date"
                  value={draft.dataGasto}
                  onChange={(event) => {
                    updateDraft({ dataGasto: event.target.value });
                    clearError("dataGasto");
                  }}
                />
                {errors.dataGasto ? <div className="field-error">{errors.dataGasto}</div> : null}
              </div>

              <div className={`finalize-input-block ${errors.formaPagamentoId ? "is-invalid" : ""}`}>
                <label>Forma de pagamento</label>
                <select
                  ref={paymentRef}
                  aria-invalid={Boolean(errors.formaPagamentoId)}
                  value={draft.formaPagamentoId}
                  disabled={isSubmitting || referenceLoading}
                  onChange={(event) => {
                    updateDraft({ formaPagamentoId: event.target.value });
                    clearError("formaPagamentoId");
                  }}
                >
                  <option value="" disabled>Selecione</option>
                  {referenceData.paymentMethods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                {errors.formaPagamentoId ? <div className="field-error">{errors.formaPagamentoId}</div> : null}
              </div>

              {rules.exigeVeiculo ? (
                <div className={`finalize-input-block ${errors.veiculoId ? "is-invalid" : ""}`}>
                  <label>Veículo</label>
                  <select
                    ref={vehicleRef}
                    aria-invalid={Boolean(errors.veiculoId)}
                    value={draft.veiculoId}
                    disabled={isSubmitting || vehiclesLoading}
                    onChange={(event) => {
                      updateDraft({ veiculoId: event.target.value });
                      clearError("veiculoId");
                    }}
                  >
                    <option value="">{vehiclesLoading ? "Carregando veículos" : "Selecione"}</option>
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>{vehicle.isCurrent ? `${vehicle.label} - atual` : vehicle.label}</option>
                    ))}
                  </select>
                  {errors.veiculoId ? <div className="field-error">{errors.veiculoId}</div> : null}
                </div>
              ) : null}

              {rules.exigeKm ? (
                <div className={`finalize-input-block ${errors.kmInformado ? "is-invalid" : ""}`}>
                  <label>KM</label>
                  <input
                    ref={kmRef}
                    aria-invalid={Boolean(errors.kmInformado)}
                    inputMode="numeric"
                    placeholder="Ex.: 58230"
                    value={draft.kmInformado}
                    onChange={(event) => {
                      updateDraft({ kmInformado: event.target.value });
                      clearError("kmInformado");
                    }}
                  />
                  {errors.kmInformado ? <div className="field-error">{errors.kmInformado}</div> : null}
                </div>
              ) : null}

              {rules.exigeLitros ? (
                <div className={`finalize-input-block ${errors.litros ? "is-invalid" : ""}`}>
                  <label>Litros</label>
                  <input
                    ref={litersRef}
                    aria-invalid={Boolean(errors.litros)}
                    inputMode="decimal"
                    placeholder="Ex.: 42,5"
                    value={draft.litros}
                    onChange={(event) => {
                      updateDraft({ litros: event.target.value });
                      clearError("litros");
                    }}
                  />
                  {errors.litros ? <div className="field-error">{errors.litros}</div> : null}
                </div>
              ) : null}

              <div className="finalize-input-block">
                <label>Estabelecimento</label>
                <input
                  placeholder="Ex.: Posto, estacionamento, hotel"
                  value={draft.estabelecimento}
                  onChange={(event) => updateDraft({ estabelecimento: event.target.value })}
                />
              </div>

              <div className="finalize-input-block">
                <label>Descrição opcional</label>
                <textarea
                  placeholder="Opcional"
                  rows={3}
                  value={draft.descricao}
                  onChange={(event) => {
                    updateDraft({ descricao: event.target.value });
                  }}
                />
              </div>

              <div ref={photosRef} className={`finalize-input-block ${errors.photos ? "is-invalid" : ""}`} tabIndex={-1}>
                <label>Comprovantes</label>
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
                      <img src={photo.dataUrl} alt={`Comprovante ${index + 1}`} />
                    </button>
                  ))}
                  <button type="button" className="maintenance-photo-add" disabled={isSubmitting} onClick={addPhoto} aria-label="Adicionar comprovante">
                    <span>+</span>
                  </button>
                  <input
                    ref={nativePhotoRef}
                    className="native-camera-input"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleNativePhoto}
                  />
                </div>
                <div className="field-hint">{photos.length} comprovante(s)</div>
                {errors.photos ? <div className="field-error">{errors.photos}</div> : null}
              </div>
            </div>
          </div>
          <div className="finalize-actions maintenance-actions">
            <FlowSubmitButton
              className="finalize-primary"
              idleLabel="REGISTRAR"
              loadingLabel="REGISTRANDO"
              successLabel="REGISTRADO"
              state={submitState}
              onClick={submit}
            />
          </div>
        </article>
      </section>
    </AppShell>
  );
}
