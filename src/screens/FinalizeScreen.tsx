import { useRef, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { FormMenu } from "../components/navigation/FormMenu";
import { buildWhatsAppUrl } from "../lib/localWorkflow";
import type { DetailData, MaintenancePhotoKind } from "../types";

type FinalizeScreenProps = {
  detail: DetailData;
  onBack: () => void;
  onDone: (fields: Record<string, string>) => void;
  confirmedPhotos: MaintenancePhotoKind[];
  onPreviewMaintenancePhoto: (kind: MaintenancePhotoKind) => void;
  onClearPhotos?: () => void;
};

type MaintenanceErrorKey = "serviceDone" | "value" | "payment" | "establishment";
type MaintenanceErrors = Partial<Record<MaintenanceErrorKey, string>>;

function parseCurrencyNumber(value: string) {
  return Number(value.replace("R$", "").replace(/\./g, "").replace(",", ".").trim() || "0");
}

function focusInvalidField(element: HTMLElement | null) {
  window.setTimeout(() => {
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    element?.focus({ preventScroll: true });
  }, 40);
}

function FinalizeActions({ onNone, onConfirm }: { onNone: () => void; onConfirm: () => void }) {
  return (
    <div className="finalize-actions">
      <button className="finalize-secondary" onClick={onNone}>Nao tenho</button>
      <button className="finalize-primary" onClick={onConfirm}>Confirmar</button>
    </div>
  );
}

function TextAreaBlock({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="finalize-input-block shadow">
      <label>{label}</label>
      <textarea placeholder="Digite aqui" rows={5} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function ServiceFinalize({ onDone }: { detail: DetailData; onDone: (fields: Record<string, string>) => void }) {
  const [obs, setObs] = useState("");

  return (
    <article className="finalize-card">
      <div className="finalize-title">Digite abaixo sua observacao</div>
      <div className="finalize-scroll">
        <div className="finalize-form">
          <TextAreaBlock label="Observacao do Servico" value={obs} onChange={setObs} />
          <FinalizeActions
            onNone={() => onDone({ "Observacao Final": "Sem observacao." })}
            onConfirm={() => onDone({ "Observacao Final": obs || "Sem observacao." })}
          />
        </div>
      </div>
    </article>
  );
}

function ExchangeFinalize({ detail, onDone }: { detail: DetailData; onDone: (fields: Record<string, string>) => void }) {
  const [obs, setObs] = useState("");

  return (
    <article className="finalize-card">
      <div className="finalize-title">{detail.id}</div>
      <div className="finalize-scroll">
        <div className="finalize-form">
          <TextAreaBlock label="Observacao da Troca" value={obs} onChange={setObs} />
          <FinalizeActions
            onNone={() => onDone({ "Observacoes": "Sem observacao." })}
            onConfirm={() => onDone({ "Observacoes": obs || "Sem observacao." })}
          />
        </div>
      </div>
    </article>
  );
}

function MaintenanceUpload({
  label,
  confirmed,
  onPreview
}: {
  label: string;
  confirmed: boolean;
  onPreview: () => void;
}) {
  return (
    <div className="finalize-input-block">
      <label>{label}{confirmed ? " OK" : ""}</label>
      <button className="finalize-upload" type="button" onClick={onPreview}>
        {confirmed ? "Ver / refazer foto" : "Adicionar foto"}
      </button>
    </div>
  );
}

function MaintenanceFinalize({
  detail,
  onDone,
  confirmedPhotos,
  onPreviewMaintenancePhoto
}: {
  detail: DetailData;
  onDone: (fields: Record<string, string>) => void;
  confirmedPhotos: MaintenancePhotoKind[];
  onPreviewMaintenancePhoto: (kind: MaintenancePhotoKind) => void;
}) {
  const serviceDoneRef = useRef<HTMLTextAreaElement | null>(null);
  const valueRef = useRef<HTMLInputElement | null>(null);
  const paymentRef = useRef<HTMLSelectElement | null>(null);
  const establishmentRef = useRef<HTMLTextAreaElement | null>(null);
  const [serviceDone, setServiceDone] = useState("");
  const [value, setValue] = useState("");
  const [payment, setPayment] = useState("");
  const [establishment, setEstablishment] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<MaintenanceErrors>({});

  const clearError = (key: MaintenanceErrorKey) => {
    if (!errors[key]) return;
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const finish = () => {
    const fields = {
      "Servico Realizado": serviceDone || "Servico registrado localmente.",
      "Valor": value ? `R$ ${value}` : "R$ 0,00",
      "Forma de Pagamento": payment || "Nao informado",
      "Estabelecimento": establishment || "Nao informado",
      "Comentarios do Motorista": notes || "Sem comentarios.",
      "Fotos": confirmedPhotos.length ? `${confirmedPhotos.length} foto(s) confirmada(s)` : "Nenhuma foto confirmada"
    };

    const nextErrors: MaintenanceErrors = {};
    if (!serviceDone.trim()) nextErrors.serviceDone = "Descreva a manutencao realizada.";
    if (parseCurrencyNumber(value) <= 0) nextErrors.value = "Informe um valor maior que zero.";
    if (!payment) nextErrors.payment = "Selecione a forma de pagamento.";
    if (!establishment.trim()) nextErrors.establishment = "Informe o estabelecimento.";

    setErrors(nextErrors);

    if (nextErrors.serviceDone) return focusInvalidField(serviceDoneRef.current);
    if (nextErrors.value) return focusInvalidField(valueRef.current);
    if (nextErrors.payment) return focusInvalidField(paymentRef.current);
    if (nextErrors.establishment) return focusInvalidField(establishmentRef.current);

    onDone(fields);
  };

  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <article className="finalize-card">
      <div className="finalize-title">{detail.id}</div>
      <div className="finalize-scroll">
        <div className="finalize-form maintenance">
          {errorCount ? <div className="form-error-summary">Revise {errorCount} campo(s) destacado(s).</div> : null}
          <div className={`finalize-input-block ${errors.serviceDone ? "is-invalid" : ""}`}>
            <label>Manutencao Realizada</label>
            <textarea ref={serviceDoneRef} aria-invalid={Boolean(errors.serviceDone)} placeholder="Digite aqui" rows={4} value={serviceDone} onChange={(event) => { setServiceDone(event.target.value); clearError("serviceDone"); }} />
            {errors.serviceDone ? <div className="field-error">{errors.serviceDone}</div> : null}
          </div>
          <div className={`finalize-input-block ${errors.value ? "is-invalid" : ""}`}>
            <label>Valor (R$)</label>
            <input ref={valueRef} aria-invalid={Boolean(errors.value)} inputMode="decimal" placeholder="0,00" value={value} onChange={(event) => { setValue(event.target.value); clearError("value"); }} />
            {errors.value ? <div className="field-error">{errors.value}</div> : null}
          </div>
          <div className={`finalize-input-block ${errors.payment ? "is-invalid" : ""}`}>
            <label>Forma de Pagamento</label>
            <select ref={paymentRef} aria-invalid={Boolean(errors.payment)} value={payment} onChange={(event) => { setPayment(event.target.value); clearError("payment"); }}>
              <option value="" disabled />
              <option>Pedido de compra</option>
              <option>Cartao de credito</option>
              <option>Pix</option>
            </select>
            {errors.payment ? <div className="field-error">{errors.payment}</div> : null}
          </div>
          <div className={`finalize-input-block ${errors.establishment ? "is-invalid" : ""}`}>
            <label>Estabelecimento</label>
            <textarea ref={establishmentRef} aria-invalid={Boolean(errors.establishment)} placeholder="Digite aqui" rows={3} value={establishment} onChange={(event) => { setEstablishment(event.target.value); clearError("establishment"); }} />
            {errors.establishment ? <div className="field-error">{errors.establishment}</div> : null}
          </div>
          <MaintenanceUpload label="Nota Fiscal" confirmed={confirmedPhotos.includes("NOTAFISCAL")} onPreview={() => onPreviewMaintenancePhoto("NOTAFISCAL")} />
          <MaintenanceUpload label="Foto 1" confirmed={confirmedPhotos.includes("FOTO1")} onPreview={() => onPreviewMaintenancePhoto("FOTO1")} />
          <MaintenanceUpload label="Foto 2" confirmed={confirmedPhotos.includes("FOTO2")} onPreview={() => onPreviewMaintenancePhoto("FOTO2")} />
          <MaintenanceUpload label="Foto 3" confirmed={confirmedPhotos.includes("FOTO3")} onPreview={() => onPreviewMaintenancePhoto("FOTO3")} />
          <div className="finalize-input-block">
            <label>Observacoes da Manutencao</label>
            <textarea placeholder="Digite aqui" rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>
          <div className="finalize-help">
            <span>Duvidas?</span>
            <button
              type="button"
              onClick={() => window.open(buildWhatsAppUrl("+55 (12) 99723-6961", "Ola Junior, preciso de ajuda com uma manutencao."), "_blank", "noopener,noreferrer")}
            >
              Contatar o Junior
            </button>
          </div>
          <div className="finalize-actions maintenance-actions">
            <button className="finalize-primary" onClick={finish}>FINALIZAR</button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function FinalizeScreen({
  detail,
  onBack,
  onDone,
  confirmedPhotos,
  onPreviewMaintenancePhoto,
  onClearPhotos
}: FinalizeScreenProps) {
  const title = detail.type === "MANUTENCAO" ? "Detalhes da Manutencao" : "Alguma Observacao?";

  return (
    <AppShell screenLabel="TelaFinalizar">
      <FormMenu title={title} onBack={onBack} rightIcon="eraser" rightLabel="Limpar campos" onRightClick={onClearPhotos} />
      <section className="main-panel finalize-main">
        {detail.type === "TROCA" ? <ExchangeFinalize detail={detail} onDone={onDone} /> : null}
        {detail.type === "SERVICO" ? <ServiceFinalize detail={detail} onDone={onDone} /> : null}
        {detail.type === "MANUTENCAO" ? (
          <MaintenanceFinalize
            detail={detail}
            onDone={onDone}
            confirmedPhotos={confirmedPhotos}
            onPreviewMaintenancePhoto={onPreviewMaintenancePhoto}
          />
        ) : null}
      </section>
    </AppShell>
  );
}
