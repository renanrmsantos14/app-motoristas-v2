import { useMemo, useRef, useState, type Ref } from "react";
import { AppShell } from "../components/layout/AppShell";
import { ActionBar, ActionButton, type ActionButtonState } from "../components/common/ActionButton";
import { TextAreaControl, TextInputControl, SelectControl } from "../components/common/FormFields";
import { FormMenu } from "../components/navigation/FormMenu";
import { VoucherInputRow } from "../components/voucher/VoucherInputRow";
import { VoucherSection } from "../components/voucher/VoucherSection";
import { reportAppError } from "../lib/appErrorLogger";
import { getVoucherValidationResult, type VoucherValidationField } from "../lib/localWorkflow";
import type { DetailData } from "../types";

type VoucherScreenProps = {
  detail: DetailData;
  hasSignature?: boolean;
  initialDraft?: Record<string, string>;
  onBack: () => void;
  onOpenSignature: () => void;
  onFinalize: (fields: Record<string, string>) => void;
  onDraftChange?: (fields: Record<string, string>) => void;
  submitState?: ActionButtonState;
};

type VoucherErrorKey = VoucherValidationField | "signature";
type VoucherErrors = Partial<Record<VoucherErrorKey, string>>;

const hours = ["", "00", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23"];
const minutes = ["", "00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

function focusField(ref: { current: HTMLElement | null }) {
  window.setTimeout(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    ref.current?.focus({ preventScroll: true });
  }, 40);
}

function TimeSelects({
  prefix,
  hour,
  minute,
  error,
  hourRef,
  minuteRef,
  onHourChange,
  onMinuteChange
}: {
  prefix: string;
  hour: string;
  minute: string;
  error?: string;
  hourRef?: Ref<HTMLButtonElement>;
  minuteRef?: Ref<HTMLButtonElement>;
  onHourChange: (value: string) => void;
  onMinuteChange: (value: string) => void;
}) {
  const hourOptions = useMemo(
    () => hours.map((item) => ({ value: item, label: item || "Hora" })),
    []
  );
  const minuteOptions = useMemo(
    () => minutes.map((item) => ({ value: item, label: item || "Min" })),
    []
  );

  return (
    <div className={`voucher-time ${error ? "is-invalid" : ""}`}>
      <SelectControl
        ref={hourRef}
        className="time-select-fixed"
        value={hour}
        options={hourOptions}
        placeholder="Hora"
        ariaLabel={`${prefix} hora`}
        invalid={Boolean(error)}
        searchPlaceholder="Hora"
        onChange={onHourChange}
      />
      <span>:</span>
      <SelectControl
        ref={minuteRef}
        className="time-select-fixed"
        value={minute}
        options={minuteOptions}
        placeholder="Min"
        ariaLabel={`${prefix} minuto`}
        invalid={Boolean(error)}
        searchPlaceholder="Min"
        onChange={onMinuteChange}
      />
    </div>
  );
}

function splitTime(value = "") {
  const [hour = "", minute = ""] = value.split(":");
  return { hour, minute };
}

function normalizeDeviationDraft(value: unknown) {
  const trimmed = String(value ?? "").trim();
  const normalized = trimmed.toLowerCase();
  if (!trimmed || normalized === "não" || normalized === "nao" || normalized === "false") return "";
  if (normalized === "sim" || normalized === "true") return "Sim";
  return trimmed;
}

function parseCurrencyInput(value = "") {
  const normalized = value
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();
  return Number(normalized || "0");
}

function isCurrencyFormatValid(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  const normalized = trimmed.replace(/^R\$\s*/i, "");
  return /^(\d+|\d{1,3}(\.\d{3})+)(,\d{0,2})?$/.test(normalized);
}

function isMoneyInputValid(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (!isCurrencyFormatValid(trimmed)) return false;
  const parsed = parseCurrencyInput(trimmed);
  return Number.isFinite(parsed) && parsed >= 0;
}

function readVoucherDraft(detail: DetailData, initialDraft?: Record<string, string>) {
  if (initialDraft) {
    const start = splitTime(initialDraft["Horário Inicial"] ?? initialDraft["Horario Inicial"]);
    const waitStart = splitTime(initialDraft["Espera Inicio"] ?? initialDraft["Espera Início"]);
    const waitEnd = splitTime(initialDraft["Espera Final"]);
    return {
      hora_saida: start.hour,
      min_saida: start.minute,
      espera_ini_hora: waitStart.hour,
      espera_ini_min: waitStart.minute,
      espera_fim_hora: waitEnd.hour,
      espera_fim_min: waitEnd.minute,
      desvio: normalizeDeviationDraft(initialDraft.Desvio),
      obs: initialDraft["Observação Voucher"] ?? initialDraft["Observacao Voucher"] ?? "",
      pedagio: initialDraft.Pedagio ?? initialDraft["Pedágio"] ?? "",
      estacionamento: initialDraft.Estacionamento ?? "",
      combustivel: initialDraft.Combustivel ?? initialDraft["Combustível"] ?? "",
      hospedagem: initialDraft.Hospedagem ?? "",
      outros: initialDraft.Outros ?? ""
    };
  }

  const raw = String(detail.dataverse?.record?.new_rascunhovoucher ?? "");
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return {
      ...parsed,
      desvio: normalizeDeviationDraft(parsed.desvio)
    };
  } catch (error) {
    reportAppError(error, {
      severity: "warning",
      source: "voucher",
      action: "parse-draft",
      component: "VoucherScreen",
      screen: "TelaVoucher",
      detailId: detail.id,
      payload: { raw }
    });
    return {};
  }
}

export function VoucherScreen({
  detail,
  hasSignature,
  initialDraft,
  onBack,
  onOpenSignature,
  onFinalize,
  onDraftChange,
  submitState = "idle"
}: VoucherScreenProps) {
  const isSubmitting = submitState !== "idle";
  const clientName = detail.fields.find((field) => field.label === "Cliente")?.value ?? "";
  const showSignature = /tenn?aris/i.test(clientName);
  const draftRef = useRef(readVoucherDraft(detail, initialDraft));
  const startHourRef = useRef<HTMLButtonElement | null>(null);
  const startMinuteRef = useRef<HTMLButtonElement | null>(null);
  const waitStartHourRef = useRef<HTMLButtonElement | null>(null);
  const waitStartMinuteRef = useRef<HTMLButtonElement | null>(null);
  const waitEndHourRef = useRef<HTMLButtonElement | null>(null);
  const waitEndMinuteRef = useRef<HTMLButtonElement | null>(null);
  const tollRef = useRef<HTMLInputElement | null>(null);
  const parkingRef = useRef<HTMLInputElement | null>(null);
  const fuelRef = useRef<HTMLInputElement | null>(null);
  const hotelRef = useRef<HTMLInputElement | null>(null);
  const othersRef = useRef<HTMLInputElement | null>(null);
  const signatureButtonRef = useRef<HTMLButtonElement | null>(null);
  const [startHour, setStartHour] = useState(() => draftRef.current.hora_saida ?? "");
  const [startMinute, setStartMinute] = useState(() => draftRef.current.min_saida ?? "");
  const [waitStartHour, setWaitStartHour] = useState(() => draftRef.current.espera_ini_hora ?? "");
  const [waitStartMinute, setWaitStartMinute] = useState(() => draftRef.current.espera_ini_min ?? "");
  const [waitEndHour, setWaitEndHour] = useState(() => draftRef.current.espera_fim_hora ?? "");
  const [waitEndMinute, setWaitEndMinute] = useState(() => draftRef.current.espera_fim_min ?? "");
  const [deviation, setDeviation] = useState(() => draftRef.current.desvio ?? "");
  const [obs, setObs] = useState(() => draftRef.current.obs ?? "");
  const [toll, setToll] = useState(() => draftRef.current.pedagio ?? "");
  const [parking, setParking] = useState(() => draftRef.current.estacionamento ?? "");
  const [fuel, setFuel] = useState(() => draftRef.current.combustivel ?? "");
  const [hotel, setHotel] = useState(() => draftRef.current.hospedagem ?? "");
  const [others, setOthers] = useState(() => draftRef.current.outros ?? "");
  const [errors, setErrors] = useState<VoucherErrors>({});

  const clearError = (key: VoucherErrorKey) => {
    if (!errors[key]) return;
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const setFieldError = (key: VoucherErrorKey, message: string) => {
    setErrors((current) => ({ ...current, [key]: message }));
  };

  const handleExpenseChange = (
    key: VoucherErrorKey,
    setter: (value: string) => void,
    draftLabel: "Pedágio" | "Estacionamento" | "Combustível" | "Hospedagem" | "Outros",
    value: string
  ) => {
    const trimmed = value.trim();
    const hasLetters = /[A-Za-z]/.test(value);
    const normalized = trimmed.replace(/^R\$\s*/i, "");
    const hasAmbiguousSeparators = /,.*,.*/.test(normalized) || /\.\d{1,2}\./.test(normalized) || /,\d{1,2},/.test(normalized);

    if (hasLetters) {
      setFieldError(key, "Use apenas números.");
      return;
    }

    if (trimmed && (hasAmbiguousSeparators || !isCurrencyFormatValid(trimmed))) {
      setFieldError(key, "Formato inválido. Use exemplo: 12,34");
      return;
    }

    setter(value);
    clearError(key);
    emitDraft({ [draftLabel]: value });
  };

  const clear = () => {
    setStartHour("");
    setStartMinute("");
    setWaitStartHour("");
    setWaitStartMinute("");
    setWaitEndHour("");
    setWaitEndMinute("");
    setDeviation("");
    setObs("");
    setToll("");
    setParking("");
    setFuel("");
    setHotel("");
    setOthers("");
    setErrors({});
    onDraftChange?.({});
  };

  const emitDraft = (updates: Partial<Record<string, string>>) => {
    const fields = {
      "Horário Inicial": startHour && startMinute ? `${startHour}:${startMinute}` : "",
      "Espera Início": waitStartHour && waitStartMinute ? `${waitStartHour}:${waitStartMinute}` : "",
      "Espera Final": waitEndHour && waitEndMinute ? `${waitEndHour}:${waitEndMinute}` : "",
      Desvio: deviation.trim(),
      "Observação Voucher": obs,
      Pedágio: toll,
      Estacionamento: parking,
      Combustível: fuel,
      Hospedagem: hotel,
      Outros: others,
      ...updates
    };
    onDraftChange?.(fields);
  };

  const finish = () => {
    if (isSubmitting) return;

    const startTime = startHour && startMinute ? `${startHour}:${startMinute}` : "";
    const waitStartTime = waitStartHour && waitStartMinute ? `${waitStartHour}:${waitStartMinute}` : "";
    const waitEndTime = waitEndHour && waitEndMinute ? `${waitEndHour}:${waitEndMinute}` : "";
    const trimmedDeviation = deviation.trim();
    const voucherFieldValues = {
      "Horário Inicial": startTime || "Não informado",
      "Espera Início": waitStartTime || "Não informado",
      "Espera Final": waitEndTime || "Não informado",
      Desvio: trimmedDeviation,
      "Observação Voucher": obs || "Sem observação.",
      Pedágio: toll || "R$ 0,00",
      Estacionamento: parking || "R$ 0,00",
      Combustível: fuel || "R$ 0,00",
      Hospedagem: hotel || "R$ 0,00",
      Outros: others || "R$ 0,00"
    };
    const nextErrors: VoucherErrors = { ...getVoucherValidationResult(voucherFieldValues, detail).fieldErrors };
    const hasPartialWaitStart = Boolean(waitStartHour) !== Boolean(waitStartMinute);
    const hasPartialWaitEnd = Boolean(waitEndHour) !== Boolean(waitEndMinute);

    if (hasPartialWaitStart) nextErrors.waitStart = "Preencha hora e minuto do início da espera.";
    if (hasPartialWaitEnd) nextErrors.waitEnd = "Preencha hora e minuto do final da espera.";

    if (showSignature && !hasSignature) nextErrors.signature = "Colete a assinatura do passageiro.";

    setErrors(nextErrors);

    if (nextErrors.startTime) {
      focusField(startHour ? startMinuteRef : startHourRef);
      return;
    }
    if (nextErrors.waitStart) {
      focusField(waitStartHour ? waitStartMinuteRef : waitStartHourRef);
      return;
    }
    if (nextErrors.waitEnd || nextErrors.waitRange) {
      focusField(waitEndHour ? waitEndMinuteRef : waitEndHourRef);
      return;
    }
    if (nextErrors.toll) {
      focusField(tollRef);
      return;
    }
    if (nextErrors.parking) {
      focusField(parkingRef);
      return;
    }
    if (nextErrors.fuel) {
      focusField(fuelRef);
      return;
    }
    if (nextErrors.hotel) {
      focusField(hotelRef);
      return;
    }
    if (nextErrors.others) {
      focusField(othersRef);
      return;
    }
    if (nextErrors.signature) {
      focusField(signatureButtonRef);
      return;
    }

    const fields = {
      ...voucherFieldValues,
      Assinatura: hasSignature ? "Assinatura registrada localmente." : "Sem assinatura."
    };

    onFinalize(fields);
  };

  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <AppShell screenLabel="TelaVoucher">
      <FormMenu title="Preencha as Informações" onBack={isSubmitting ? undefined : onBack} rightIcon="eraser" rightLabel="Limpar rascunho" onRightClick={isSubmitting ? undefined : clear} />
      <section className="main-panel voucher-main">
        <article className="voucher-card">
          <div className="voucher-title">Voucher - {detail.id}</div>
          <div className="voucher-scroll">
            <div className="voucher-form">
              {errorCount ? <div className="form-error-summary">Revise {errorCount} campo(s) destacado(s).</div> : null}

              <VoucherSection>
                <VoucherInputRow label="Horário Inicial" error={errors.startTime} required>
                  <TimeSelects
                    prefix="horario-inicial"
                    hour={startHour}
                    minute={startMinute}
                    error={errors.startTime}
                    hourRef={startHourRef}
                    minuteRef={startMinuteRef}
                    onHourChange={(value) => {
                      setStartHour(value);
                      clearError("startTime");
                      emitDraft({ "Horário Inicial": value && startMinute ? `${value}:${startMinute}` : "" });
                    }}
                    onMinuteChange={(value) => {
                      setStartMinute(value);
                      clearError("startTime");
                      emitDraft({ "Horário Inicial": startHour && value ? `${startHour}:${value}` : "" });
                    }}
                  />
                </VoucherInputRow>
              </VoucherSection>

              <VoucherSection title="Espera">
                <VoucherInputRow label="Início" error={errors.waitStart || errors.waitRange}>
                  <TimeSelects
                    prefix="espera-inicio"
                    hour={waitStartHour}
                    minute={waitStartMinute}
                    error={errors.waitStart || errors.waitRange}
                    hourRef={waitStartHourRef}
                    minuteRef={waitStartMinuteRef}
                    onHourChange={(value) => {
                      setWaitStartHour(value);
                      clearError("waitStart");
                      clearError("waitRange");
                      emitDraft({ "Espera Início": value && waitStartMinute ? `${value}:${waitStartMinute}` : "" });
                    }}
                    onMinuteChange={(value) => {
                      setWaitStartMinute(value);
                      clearError("waitStart");
                      clearError("waitRange");
                      emitDraft({ "Espera Início": waitStartHour && value ? `${waitStartHour}:${value}` : "" });
                    }}
                  />
                </VoucherInputRow>
                <VoucherInputRow label="Final" error={errors.waitEnd || errors.waitRange}>
                  <TimeSelects
                    prefix="espera-final"
                    hour={waitEndHour}
                    minute={waitEndMinute}
                    error={errors.waitEnd || errors.waitRange}
                    hourRef={waitEndHourRef}
                    minuteRef={waitEndMinuteRef}
                    onHourChange={(value) => {
                      setWaitEndHour(value);
                      clearError("waitEnd");
                      clearError("waitRange");
                      emitDraft({ "Espera Final": value && waitEndMinute ? `${value}:${waitEndMinute}` : "" });
                    }}
                    onMinuteChange={(value) => {
                      setWaitEndMinute(value);
                      clearError("waitEnd");
                      clearError("waitRange");
                      emitDraft({ "Espera Final": waitEndHour && value ? `${waitEndHour}:${value}` : "" });
                    }}
                  />
                </VoucherInputRow>
              </VoucherSection>

              <VoucherSection title="Informações Adicionais">
                <VoucherInputRow label="Desvio">
                  <TextAreaControl
                    rows={3}
                    placeholder="Descreva o desvio, se houve"
                    value={deviation}
                    onChange={(event) => {
                      setDeviation(event.target.value);
                      emitDraft({ Desvio: event.target.value });
                    }}
                  />
                </VoucherInputRow>
                <VoucherInputRow label="Observação">
                  <TextAreaControl
                    rows={3}
                    placeholder="Digite observação"
                    value={obs}
                    onChange={(event) => {
                      setObs(event.target.value);
                      emitDraft({ "Observação Voucher": event.target.value });
                    }}
                  />
                </VoucherInputRow>
              </VoucherSection>

              <VoucherSection title="Despesas">
                <VoucherInputRow label="Pedágio" error={errors.toll}>
                  <TextInputControl
                    ref={tollRef}
                    inputMode="decimal"
                    className={errors.toll ? "is-invalid" : ""}
                    placeholder="R$ 0,00"
                    value={toll}
                    onChange={(event) => handleExpenseChange("toll", setToll, "Pedágio", event.target.value)}
                  />
                </VoucherInputRow>
                <VoucherInputRow label="Estacionamento" error={errors.parking}>
                  <TextInputControl
                    ref={parkingRef}
                    inputMode="decimal"
                    className={errors.parking ? "is-invalid" : ""}
                    placeholder="R$ 0,00"
                    value={parking}
                    onChange={(event) => handleExpenseChange("parking", setParking, "Estacionamento", event.target.value)}
                  />
                </VoucherInputRow>
                <VoucherInputRow label="Combustível" error={errors.fuel}>
                  <TextInputControl
                    ref={fuelRef}
                    inputMode="decimal"
                    className={errors.fuel ? "is-invalid" : ""}
                    placeholder="R$ 0,00"
                    value={fuel}
                    onChange={(event) => handleExpenseChange("fuel", setFuel, "Combustível", event.target.value)}
                  />
                </VoucherInputRow>
                <VoucherInputRow label="Hospedagem" error={errors.hotel}>
                  <TextInputControl
                    ref={hotelRef}
                    inputMode="decimal"
                    className={errors.hotel ? "is-invalid" : ""}
                    placeholder="R$ 0,00"
                    value={hotel}
                    onChange={(event) => handleExpenseChange("hotel", setHotel, "Hospedagem", event.target.value)}
                  />
                </VoucherInputRow>
                <VoucherInputRow label="Outros" error={errors.others}>
                  <TextInputControl
                    ref={othersRef}
                    inputMode="decimal"
                    className={errors.others ? "is-invalid" : ""}
                    placeholder="R$ 0,00"
                    value={others}
                    onChange={(event) => handleExpenseChange("others", setOthers, "Outros", event.target.value)}
                  />
                </VoucherInputRow>
              </VoucherSection>
            </div>
          </div>
          <ActionBar className="voucher-actions">
            {showSignature ? (
              <ActionButton
                buttonRef={signatureButtonRef}
                className={`voucher-sign ${errors.signature ? "is-invalid" : ""}`}
                label={hasSignature ? "Refazer assinatura" : "Assinar"}
                disabled={isSubmitting}
                ariaInvalid={Boolean(errors.signature)}
                onClick={() => {
                  clearError("signature");
                  onOpenSignature();
                }}
              />
            ) : null}
            <ActionButton className="voucher-finish" variant="primary" idleLabel="FINALIZAR" loadingLabel="ENVIANDO" successLabel="ENVIADO" state={submitState} onClick={finish} />
          </ActionBar>
          {errors.signature ? <div className="field-error action-error">{errors.signature}</div> : null}
        </article>
      </section>
    </AppShell>
  );
}
