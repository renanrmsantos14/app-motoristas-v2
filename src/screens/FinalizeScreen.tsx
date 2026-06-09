import { useRef, useState } from "react";
import { FlowSubmitButton, type FlowSubmitState } from "../components/common/FlowSubmitButton";
import { AppShell } from "../components/layout/AppShell";
import { FormMenu } from "../components/navigation/FormMenu";
import { buildWhatsAppUrl, openExternalUrl } from "../lib/localWorkflow";
import { readPhotoFileAsDataUrl } from "../lib/photoOrientation";
import type { DetailData, MaintenancePhotoKind } from "../types";

type FinalizeScreenProps = {
  detail: DetailData;
  onBack: () => void;
  onDone: (fields: Record<string, string>) => void;
  confirmedPhotos: MaintenancePhotoKind[];
  maintenancePhotos: Partial<Record<MaintenancePhotoKind, string>>;
  maintenanceDraft?: MaintenanceFinalizeDraft;
  onMaintenanceDraftChange?: (draft: MaintenanceFinalizeDraft) => void;
  onPreviewMaintenancePhoto: (kind: MaintenancePhotoKind) => void;
  onCaptureMaintenancePhoto: (kind: MaintenancePhotoKind, photoDataUrl: string) => void;
  onClearPhotos?: () => void;
  submitState?: FlowSubmitState;
};

export type MaintenanceFinalizeDraft = {
  serviceDone: string;
  value: string;
  payment: string;
  establishment: string;
  notes: string;
};

type MaintenanceErrorKey = "serviceDone" | "value" | "payment" | "establishment" | "invoicePhoto" | "maintenancePhoto";
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

function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";
  return /iPad|iPhone|iPod/i.test(userAgent) || (platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function FinalizeActions({ onNone, onConfirm, submitState }: { onNone: () => void; onConfirm: () => void; submitState: FlowSubmitState }) {
  const isSubmitting = submitState !== "idle";
  return (
    <div className="finalize-actions">
      <FlowSubmitButton className="finalize-secondary" idleLabel="Não tenho" state={submitState} onClick={onNone} />
      <FlowSubmitButton className="finalize-primary" idleLabel="Confirmar" state={submitState} onClick={onConfirm} />
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

function ServiceFinalize({ onDone, submitState }: { detail: DetailData; onDone: (fields: Record<string, string>) => void; submitState: FlowSubmitState }) {
  const [obs, setObs] = useState("");

  return (
    <article className="finalize-card">
      <div className="finalize-title">Digite abaixo sua observação</div>
      <div className="finalize-scroll">
        <div className="finalize-form">
          <TextAreaBlock label="Observação do Serviço" value={obs} onChange={setObs} />
        </div>
      </div>
      <FinalizeActions
        onNone={() => onDone({ "Observação Final": "Sem observação." })}
        onConfirm={() => onDone({ "Observação Final": obs || "Sem observação." })}
        submitState={submitState}
      />
    </article>
  );
}

function ExchangeFinalize({ detail, onDone, submitState }: { detail: DetailData; onDone: (fields: Record<string, string>) => void; submitState: FlowSubmitState }) {
  const [obs, setObs] = useState("");

  return (
    <article className="finalize-card">
      <div className="finalize-title">{detail.id}</div>
      <div className="finalize-scroll">
        <div className="finalize-form">
          <TextAreaBlock label="Observação da Troca" value={obs} onChange={setObs} />
        </div>
      </div>
      <FinalizeActions
        onNone={() => onDone({ "Observações": "Sem observação." })}
        onConfirm={() => onDone({ "Observações": obs || "Sem observação." })}
        submitState={submitState}
      />
    </article>
  );
}

function MaintenancePhotoGrid({
  label,
  kinds,
  photos,
  isInvalid,
  isSubmitting,
  allowMultiple = false,
  onPreview,
  onNativeCapture
}: {
  label: string;
  kinds: MaintenancePhotoKind[];
  photos: Partial<Record<MaintenancePhotoKind, string>>;
  isInvalid?: boolean;
  isSubmitting: boolean;
  allowMultiple?: boolean;
  onPreview: (kind: MaintenancePhotoKind) => void;
  onNativeCapture: (kind: MaintenancePhotoKind, photoDataUrl: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nativeKindRef = useRef<MaintenancePhotoKind>(kinds[0]);
  const iosDevice = isIosDevice();
  const invoiceItems = Object.entries(photos)
    .filter(([kind, dataUrl]) => kind.startsWith("NOTAFISCAL") && Boolean(dataUrl))
    .sort(([left], [right]) => {
      const leftIndex = left === "NOTAFISCAL" ? 1 : Number(left.replace("NOTAFISCAL_", ""));
      const rightIndex = right === "NOTAFISCAL" ? 1 : Number(right.replace("NOTAFISCAL_", ""));
      return leftIndex - rightIndex;
    })
    .map(([kind, dataUrl]) => ({ kind: kind as MaintenancePhotoKind, dataUrl: dataUrl as string }));
  const fixedItems = kinds.map((kind) => ({ kind, dataUrl: photos[kind] })).filter((item): item is { kind: MaintenancePhotoKind; dataUrl: string } => Boolean(item.dataUrl));
  const photoItems = allowMultiple ? invoiceItems : fixedItems;
  const nextEmptyKind = allowMultiple
    ? ((invoiceItems.length === 0 ? "NOTAFISCAL" : `NOTAFISCAL_${invoiceItems.length + 1}`) as MaintenancePhotoKind)
    : (kinds.find((kind) => !photos[kind]) ?? kinds[kinds.length - 1]);

  const addPhoto = () => {
    nativeKindRef.current = nextEmptyKind;
    if (iosDevice) {
      fileInputRef.current?.click();
      return;
    }
    onPreview(nextEmptyKind);
  };

  const handleNativeCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await readPhotoFileAsDataUrl(file);
    onNativeCapture(nativeKindRef.current, dataUrl);
    event.target.value = "";
  };

  return (
    <div className={`finalize-input-block maintenance-photo-block ${isInvalid ? "is-invalid" : ""}`}>
      <label>{label}</label>
      <input
        ref={fileInputRef}
        className="native-camera-input"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleNativeCapture}
      />
      <div className="maintenance-photo-grid">
        {photoItems.map((photo, index) => (
          <button
            key={photo.kind}
            type="button"
            className="maintenance-photo-thumb"
            disabled={isSubmitting}
            onClick={() => onPreview(photo.kind)}
            aria-label={`Ver ${label} ${index + 1}`}
          >
            <img src={photo.dataUrl} alt={`${label} ${index + 1}`} />
          </button>
        ))}
        <button type="button" className="maintenance-photo-add" disabled={isSubmitting} onClick={addPhoto} aria-label={`Adicionar ${label}`}>
          <span>+</span>
        </button>
      </div>
    </div>
  );
}

function MaintenanceFinalize({
  detail,
  onDone,
  confirmedPhotos,
  maintenancePhotos,
  draft,
  onDraftChange,
  onPreviewMaintenancePhoto,
  onCaptureMaintenancePhoto,
  submitState
}: {
  detail: DetailData;
  onDone: (fields: Record<string, string>) => void;
  confirmedPhotos: MaintenancePhotoKind[];
  maintenancePhotos: Partial<Record<MaintenancePhotoKind, string>>;
  draft?: MaintenanceFinalizeDraft;
  onDraftChange?: (draft: MaintenanceFinalizeDraft) => void;
  onPreviewMaintenancePhoto: (kind: MaintenancePhotoKind) => void;
  onCaptureMaintenancePhoto: (kind: MaintenancePhotoKind, photoDataUrl: string) => void;
  submitState: FlowSubmitState;
}) {
  const isSubmitting = submitState !== "idle";
  const serviceDoneRef = useRef<HTMLTextAreaElement | null>(null);
  const valueRef = useRef<HTMLInputElement | null>(null);
  const paymentRef = useRef<HTMLSelectElement | null>(null);
  const establishmentRef = useRef<HTMLTextAreaElement | null>(null);
  const [serviceDone, setServiceDone] = useState(draft?.serviceDone ?? "");
  const [value, setValue] = useState(draft?.value ?? "");
  const [payment, setPayment] = useState(draft?.payment ?? "");
  const [establishment, setEstablishment] = useState(draft?.establishment ?? "");
  const [notes, setNotes] = useState(draft?.notes ?? "");
  const [errors, setErrors] = useState<MaintenanceErrors>({});

  const updateDraft = (updates: Partial<MaintenanceFinalizeDraft>) => {
    const nextDraft = {
      serviceDone,
      value,
      payment,
      establishment,
      notes,
      ...updates
    };
    onDraftChange?.(nextDraft);
  };

  const clearError = (key: MaintenanceErrorKey) => {
    if (!errors[key]) return;
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const finish = () => {
    if (isSubmitting) return;
    const fields = {
      "Serviço Realizado": serviceDone || "Serviço registrado localmente.",
      "Valor": value ? `R$ ${value}` : "R$ 0,00",
      "Forma de Pagamento": payment || "Não informado",
      "Estabelecimento": establishment || "Não informado",
      "Comentários do Motorista": notes || "Sem comentários.",
      "Fotos": confirmedPhotos.length ? `${confirmedPhotos.length} foto(s) confirmada(s)` : "Nenhuma foto confirmada"
    };

    const nextErrors: MaintenanceErrors = {};
    if (!serviceDone.trim()) nextErrors.serviceDone = "Descreva a manutenção realizada.";
    if (parseCurrencyNumber(value) <= 0) nextErrors.value = "Informe um valor maior que zero.";
    if (!payment) nextErrors.payment = "Selecione a forma de pagamento.";
    if (!establishment.trim()) nextErrors.establishment = "Informe o estabelecimento.";
    if (!confirmedPhotos.some((kind) => kind.startsWith("NOTAFISCAL"))) nextErrors.invoicePhoto = "Adicione a foto da nota fiscal.";
    if (!confirmedPhotos.some((kind) => kind === "FOTO1" || kind === "FOTO2" || kind === "FOTO3")) nextErrors.maintenancePhoto = "Adicione pelo menos uma foto da manutenção.";

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
            <label>Manutenção Realizada</label>
            <textarea ref={serviceDoneRef} aria-invalid={Boolean(errors.serviceDone)} placeholder="Digite aqui" rows={4} value={serviceDone} onChange={(event) => { setServiceDone(event.target.value); updateDraft({ serviceDone: event.target.value }); clearError("serviceDone"); }} />
            {errors.serviceDone ? <div className="field-error">{errors.serviceDone}</div> : null}
          </div>
          <div className={`finalize-input-block ${errors.value ? "is-invalid" : ""}`}>
            <label>Valor (R$)</label>
            <input ref={valueRef} aria-invalid={Boolean(errors.value)} inputMode="decimal" placeholder="0,00" value={value} onChange={(event) => { setValue(event.target.value); updateDraft({ value: event.target.value }); clearError("value"); }} />
            {errors.value ? <div className="field-error">{errors.value}</div> : null}
          </div>
          <div className={`finalize-input-block ${errors.payment ? "is-invalid" : ""}`}>
            <label>Forma de Pagamento</label>
            <select ref={paymentRef} aria-invalid={Boolean(errors.payment)} value={payment} onChange={(event) => { setPayment(event.target.value); updateDraft({ payment: event.target.value }); clearError("payment"); }}>
              <option value="" disabled />
              <option>Pedido de compra</option>
              <option>Cartão de crédito</option>
              <option>Pix</option>
            </select>
            {errors.payment ? <div className="field-error">{errors.payment}</div> : null}
          </div>
          <div className={`finalize-input-block ${errors.establishment ? "is-invalid" : ""}`}>
            <label>Estabelecimento</label>
            <textarea ref={establishmentRef} aria-invalid={Boolean(errors.establishment)} placeholder="Digite aqui" rows={3} value={establishment} onChange={(event) => { setEstablishment(event.target.value); updateDraft({ establishment: event.target.value }); clearError("establishment"); }} />
            {errors.establishment ? <div className="field-error">{errors.establishment}</div> : null}
          </div>
          <MaintenancePhotoGrid
            label="Fotos da nota fiscal"
            kinds={["NOTAFISCAL"]}
            photos={maintenancePhotos}
            isInvalid={Boolean(errors.invoicePhoto)}
            isSubmitting={isSubmitting}
            allowMultiple
            onNativeCapture={onCaptureMaintenancePhoto}
            onPreview={(kind) => { if (!isSubmitting) onPreviewMaintenancePhoto(kind); }}
          />
          {errors.invoicePhoto ? <div className="field-error">{errors.invoicePhoto}</div> : null}
          <MaintenancePhotoGrid
            label="Fotos da manutenção"
            kinds={["FOTO1", "FOTO2", "FOTO3"]}
            photos={maintenancePhotos}
            isInvalid={Boolean(errors.maintenancePhoto)}
            isSubmitting={isSubmitting}
            onNativeCapture={onCaptureMaintenancePhoto}
            onPreview={(kind) => { if (!isSubmitting) onPreviewMaintenancePhoto(kind); }}
          />
          {errors.maintenancePhoto ? <div className="field-error">{errors.maintenancePhoto}</div> : null}
          <div className="finalize-input-block">
            <label>Observações da Manutenção</label>
            <textarea placeholder="Digite aqui" rows={4} value={notes} onChange={(event) => { setNotes(event.target.value); updateDraft({ notes: event.target.value }); }} />
          </div>
          <div className="finalize-help">
            <span>Dúvidas?</span>
            <button
              type="button"
              onClick={() => openExternalUrl(buildWhatsAppUrl("+55 (12) 99723-6961", "Olá Júnior, preciso de ajuda com uma manutenção."))}
            >
              Contatar o Júnior
            </button>
          </div>
        </div>
      </div>
      <div className="finalize-actions maintenance-actions">
        <FlowSubmitButton className="finalize-primary" idleLabel="FINALIZAR" loadingLabel="ENVIANDO" successLabel="ENVIADO" state={submitState} onClick={finish} />
      </div>
    </article>
  );
}

export function FinalizeScreen({
  detail,
  onBack,
  onDone,
  confirmedPhotos,
  maintenancePhotos,
  maintenanceDraft,
  onMaintenanceDraftChange,
  onPreviewMaintenancePhoto,
  onCaptureMaintenancePhoto,
  onClearPhotos,
  submitState = "idle"
}: FinalizeScreenProps) {
  const title = detail.type === "MANUTENCAO" ? "Detalhes da Manutenção" : "Alguma Observação?";
  const isSubmitting = submitState !== "idle";

  return (
    <AppShell screenLabel="TelaFinalizar">
      <FormMenu title={title} onBack={isSubmitting ? undefined : onBack} rightIcon="eraser" rightLabel="Limpar campos" onRightClick={isSubmitting ? undefined : onClearPhotos} />
      <section className="main-panel finalize-main">
        {detail.type === "TROCA" ? <ExchangeFinalize detail={detail} onDone={onDone} submitState={submitState} /> : null}
        {detail.type === "SERVICO" ? <ServiceFinalize detail={detail} onDone={onDone} submitState={submitState} /> : null}
        {detail.type === "MANUTENCAO" ? (
          <MaintenanceFinalize
            detail={detail}
            onDone={onDone}
            confirmedPhotos={confirmedPhotos}
            maintenancePhotos={maintenancePhotos}
            draft={maintenanceDraft}
            onDraftChange={onMaintenanceDraftChange}
            onPreviewMaintenancePhoto={onPreviewMaintenancePhoto}
            onCaptureMaintenancePhoto={onCaptureMaintenancePhoto}
            submitState={submitState}
          />
        ) : null}
      </section>
    </AppShell>
  );
}
