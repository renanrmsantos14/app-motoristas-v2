import { useRef, useState } from "react";
import type { Ref, RefObject } from "react";
import { AppShell } from "../components/layout/AppShell";
import { FlowSubmitButton, type FlowSubmitState } from "../components/common/FlowSubmitButton";
import { FormMenu } from "../components/navigation/FormMenu";
import { VoucherInputRow } from "../components/voucher/VoucherInputRow";
import { VoucherSection } from "../components/voucher/VoucherSection";
import type { DetailData } from "../types";

type VoucherScreenProps = {
  detail: DetailData;
  hasSignature?: boolean;
  initialDraft?: Record<string, string>;
  onBack: () => void;
  onOpenSignature: () => void;
  onFinalize: (fields: Record<string, string>) => void;
  onDraftChange?: (fields: Record<string, string>) => void;
  submitState?: FlowSubmitState;
};

type VoucherErrorKey = "startTime" | "signature";
type VoucherErrors = Partial<Record<VoucherErrorKey, string>>;

const hours = ["", "00", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23"];
const minutes = ["", "00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

function focusField(ref: RefObject<HTMLElement | null>) {
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
  hourRef?: RefObject<HTMLSelectElement | null>;
  minuteRef?: RefObject<HTMLSelectElement | null>;
  onHourChange: (value: string) => void;
  onMinuteChange: (value: string) => void;
}) {
  return (
    <div className={`voucher-time ${error ? "is-invalid" : ""}`}>
      <select ref={hourRef as Ref<HTMLSelectElement>} aria-label={`${prefix} hora`} aria-invalid={Boolean(error)} value={hour} onChange={(event) => onHourChange(event.target.value)}>
        {hours.map((item) => <option key={`${prefix}-h-${item || "empty"}`} value={item}>{item || "Hora"}</option>)}
      </select>
      <span>:</span>
      <select ref={minuteRef as Ref<HTMLSelectElement>} aria-label={`${prefix} minuto`} aria-invalid={Boolean(error)} value={minute} onChange={(event) => onMinuteChange(event.target.value)}>
        {minutes.map((item) => <option key={`${prefix}-m-${item || "empty"}`} value={item}>{item || "Min"}</option>)}
      </select>
    </div>
  );
}

function splitTime(value = "") {
  const [hour = "", minute = ""] = value.split(":");
  return { hour, minute };
}

function readVoucherDraft(detail: DetailData, initialDraft?: Record<string, string>) {
  if (initialDraft) {
    const start = splitTime(initialDraft["Horário Inicial"] ?? initialDraft["Horario Inicial"]);
    const waitStart = splitTime(initialDraft["Espera Inicio"]);
    const waitEnd = splitTime(initialDraft["Espera Final"]);
    return {
      hora_saida: start.hour,
      min_saida: start.minute,
      espera_ini_hora: waitStart.hour,
      espera_ini_min: waitStart.minute,
      espera_fim_hora: waitEnd.hour,
      espera_fim_min: waitEnd.minute,
      desvio: initialDraft.Desvio ?? "Não",
      obs: initialDraft["Observação Voucher"] ?? initialDraft["Observacao Voucher"] ?? "",
      pedagio: initialDraft.Pedagio ?? "",
      estacionamento: initialDraft.Estacionamento ?? "",
      combustivel: initialDraft.Combustivel ?? "",
      hospedagem: initialDraft.Hospedagem ?? "",
      outros: initialDraft.Outros ?? ""
    };
  }

  const raw = String(detail.dataverse?.record?.new_rascunhovoucher ?? "");
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

export function VoucherScreen({ detail, hasSignature, initialDraft, onBack, onOpenSignature, onFinalize, onDraftChange, submitState = "idle" }: VoucherScreenProps) {
  const isSubmitting = submitState !== "idle";
  const clientName = detail.fields.find((field) => field.label === "Cliente")?.value ?? "";
  const showSignature = /tenn?aris/i.test(clientName);
  const draftRef = useRef(readVoucherDraft(detail, initialDraft));
  const startHourRef = useRef<HTMLSelectElement | null>(null);
  const startMinuteRef = useRef<HTMLSelectElement | null>(null);
  const signatureButtonRef = useRef<HTMLButtonElement | null>(null);
  const [startHour, setStartHour] = useState(() => draftRef.current.hora_saida ?? "");
  const [startMinute, setStartMinute] = useState(() => draftRef.current.min_saida ?? "");
  const [waitStartHour, setWaitStartHour] = useState(() => draftRef.current.espera_ini_hora ?? "");
  const [waitStartMinute, setWaitStartMinute] = useState(() => draftRef.current.espera_ini_min ?? "");
  const [waitEndHour, setWaitEndHour] = useState(() => draftRef.current.espera_fim_hora ?? "");
  const [waitEndMinute, setWaitEndMinute] = useState(() => draftRef.current.espera_fim_min ?? "");
  const [deviation, setDeviation] = useState(() => draftRef.current.desvio === "Sim" || draftRef.current.desvio === "true");
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

  const clear = () => {
    setStartHour(""); setStartMinute(""); setWaitStartHour(""); setWaitStartMinute(""); setWaitEndHour(""); setWaitEndMinute("");
    setDeviation(false); setObs(""); setToll(""); setParking(""); setFuel(""); setHotel(""); setOthers("");
    setErrors({});
    onDraftChange?.({});
  };

  const emitDraft = (updates: Partial<Record<string, string>>) => {
    const fields = {
      "Horário Inicial": startHour && startMinute ? `${startHour}:${startMinute}` : "",
      "Espera Início": waitStartHour && waitStartMinute ? `${waitStartHour}:${waitStartMinute}` : "",
      "Espera Final": waitEndHour && waitEndMinute ? `${waitEndHour}:${waitEndMinute}` : "",
      "Desvio": deviation ? "Sim" : "Não",
      "Observação Voucher": obs,
      "Pedágio": toll,
      "Estacionamento": parking,
      "Combustível": fuel,
      "Hospedagem": hotel,
      "Outros": others,
      ...updates
    };
    onDraftChange?.(fields);
  };

  const finish = () => {
    if (isSubmitting) return;
    const fields = {
      "Horário Inicial": startHour && startMinute ? `${startHour}:${startMinute}` : "Não informado",
      "Espera Início": waitStartHour && waitStartMinute ? `${waitStartHour}:${waitStartMinute}` : "Não informado",
      "Espera Final": waitEndHour && waitEndMinute ? `${waitEndHour}:${waitEndMinute}` : "Não informado",
      "Desvio": deviation ? "Sim" : "Não",
      "Observação Voucher": obs || "Sem observação.",
      "Pedágio": toll || "R$ 0,00",
      "Estacionamento": parking || "R$ 0,00",
      "Combustível": fuel || "R$ 0,00",
      "Hospedagem": hotel || "R$ 0,00",
      "Outros": others || "R$ 0,00",
      "Assinatura": hasSignature ? "Assinatura registrada localmente." : "Sem assinatura."
    };

    const nextErrors: VoucherErrors = {};
    if (!startHour || !startMinute) nextErrors.startTime = "Informe hora e minuto inicial.";
    if (showSignature && !hasSignature) nextErrors.signature = "Colete a assinatura do passageiro.";

    setErrors(nextErrors);

    if (nextErrors.startTime) {
      focusField(startHour ? startMinuteRef : startHourRef);
      return;
    }
    if (nextErrors.signature) {
      focusField(signatureButtonRef);
      return;
    }

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
                <VoucherInputRow label="Horário Inicial" error={errors.startTime}>
                  <TimeSelects
                    prefix="horario-inicial"
                    hour={startHour}
                    minute={startMinute}
                    error={errors.startTime}
                    hourRef={startHourRef}
                    minuteRef={startMinuteRef}
                    onHourChange={(value) => { setStartHour(value); clearError("startTime"); emitDraft({ "Horário Inicial": value && startMinute ? `${value}:${startMinute}` : "" }); }}
                    onMinuteChange={(value) => { setStartMinute(value); clearError("startTime"); emitDraft({ "Horário Inicial": startHour && value ? `${startHour}:${value}` : "" }); }}
                  />
                </VoucherInputRow>
              </VoucherSection>
              <VoucherSection title="Espera">
                <VoucherInputRow label="Início">
                  <TimeSelects prefix="espera-inicio" hour={waitStartHour} minute={waitStartMinute} onHourChange={(value) => { setWaitStartHour(value); emitDraft({ "Espera Início": value && waitStartMinute ? `${value}:${waitStartMinute}` : "" }); }} onMinuteChange={(value) => { setWaitStartMinute(value); emitDraft({ "Espera Início": waitStartHour && value ? `${waitStartHour}:${value}` : "" }); }} />
                </VoucherInputRow>
                <VoucherInputRow label="Final">
                  <TimeSelects prefix="espera-final" hour={waitEndHour} minute={waitEndMinute} onHourChange={(value) => { setWaitEndHour(value); emitDraft({ "Espera Final": value && waitEndMinute ? `${value}:${waitEndMinute}` : "" }); }} onMinuteChange={(value) => { setWaitEndMinute(value); emitDraft({ "Espera Final": waitEndHour && value ? `${waitEndHour}:${value}` : "" }); }} />
                </VoucherInputRow>
              </VoucherSection>
              <VoucherSection title="Informações Adicionais">
                <VoucherInputRow label="Desvio">
                  <input className="voucher-checkbox" type="checkbox" aria-label="Desvio" checked={deviation} onChange={(event) => { setDeviation(event.target.checked); emitDraft({ Desvio: event.target.checked ? "Sim" : "Não" }); }} />
                </VoucherInputRow>
                <VoucherInputRow label="Observação">
                  <textarea rows={3} value={obs} onChange={(event) => { setObs(event.target.value); emitDraft({ "Observação Voucher": event.target.value }); }} />
                </VoucherInputRow>
              </VoucherSection>
              <VoucherSection title="Despesas">
                <VoucherInputRow label="Pedágio"><input inputMode="decimal" placeholder="R$ 0,00" value={toll} onChange={(event) => { setToll(event.target.value); emitDraft({ Pedagio: event.target.value }); }} /></VoucherInputRow>
                <VoucherInputRow label="Estacionamento"><input inputMode="decimal" placeholder="R$ 0,00" value={parking} onChange={(event) => { setParking(event.target.value); emitDraft({ Estacionamento: event.target.value }); }} /></VoucherInputRow>
                <VoucherInputRow label="Combustível"><input inputMode="decimal" placeholder="R$ 0,00" value={fuel} onChange={(event) => { setFuel(event.target.value); emitDraft({ Combustivel: event.target.value }); }} /></VoucherInputRow>
                <VoucherInputRow label="Hospedagem"><input inputMode="decimal" placeholder="R$ 0,00" value={hotel} onChange={(event) => { setHotel(event.target.value); emitDraft({ Hospedagem: event.target.value }); }} /></VoucherInputRow>
                <VoucherInputRow label="Outros"><input inputMode="decimal" placeholder="R$ 0,00" value={others} onChange={(event) => { setOthers(event.target.value); emitDraft({ Outros: event.target.value }); }} /></VoucherInputRow>
              </VoucherSection>
            </div>
          </div>
          <div className="voucher-actions">
            {showSignature ? <button ref={signatureButtonRef} className={`voucher-sign ${errors.signature ? "is-invalid" : ""}`} aria-invalid={Boolean(errors.signature)} disabled={isSubmitting} onClick={() => { clearError("signature"); onOpenSignature(); }}>{hasSignature ? "Refazer assinatura" : "Assinar"}</button> : null}
            <FlowSubmitButton className="voucher-finish" idleLabel="FINALIZAR" loadingLabel="ENVIANDO" successLabel="ENVIADO" state={submitState} onClick={finish} />
          </div>
          {errors.signature ? <div className="field-error action-error">{errors.signature}</div> : null}
        </article>
      </section>
    </AppShell>
  );
}
