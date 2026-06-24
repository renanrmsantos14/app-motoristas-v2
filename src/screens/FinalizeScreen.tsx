import { useEffect, useRef, useState } from "react";
import { ActionBar, ActionButton, type ActionButtonState } from "../components/common/ActionButton";
import { FieldError, MoneyInputField, SelectField, TextAreaField } from "../components/common/FormFields";
import { PhotoAddButton } from "../components/common/PhotoAddButton";
import { AppShell } from "../components/layout/AppShell";
import { FormMenu } from "../components/navigation/FormMenu";
import { buildWhatsAppUrl, openExternalUrl } from "../lib/localWorkflow";
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
  onClearPhotos?: () => void;
  submitState?: ActionButtonState;
  initialServiceObservation?: string;
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

function FinalizeActions({ onNone, onConfirm, submitState }: { onNone: () => void; onConfirm: () => void; submitState: ActionButtonState }) {
  const [activeAction, setActiveAction] = useState<"none" | "confirm" | "">("");

  useEffect(() => {
    if (submitState === "idle") setActiveAction("");
  }, [submitState]);

  return (
    <ActionBar className="finalize-actions">
      <ActionButton
        className="finalize-secondary"
        idleLabel="Não tenho"
        state={submitState}
        active={activeAction === "none"}
        variant="secondary"
        onClick={() => {
          setActiveAction("none");
          onNone();
        }}
      />
      <ActionButton
        className="finalize-primary"
        idleLabel="Confirmar"
        state={submitState}
        active={activeAction === "confirm"}
        variant="primary"
        onClick={() => {
          setActiveAction("confirm");
          onConfirm();
        }}
      />
    </ActionBar>
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
    <TextAreaField
      fieldClassName="finalize-input-block shadow"
      label={label}
      placeholder="Digite aqui"
      rows={5}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function ServiceFinalize({ detail, onDone, submitState, initialObservation = "" }: { detail: DetailData; onDone: (fields: Record<string, string>) => void; submitState: ActionButtonState; initialObservation?: string }) {
  const [obs, setObs] = useState(initialObservation);

  useEffect(() => {
    setObs(initialObservation);
  }, [detail.id, initialObservation]);

  const finalObservation = obs.trim() || initialObservation.trim() || "Sem observação.";

  return (
    <article className="finalize-card">
      <div className="finalize-title">Digite abaixo sua observação</div>
      <div className="finalize-scroll">
        <div className="finalize-form">
          <TextAreaBlock label="Observação do serviço" value={obs} onChange={setObs} />
        </div>
      </div>
      <FinalizeActions
        onNone={() => onDone({ "Observação Final": finalObservation })}
        onConfirm={() => onDone({ "Observação Final": finalObservation })}
        submitState={submitState}
      />
    </article>
  );
}
function ExchangeFinalize({ detail, onDone, submitState }: { detail: DetailData; onDone: (fields: Record<string, string>) => void; submitState: ActionButtonState }) {
  const [obs, setObs] = useState("");

  return (
    <article className="finalize-card">
      <div className="finalize-title">{detail.id}</div>
      <div className="finalize-scroll">
        <div className="finalize-form">
          <TextAreaBlock label="Observação da troca" value={obs} onChange={setObs} />
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
  required = false,
  isSubmitting,
  allowMultiple = false,
  onPreview
}: {
  label: string;
  kinds: MaintenancePhotoKind[];
  photos: Partial<Record<MaintenancePhotoKind, string>>;
  isInvalid?: boolean;
  required?: boolean;
  isSubmitting: boolean;
  allowMultiple?: boolean;
  onPreview: (kind: MaintenancePhotoKind) => void;
}) {
  const invoiceItems = Object.entries(photos)
    .filter(([kind, dataUrl]) => kind.startsWith("NOTAFISCAL") && Boolean(dataUrl))
    .sort(([left], [right]) => {
      const leftIndex = left === "NOTAFISCAL" ? 1 : Number(left.replace("NOTAFISCAL_", ""));
      const rightIndex = right === "NOTAFISCAL" ? 1 : Number(right.replace("NOTAFISCAL_", ""));
      return leftIndex - rightIndex;
    })
    .map(([kind, dataUrl]) => ({ kind: kind as MaintenancePhotoKind, dataUrl: dataUrl as string }));
  const fixedItems = kinds
    .map((kind) => ({ kind, dataUrl: photos[kind] }))
    .filter((item): item is { kind: MaintenancePhotoKind; dataUrl: string } => Boolean(item.dataUrl));
  const photoItems = allowMultiple ? invoiceItems : fixedItems;
  const nextEmptyKind = allowMultiple
    ? ((invoiceItems.length === 0 ? "NOTAFISCAL" : `NOTAFISCAL_${invoiceItems.length + 1}`) as MaintenancePhotoKind)
    : (kinds.find((kind) => !photos[kind]) ?? kinds[kinds.length - 1]);

  return (
    <div className={`finalize-input-block maintenance-photo-block ${isInvalid ? "is-invalid" : ""}`}>
      <label className="form-field-label">
        <span>{label}</span>
        {required ? <span className="form-field-required" aria-hidden="true">*</span> : null}
      </label>
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
            {photo.dataUrl.startsWith("data:video/") ? (
              <>
                <video src={photo.dataUrl} muted playsInline preload="metadata" />
                <span className="media-video-badge">Vídeo</span>
              </>
            ) : (
              <img src={photo.dataUrl} alt={`${label} ${index + 1}`} />
            )}
          </button>
        ))}
        <PhotoAddButton disabled={isSubmitting} onClick={() => onPreview(nextEmptyKind)} ariaLabel={`Adicionar ${label}`} />
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
  submitState
}: {
  detail: DetailData;
  onDone: (fields: Record<string, string>) => void;
  confirmedPhotos: MaintenancePhotoKind[];
  maintenancePhotos: Partial<Record<MaintenancePhotoKind, string>>;
  draft?: MaintenanceFinalizeDraft;
  onDraftChange?: (draft: MaintenanceFinalizeDraft) => void;
  onPreviewMaintenancePhoto: (kind: MaintenancePhotoKind) => void;
  submitState: ActionButtonState;
}) {
  const isSubmitting = submitState !== "idle";
  const serviceDoneRef = useRef<HTMLTextAreaElement | null>(null);
  const valueRef = useRef<HTMLInputElement | null>(null);
  const paymentRef = useRef<HTMLButtonElement | null>(null);
  const establishmentRef = useRef<HTMLTextAreaElement | null>(null);
  const [serviceDone, setServiceDone] = useState(draft?.serviceDone ?? "");
  const [value, setValue] = useState(draft?.value ?? "");
  const [payment, setPayment] = useState(draft?.payment ?? "");
  const [establishment, setEstablishment] = useState(draft?.establishment ?? "");
  const [notes, setNotes] = useState(draft?.notes ?? "");
  const [errors, setErrors] = useState<MaintenanceErrors>({});

  const paymentOptions = [
    { value: "Pedido de compra", label: "Pedido de compra" },
    { value: "Cartão de crédito", label: "Cartão de crédito" },
    { value: "Pix", label: "Pix" }
  ];

  const updateDraft = (updates: Partial<MaintenanceFinalizeDraft>) => {
    const nextDraft = { serviceDone, value, payment, establishment, notes, ...updates };
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
      Valor: value ? `R$ ${value}` : "R$ 0,00",
      "Forma de Pagamento": payment || "Não informado",
      Estabelecimento: establishment || "Não informado",
      "Comentários do Motorista": notes || "Sem comentários.",
      Fotos: confirmedPhotos.length ? `${confirmedPhotos.length} foto(s) confirmada(s)` : "Nenhuma foto confirmada"
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

          <TextAreaField
            ref={serviceDoneRef}
            required
            label="Manutenção Realizada"
            error={errors.serviceDone}
            placeholder="Digite aqui"
            rows={4}
            value={serviceDone}
            onChange={(event) => {
              setServiceDone(event.target.value);
              updateDraft({ serviceDone: event.target.value });
              clearError("serviceDone");
            }}
          />

          <MoneyInputField
            ref={valueRef}
            required
            label="Valor (R$)"
            error={errors.value}
            inputMode="decimal"
            pattern="[0-9.,]*"
            autoComplete="off"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              updateDraft({ value: event.target.value });
              clearError("value");
            }}
          />

          <SelectField
            ref={paymentRef}
            required
            label="Forma de Pagamento"
            error={errors.payment}
            value={payment}
            options={paymentOptions}
            placeholder="Selecione"
            ariaLabel="Selecionar forma de pagamento"
            onChange={(nextValue) => {
              setPayment(nextValue);
              updateDraft({ payment: nextValue });
              clearError("payment");
            }}
          />

          <TextAreaField
            ref={establishmentRef}
            required
            label="Estabelecimento"
            error={errors.establishment}
            placeholder="Digite aqui"
            rows={3}
            value={establishment}
            onChange={(event) => {
              setEstablishment(event.target.value);
              updateDraft({ establishment: event.target.value });
              clearError("establishment");
            }}
          />

          <MaintenancePhotoGrid
            label="Fotos da nota fiscal"
            kinds={["NOTAFISCAL"]}
            photos={maintenancePhotos}
            isInvalid={Boolean(errors.invoicePhoto)}
            required
            isSubmitting={isSubmitting}
            allowMultiple
            onPreview={(kind) => {
              if (!isSubmitting) onPreviewMaintenancePhoto(kind);
            }}
          />
          <FieldError error={errors.invoicePhoto} />

          <MaintenancePhotoGrid
            label="Fotos da manutenção"
            kinds={["FOTO1", "FOTO2", "FOTO3"]}
            photos={maintenancePhotos}
            isInvalid={Boolean(errors.maintenancePhoto)}
            required
            isSubmitting={isSubmitting}
            onPreview={(kind) => {
              if (!isSubmitting) onPreviewMaintenancePhoto(kind);
            }}
          />
          <FieldError error={errors.maintenancePhoto} />

          <TextAreaField
            label="Observações da Manutenção"
            placeholder="Digite aqui"
            rows={4}
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
              updateDraft({ notes: event.target.value });
            }}
          />

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
      <ActionBar className="finalize-actions maintenance-actions">
        <ActionButton className="finalize-primary" variant="primary" idleLabel="FINALIZAR" loadingLabel="ENVIANDO" successLabel="ENVIADO" state={submitState} onClick={finish} />
      </ActionBar>
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
  onClearPhotos,
  submitState = "idle",
  initialServiceObservation = ""
}: FinalizeScreenProps) {
  const title = detail.type === "MANUTENCAO" ? "Detalhes da Manutenção" : "Alguma Observação?";
  const isSubmitting = submitState !== "idle";

  return (
    <AppShell screenLabel="TelaFinalizar">
      <FormMenu title={title} onBack={isSubmitting ? undefined : onBack} rightIcon="eraser" rightLabel="Limpar campos" onRightClick={isSubmitting ? undefined : onClearPhotos} />
      <section className="main-panel finalize-main">
        {detail.type === "TROCA" ? <ExchangeFinalize detail={detail} onDone={onDone} submitState={submitState} /> : null}
        {detail.type === "SERVICO" ? <ServiceFinalize detail={detail} onDone={onDone} submitState={submitState} initialObservation={initialServiceObservation} /> : null}
        {detail.type === "MANUTENCAO" ? (
          <MaintenanceFinalize
            detail={detail}
            onDone={onDone}
            confirmedPhotos={confirmedPhotos}
            maintenancePhotos={maintenancePhotos}
            draft={maintenanceDraft}
            onDraftChange={onMaintenanceDraftChange}
            onPreviewMaintenancePhoto={onPreviewMaintenancePhoto}
            submitState={submitState}
          />
        ) : null}
      </section>
    </AppShell>
  );
}



