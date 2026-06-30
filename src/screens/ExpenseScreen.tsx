import { useEffect, useMemo, useRef, useState } from "react";
import { ActionBar, ActionButton, type ActionButtonState } from "../components/common/ActionButton";
import { FormField, MoneyInputField, SelectField, TextAreaField, TextInputField } from "../components/common/FormFields";
import { PhotoAddButton } from "../components/common/PhotoAddButton";
import { AppShell } from "../components/layout/AppShell";
import { FormMenu } from "../components/navigation/FormMenu";
import {
  findExpenseCategory,
  getExpenseCategoryRules,
  matchesExpenseCitySearch,
  normalizeExpenseFields,
  validateExpenseDraft,
  type ExpenseDraft,
  type ExpensePhoto,
  type ExpenseReferenceData,
  type ExpenseValidationErrors
} from "../lib/expenses";
import type { MaintenanceRequestVehicleOption } from "../lib/dataverse";

type ExpenseScreenProps = {
  draft: ExpenseDraft;
  photos: ExpensePhoto[];
  referenceData: ExpenseReferenceData;
  referenceLoading: boolean;
  referenceError?: string;
  onDraftChange: (draft: ExpenseDraft) => void;
  onAddPhoto: () => void;
  onPreviewPhoto: (photoId: string) => void;
  onBack: () => void;
  onSubmit: (draft: ExpenseDraft) => void;
  submitState: ActionButtonState;
  vehicles: MaintenanceRequestVehicleOption[];
  vehiclesLoading: boolean;
  currentVehicleId: string;
};

function focusInvalidField(element: HTMLElement | null) {
  element?.focus({ preventScroll: false });
  element?.scrollIntoView({ block: "center", behavior: "smooth" });
}

export function ExpenseScreen({
  draft,
  photos,
  referenceData,
  referenceLoading,
  referenceError = "",
  onDraftChange,
  onAddPhoto,
  onPreviewPhoto,
  onBack,
  onSubmit,
  submitState,
  vehicles,
  vehiclesLoading,
  currentVehicleId
}: ExpenseScreenProps) {
  const isSubmitting = submitState !== "idle";
  const categoryRef = useRef<HTMLButtonElement | null>(null);
  const vehicleRef = useRef<HTMLButtonElement | null>(null);
  const valueRef = useRef<HTMLInputElement | null>(null);
  const dateRef = useRef<HTMLInputElement | null>(null);
  const paymentRef = useRef<HTMLButtonElement | null>(null);
  const cityRef = useRef<HTMLButtonElement | null>(null);
  const kmRef = useRef<HTMLInputElement | null>(null);
  const litersRef = useRef<HTMLInputElement | null>(null);
  const photosRef = useRef<HTMLDivElement | null>(null);
  const [errors, setErrors] = useState<ExpenseValidationErrors>({});

  const category = findExpenseCategory(referenceData, draft.categoriaId);
  const rules = getExpenseCategoryRules(category);
  const categoriesReady = referenceData.categories.length > 0;
  const paymentReady = referenceData.paymentMethods.length > 0;
  const citiesReady = referenceData.cities.length > 0;

  const categoryOptions = useMemo(
    () => referenceData.categories.map((item) => ({ value: item.id, label: item.name })),
    [referenceData.categories]
  );
  const paymentOptions = useMemo(
    () => referenceData.paymentMethods.map((item) => ({ value: item.id, label: item.name })),
    [referenceData.paymentMethods]
  );
  const cityOptions = useMemo(
    () => referenceData.cities.map((city) => ({
      value: city.id,
      label: city.name,
      subtitle: city.codigoIbge ? `${city.pais} · ${city.codigoIbge}` : city.pais,
      searchText: `${city.name} ${city.uf} ${city.pais} ${city.codigoIbge}`
    })),
    [referenceData.cities]
  );
  const cityById = useMemo(
    () => new Map(referenceData.cities.map((city) => [city.id, city])),
    [referenceData.cities]
  );
  const vehicleOptions = useMemo(
    () => vehicles.map((vehicle) => ({
      value: vehicle.id,
      label: vehicle.isCurrent ? `${vehicle.label} - atual` : vehicle.label
    })),
    [vehicles]
  );

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
    if (nextErrors.cidadeId) return focusInvalidField(cityRef.current);
    if (nextErrors.kmInformado) return focusInvalidField(kmRef.current);
    if (nextErrors.litros) return focusInvalidField(litersRef.current);
    if (nextErrors.photos) return focusInvalidField(photosRef.current);
    normalizeExpenseFields(draft, photos, referenceData);
    onSubmit(draft);
  };

  const addPhoto = () => {
    clearError("photos");
    onAddPhoto();
  };

  const errorCount = Object.values(errors).filter(Boolean).length;
  const isVideo = (photo: ExpensePhoto) => photo.mediaType === "video" || Boolean(photo.rawBlob) || photo.dataUrl.startsWith("data:video/");

  return (
    <AppShell screenLabel="TelaGastos">
      <FormMenu title="Registrar gasto" onBack={isSubmitting ? undefined : onBack} />
      <section className="main-panel maintenance-request-main">
        <article className="finalize-card maintenance-request-card">
          <div className="finalize-scroll">
            <div className="finalize-form maintenance maintenance-request-form expense-form">
              {referenceLoading ? <div className="form-error-summary">Carregando regras de despesa.</div> : null}
              {!referenceLoading && referenceError ? <div className="form-error-summary">{referenceError}</div> : null}
              {!referenceLoading && !referenceError && (!categoriesReady || !paymentReady || !citiesReady) ? (
                <div className="form-error-summary">Categorias, formas de pagamento ou cidades não encontradas no Dataverse.</div>
              ) : null}
              {errorCount ? <div className="form-error-summary">Revise {errorCount} campo(s) destacado(s).</div> : null}

              <TextInputField
                ref={dateRef}
                required
                label="Data do gasto"
                error={errors.dataGasto}
                type="date"
                value={draft.dataGasto}
                onChange={(event) => {
                  updateDraft({ dataGasto: event.target.value });
                  clearError("dataGasto");
                }}
              />

              <SelectField
                ref={categoryRef}
                required
                label="Categoria"
                error={errors.categoriaId}
                value={draft.categoriaId}
                options={categoryOptions}
                placeholder="Selecione"
                ariaLabel="Selecionar categoria"
                disabled={isSubmitting || referenceLoading}
                onChange={(value) => {
                  const nextCategory = findExpenseCategory(referenceData, value);
                  const nextRules = getExpenseCategoryRules(nextCategory);
                  updateDraft({
                    categoriaId: value,
                    veiculoId: nextRules.exigeVeiculo ? draft.veiculoId || currentVehicleId : "",
                    kmInformado: nextRules.exigeKm ? draft.kmInformado : "",
                    litros: nextRules.exigeLitros ? draft.litros : ""
                  });
                  clearError("categoriaId");
                }}
              />

              <MoneyInputField
                ref={valueRef}
                required
                label="Valor"
                error={errors.valor}
                inputMode="decimal"
                pattern="[0-9.,]*"
                autoComplete="off"
                value={draft.valor}
                onChange={(event) => {
                  updateDraft({ valor: event.target.value });
                  clearError("valor");
                }}
              />

              <SelectField
                ref={paymentRef}
                required
                label="Forma de pagamento"
                error={errors.formaPagamentoId}
                value={draft.formaPagamentoId}
                options={paymentOptions}
                placeholder="Selecione"
                ariaLabel="Selecionar forma de pagamento"
                disabled={isSubmitting || referenceLoading}
                onChange={(value) => {
                  updateDraft({ formaPagamentoId: value });
                  clearError("formaPagamentoId");
                }}
              />

              <SelectField
                ref={cityRef}
                required
                label="Cidade"
                error={errors.cidadeId}
                value={draft.cidadeId}
                options={cityOptions}
                placeholder="Digite cidade, UF ou IBGE"
                ariaLabel="Selecionar cidade"
                disabled={isSubmitting || referenceLoading}
                emptyLabel="Nenhuma cidade encontrada."
                maxVisible={50}
                filterOption={(option, normalizedQuery) => {
                  const city = cityById.get(option.value);
                  return city ? matchesExpenseCitySearch(city, normalizedQuery) : false;
                }}
                onChange={(value) => {
                  updateDraft({ cidadeId: value });
                  clearError("cidadeId");
                }}
              />

              {rules.exigeVeiculo ? (
                <SelectField
                  ref={vehicleRef}
                  required
                  label="Veículo"
                  error={errors.veiculoId}
                  value={draft.veiculoId}
                  options={vehicleOptions}
                  placeholder={vehiclesLoading ? "Carregando veículos" : "Selecione"}
                  ariaLabel="Selecionar veículo"
                  disabled={isSubmitting || vehiclesLoading}
                  onChange={(value) => {
                    updateDraft({ veiculoId: value });
                    clearError("veiculoId");
                  }}
                />
              ) : null}

              {rules.exigeKm ? (
                <TextInputField
                  ref={kmRef}
                  required
                  label="KM"
                  error={errors.kmInformado}
                  inputMode="numeric"
                  placeholder="Ex.: 58230"
                  value={draft.kmInformado}
                  onChange={(event) => {
                    updateDraft({ kmInformado: event.target.value });
                    clearError("kmInformado");
                  }}
                />
              ) : null}

              {rules.exigeLitros ? (
                <TextInputField
                  ref={litersRef}
                  required
                  label="Litros"
                  error={errors.litros}
                  inputMode="decimal"
                  placeholder="Ex.: 42,5"
                  value={draft.litros}
                  onChange={(event) => {
                    updateDraft({ litros: event.target.value });
                    clearError("litros");
                  }}
                />
              ) : null}

              <TextInputField
                label="Estabelecimento"
                placeholder="Ex.: Posto, estacionamento, hotel"
                value={draft.estabelecimento}
                onChange={(event) => updateDraft({ estabelecimento: event.target.value })}
              />

              <TextAreaField
                label="Descrição"
                placeholder="Opcional"
                rows={3}
                value={draft.descricao}
                onChange={(event) => updateDraft({ descricao: event.target.value })}
              />

              <FormField label="Comprovantes" error={errors.photos} required>
                <div ref={photosRef} tabIndex={-1}>
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
                </div>
              </FormField>
            </div>
          </div>
          <ActionBar className="finalize-actions maintenance-actions">
            <ActionButton
              className="finalize-primary"
              variant="primary"
              idleLabel="REGISTRAR"
              loadingLabel="REGISTRANDO"
              successLabel="REGISTRADO"
              state={submitState}
              onClick={submit}
            />
          </ActionBar>
        </article>
      </section>
    </AppShell>
  );
}
