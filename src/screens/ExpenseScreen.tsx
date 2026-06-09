import { useRef, useState } from "react";
import { FlowSubmitButton, type FlowSubmitState } from "../components/common/FlowSubmitButton";
import { AppShell } from "../components/layout/AppShell";
import { FormMenu } from "../components/navigation/FormMenu";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
  expenseNeedsDescription,
  expenseNeedsKm,
  expenseNeedsLiters,
  expenseNeedsVehicle,
  normalizeExpenseFields,
  validateExpenseDraft,
  type ExpenseDraft,
  type ExpenseValidationErrors
} from "../lib/expenses";
import type { MaintenanceRequestVehicleOption } from "../lib/dataverse";

type ExpenseScreenProps = {
  draft: ExpenseDraft;
  onDraftChange: (draft: ExpenseDraft) => void;
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

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler arquivo."));
    reader.readAsDataURL(file);
  });
}

export function ExpenseScreen({
  draft,
  onDraftChange,
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
  const cityRef = useRef<HTMLInputElement | null>(null);
  const valueRef = useRef<HTMLInputElement | null>(null);
  const dateRef = useRef<HTMLInputElement | null>(null);
  const paymentRef = useRef<HTMLSelectElement | null>(null);
  const kmRef = useRef<HTMLInputElement | null>(null);
  const litersRef = useRef<HTMLInputElement | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const [errors, setErrors] = useState<ExpenseValidationErrors>({});
  const [fileError, setFileError] = useState("");

  const updateDraft = (updates: Partial<ExpenseDraft>) => onDraftChange({ ...draft, ...updates });
  const clearError = (key: keyof ExpenseValidationErrors) => {
    if (!errors[key]) return;
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = () => {
    if (isSubmitting) return;
    const nextErrors = validateExpenseDraft(draft);
    setErrors(nextErrors);
    if (nextErrors.categoria) return focusInvalidField(categoryRef.current);
    if (nextErrors.veiculoId) return focusInvalidField(vehicleRef.current);
    if (nextErrors.cidade) return focusInvalidField(cityRef.current);
    if (nextErrors.valor) return focusInvalidField(valueRef.current);
    if (nextErrors.dataGasto) return focusInvalidField(dateRef.current);
    if (nextErrors.formaPagamento) return focusInvalidField(paymentRef.current);
    if (nextErrors.kmInformado) return focusInvalidField(kmRef.current);
    if (nextErrors.litros) return focusInvalidField(litersRef.current);
    if (nextErrors.descricao) return focusInvalidField(descriptionRef.current);
    normalizeExpenseFields(draft);
    onSubmit(draft);
  };

  const errorCount = Object.values(errors).filter(Boolean).length;
  const hasCategory = Boolean(draft.categoria);
  const showVehicle = expenseNeedsVehicle(draft.categoria);
  const showKm = expenseNeedsKm(draft.categoria);
  const showLiters = expenseNeedsLiters(draft.categoria);
  const showDescriptionRequired = expenseNeedsDescription(draft.categoria);

  return (
    <AppShell screenLabel="TelaGastos">
      <FormMenu title="Registrar gasto" onBack={isSubmitting ? undefined : onBack} />
      <section className="main-panel maintenance-request-main">
        <article className="finalize-card maintenance-request-card">
          <div className="finalize-scroll">
            <div className="finalize-form maintenance maintenance-request-form expense-form">
              {errorCount ? <div className="form-error-summary">Revise {errorCount} campo(s) destacado(s).</div> : null}
              <div className={`finalize-input-block ${errors.categoria ? "is-invalid" : ""}`}>
                <label>Categoria</label>
                <select
                  ref={categoryRef}
                  aria-invalid={Boolean(errors.categoria)}
                  value={draft.categoria}
                  disabled={isSubmitting}
                  onChange={(event) => {
                    const categoria = event.target.value;
                    updateDraft({
                      categoria,
                      veiculoId: expenseNeedsVehicle(categoria) ? draft.veiculoId || currentVehicleId : "",
                      kmInformado: expenseNeedsKm(categoria) ? draft.kmInformado : "",
                      litros: expenseNeedsLiters(categoria) ? draft.litros : "",
                      descricao: expenseNeedsDescription(categoria) ? draft.descricao : draft.descricao
                    });
                    clearError("categoria");
                  }}
                >
                  <option value="" disabled>Selecione</option>
                  {EXPENSE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
                {errors.categoria ? <div className="field-error">{errors.categoria}</div> : null}
              </div>

              {hasCategory ? (
                <>
                  {showVehicle ? (
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
                        <option value="" disabled>{vehiclesLoading ? "Carregando veículos" : "Selecione"}</option>
                        {vehicles.map((vehicle) => (
                          <option key={vehicle.id} value={vehicle.id}>{vehicle.label}</option>
                        ))}
                      </select>
                      {errors.veiculoId ? <div className="field-error">{errors.veiculoId}</div> : null}
                    </div>
                  ) : null}

                  <div className={`finalize-input-block ${errors.cidade ? "is-invalid" : ""}`}>
                    <label>Cidade</label>
                    <input
                      ref={cityRef}
                      aria-invalid={Boolean(errors.cidade)}
                      placeholder="Ex.: São Paulo"
                      value={draft.cidade}
                      onChange={(event) => {
                        updateDraft({ cidade: event.target.value });
                        clearError("cidade");
                      }}
                    />
                    {errors.cidade ? <div className="field-error">{errors.cidade}</div> : null}
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

                  <div className={`finalize-input-block ${errors.formaPagamento ? "is-invalid" : ""}`}>
                    <label>Forma de pagamento</label>
                    <select
                      ref={paymentRef}
                      aria-invalid={Boolean(errors.formaPagamento)}
                      value={draft.formaPagamento}
                      disabled={isSubmitting}
                      onChange={(event) => {
                        updateDraft({ formaPagamento: event.target.value });
                        clearError("formaPagamento");
                      }}
                    >
                      <option value="" disabled>Selecione</option>
                      {EXPENSE_PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
                    </select>
                    {errors.formaPagamento ? <div className="field-error">{errors.formaPagamento}</div> : null}
                  </div>

                  {showKm ? (
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

                  {showLiters ? (
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

                  <div className={`finalize-input-block ${errors.descricao ? "is-invalid" : ""}`}>
                    <label>{showDescriptionRequired ? "Descrição" : "Descrição opcional"}</label>
                    <textarea
                      ref={descriptionRef}
                      aria-invalid={Boolean(errors.descricao)}
                      placeholder={showDescriptionRequired ? "Descreva o gasto" : "Opcional"}
                      rows={3}
                      value={draft.descricao}
                      onChange={(event) => {
                        updateDraft({ descricao: event.target.value });
                        clearError("descricao");
                      }}
                    />
                    {errors.descricao ? <div className="field-error">{errors.descricao}</div> : null}
                  </div>

                  <div className="finalize-input-block">
                    <label>Nota fiscal</label>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      disabled={isSubmitting}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) {
                          updateDraft({ notaFiscalDataUrl: "", notaFiscalFileName: "" });
                          return;
                        }
                        setFileError("");
                        readFileAsDataUrl(file)
                          .then((dataUrl) => updateDraft({ notaFiscalDataUrl: dataUrl, notaFiscalFileName: file.name }))
                          .catch(() => setFileError("Falha ao carregar nota fiscal."));
                      }}
                    />
                    {draft.notaFiscalFileName ? <div className="field-hint">{draft.notaFiscalFileName}</div> : null}
                    {fileError ? <div className="field-error">{fileError}</div> : null}
                  </div>

                  <div className="finalize-input-block">
                    <label>Observação</label>
                    <textarea
                      placeholder="Opcional"
                      rows={3}
                      value={draft.observacao}
                      onChange={(event) => updateDraft({ observacao: event.target.value })}
                    />
                  </div>

                </>
              ) : null}
            </div>
          </div>
          {hasCategory ? (
            <div className="finalize-actions maintenance-actions">
              <FlowSubmitButton className="finalize-primary" idleLabel="REGISTRAR" loadingLabel="REGISTRANDO" successLabel="REGISTRADO" state={submitState} onClick={submit} />
            </div>
          ) : null}
        </article>
      </section>
    </AppShell>
  );
}
