import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import logoBetinhosB from "../../Logo Betinhos B.png";
import logoBetinhosPreta from "../../Logo Betinhos Preta.png";
import nlaLogo from "../../NLA.jpg";
import qrCodeAvaliacao from "../../QrCode-Avaliação.png";
import invoiceReceiptIcon from "../assets/icons/invoice-receipt.svg";
import { ActionBar, ActionButton, type ActionButtonState } from "../components/common/ActionButton";
import { MoneyInputField, SelectField, TextAreaField, TextInputField } from "../components/common/FormFields";
import { LocalToast, type ToastState, type ToastTone } from "../components/common/LocalToast";
import { AppShell } from "../components/layout/AppShell";
import { FormMenu } from "../components/navigation/FormMenu";
import { reportAppError } from "../lib/appErrorLogger";
import { createReceiptRecordRemote, hasDataverseRuntime, uploadReceiptPdfRemote, type PreparedReceiptUpload, type ReceiptPdfUploadResult } from "../lib/dataverse";
import { buildPersonalReceiptDraft, buildPersonalReceiptModel, type PersonalReceiptEditableDraft, type PersonalReceiptModel } from "../lib/personalReceipt";
import { getReceiptCopy, getReceiptDisplayClient, RECEIPT_LANGUAGE_OPTIONS } from "../lib/receiptLanguage";
import { generateReceiptPdfBlob } from "../lib/receiptPdf";
import type { DetailData } from "../types";

type ReceiptScreenProps = {
  detail?: DetailData;
  clienteOptions?: string[];
  metodoPagamentoOptions?: string[];
  onBack: () => void;
  onProgress?: (progress: { message: string; phase?: string } | null) => void;
};

type ReceiptDraftKey = keyof PersonalReceiptEditableDraft;
type ReceiptDraftErrors = Partial<Record<ReceiptDraftKey, string>>;

function nextToast(message: string, tone: ToastTone): ToastState {
  return { id: Date.now() + Math.random(), message, tone };
}

function validateReceiptDraft(draft: PersonalReceiptEditableDraft) {
  const errors: ReceiptDraftErrors = {};
  if (!draft.nomePagante.trim()) errors.nomePagante = "Informe o pagante.";
  if (!draft.cliente.trim()) errors.cliente = "Informe o cliente.";
  if (!draft.valorTotal.trim()) errors.valorTotal = "Informe o total.";
  else if (!/^\d+(?:[.,]\d{1,2})?$/.test(draft.valorTotal.trim())) errors.valorTotal = "Informe um valor numerico valido.";
  return errors;
}

function displayReceiptValue(value: string) {
  const trimmed = value.trim();
  return trimmed || "-";
}

function sanitizeReceiptTotalInput(value: string) {
  const cleaned = value.replace(/[^\d.,]/g, "");
  const separatorMatches = [...cleaned.matchAll(/[.,]/g)];
  if (!separatorMatches.length) return cleaned;

  const lastSeparatorIndex = separatorMatches[separatorMatches.length - 1]?.index ?? -1;
  if (lastSeparatorIndex < 0) return cleaned.replace(/[.,]/g, "");

  const integerPart = cleaned.slice(0, lastSeparatorIndex).replace(/[.,]/g, "");
  const fractionPart = cleaned.slice(lastSeparatorIndex + 1).replace(/[.,]/g, "").slice(0, 2);
  const separator = cleaned[lastSeparatorIndex];

  if (!fractionPart && cleaned.endsWith(separator)) return `${integerPart}${separator}`;
  return fractionPart ? `${integerPart}${separator}${fractionPart}` : integerPart;
}

function ReceiptForm({
  draft,
  errors,
  generateState,
  receiptLink,
  clienteOptions = [],
  onChange,
  onGenerate
}: {
  draft: PersonalReceiptEditableDraft;
  errors: ReceiptDraftErrors;
  generateState: ActionButtonState;
  receiptLink?: string | null;
  clienteOptions?: string[];
  onChange: (field: ReceiptDraftKey, value: string) => void;
  onGenerate: () => void;
}) {
  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <article className="finalize-card receipt-editor-form-card">
      <div className="finalize-title">Dados do recibo</div>
      <div className="finalize-scroll">
        <div className="finalize-form maintenance receipt-editor-form">
          <div className="receipt-editor-note">Preencha os dados e gere o recibo. O PDF salvo no OneDrive aparece abaixo.</div>
          {errorCount ? <div className="form-error-summary">Revise {errorCount} campo(s) obrigatório(s).</div> : null}
          {receiptLink ? (
            <div className="receipt-editor-link-panel">
              <div className="receipt-editor-link-copy">
                <span>Recibo gerado</span>
                <strong>Clique no link para abrir o PDF</strong>
              </div>
              <a href={receiptLink} target="_blank" rel="noreferrer">Abrir PDF</a>
            </div>
          ) : null}
          <div className="receipt-editor-grid">
            <TextInputField
              fieldClassName={`finalize-input-block receipt-editor-block receipt-editor-block-span-2`}
              label="Pagante"
              required
              error={errors.nomePagante}
              value={draft.nomePagante}
              onChange={(event) => onChange("nomePagante", event.target.value)}
            />
            <SelectField
              fieldClassName={`finalize-input-block receipt-editor-block receipt-editor-block-span-2`}
              label="Cliente"
              required
              error={errors.cliente}
              value={draft.cliente}
              options={clienteOptions.map((option) => ({ value: option, label: option }))}
              placeholder="Digite ou escolha um cliente"
              ariaLabel="Selecionar cliente"
              onChange={(value) => onChange("cliente", value)}
            />
            <SelectField
              fieldClassName={`finalize-input-block receipt-editor-block`}
              label="Idioma"
              value={draft.idioma}
              options={RECEIPT_LANGUAGE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
              placeholder="Selecionar idioma"
              ariaLabel="Selecionar idioma"
              onChange={(value) => onChange("idioma", value)}
            />
            <MoneyInputField
              fieldClassName={`finalize-input-block receipt-editor-block`}
              label="Total"
              required
              error={errors.valorTotal}
              inputMode="decimal"
              pattern="[0-9.,]*"
              autoComplete="off"
              value={draft.valorTotal}
              onChange={(event) => onChange("valorTotal", sanitizeReceiptTotalInput(event.target.value))}
            />
            <TextAreaField
              fieldClassName={`finalize-input-block receipt-editor-block receipt-editor-block-span-2`}
              label="Observações"
              rows={4}
              value={draft.observacoes}
              onChange={(event) => onChange("observacoes", event.target.value)}
            />
          </div>
        </div>
      </div>
      <ActionBar className="finalize-actions receipt-editor-actions">
        <ActionButton
          className="receipt-editor-action"
          variant="primary"
          label="Gerar"
          loadingLabel="Gerando"
          successLabel="Gerado"
          state={generateState}
          onClick={onGenerate}
          icon={<img src={invoiceReceiptIcon} alt="" />}
        />
      </ActionBar>
    </article>
  );
}

export function ReceiptDocument({ model, documentRef }: { model: PersonalReceiptModel; documentRef?: RefObject<HTMLElement> }) {
  const copy = getReceiptCopy(model.idioma);

  return (
    <article ref={documentRef} className="receipt-document" aria-label={`Recibo ${displayReceiptValue(model.idPag)}`}>
      <header className="receipt-header">
        <div className="receipt-header-main">
          <div className="receipt-header-title">{copy.title}</div>
          <img className="receipt-header-logo" src={logoBetinhosB} alt="Betinhos B" />
        </div>
        <div className="receipt-header-note">
          <div className="receipt-header-note-text">{copy.note}</div>
        </div>
      </header>

      <section className="receipt-summary">
        <div className="receipt-summary-main">
          <div className="receipt-party-name">{displayReceiptValue(model.nomePagante)}</div>
          <div className="receipt-party-client">{displayReceiptValue(getReceiptDisplayClient(model.cliente, model.idioma))}</div>
        </div>
        <div className="receipt-summary-meta">
          <div className="receipt-meta-labels">
            <div>{copy.identificationLabel}</div>
            <div>{copy.issueDateLabel}</div>
            <div>{copy.paymentMethodLabel}</div>
          </div>
          <div className="receipt-meta-values">
            <div>{displayReceiptValue(model.idPag)}</div>
            <div>{displayReceiptValue(model.dataEmissao)}</div>
            <div>{displayReceiptValue(model.metodoPagamento)}</div>
          </div>
        </div>
      </section>

      <section className="receipt-body">
        <div className="receipt-block receipt-description-head">
          <div className="receipt-description-title">{copy.descriptionTitle}</div>
        </div>

        <div className="receipt-block receipt-description-body">
          <p>{copy.descriptionBody}</p>
        </div>

        <div className="receipt-total-row">
          <div className="receipt-total-thanks">{copy.thanksForTravel}</div>
          <div className="receipt-total-label">{copy.totalLabel}</div>
          <div className="receipt-total-value">{displayReceiptValue(model.valorTotal)}</div>
        </div>

        <div className="receipt-observations-row">
          <div className="receipt-observations">
            <div className="receipt-observations-label">{copy.observationsLabel}</div>
            <div className="receipt-observations-text">{displayReceiptValue(model.observacoes)}</div>
          </div>
          <div className="receipt-company">
            <div>BETINHOS EXECUTIVE SERVICE LTDA EPP</div>
            <div>CNPJ: 07.108.241/0001-06</div>
            <div>CNPJ: 24.484.228/0001-62</div>
            <div>Sede: São José dos Campos, São Paulo - Brasil</div>
            <div>Filial: Pindamonhangaba, São Paulo - Brasil</div>
          </div>
        </div>
      </section>

      <footer className="receipt-footer">
        <div className="receipt-footer-logos">
          <div className="receipt-footer-logo-box nla">
            <img src={nlaLogo} alt="NLA" />
          </div>
          <div className="receipt-footer-logo-box preta">
            <img src={logoBetinhosPreta} alt="Betinhos Preta" />
          </div>
          <div className="receipt-footer-logo-box bmark">
            <div className="receipt-qr-box">
              <img className="receipt-qr-image" src={qrCodeAvaliacao} alt="QR code para avaliação" />
              <div className="receipt-qr-caption">{copy.qrCaption}</div>
            </div>
          </div>
        </div>

        <div className="receipt-footer-separator" />

        <div className="receipt-footer-contacts">
          <div className="receipt-contact-row">
            <div className="receipt-contact-name">Junior de Paula</div>
            <div className="receipt-contact-role">{copy.conciergeRole}</div>
            <div className="receipt-contact-phone">+55 12 99723 6961</div>
            <div className="receipt-contact-email">junior@betinhos.com.br</div>
          </div>
          <div className="receipt-contact-row">
            <div className="receipt-contact-name">Deborah Keila</div>
            <div className="receipt-contact-role">{copy.operationsManagerRole}</div>
            <div className="receipt-contact-phone">+55 12 99615 9093</div>
            <div className="receipt-contact-email">deborah.keila@betinhos.com.br</div>
          </div>
          <div className="receipt-contact-row">
            <div className="receipt-contact-name">Juliana Rodrigues</div>
            <div className="receipt-contact-role">{copy.financeManagerRole}</div>
            <div className="receipt-contact-phone">+55 12 99615 9085</div>
            <div className="receipt-contact-email">financeiro@betinhos.com.br</div>
          </div>
        </div>
      </footer>
    </article>
  );
}

function ReceiptScaledCanvas({
  model,
  documentRef,
  className = "",
  interactive = false,
  onClick
}: {
  model: PersonalReceiptModel;
  documentRef?: RefObject<HTMLElement>;
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
}) {
  const baseWidth = 794;
  const baseHeight = 1123;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateScale = () => {
      const availableWidth = Math.max(0, viewport.clientWidth - 24);
      const availableHeight = Math.max(0, viewport.clientHeight - 24);
      if (!availableWidth || !availableHeight) return;
      const nextScale = Math.min(1, availableWidth / baseWidth, availableHeight / baseHeight);
      setScale(nextScale);
      setReady(true);
    };

    updateScale();

    const resizeObserver = new ResizeObserver(() => updateScale());
    resizeObserver.observe(viewport);
    window.addEventListener("resize", updateScale);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, []);


  return (
    <div
      ref={viewportRef}
      className={`receipt-scroll receipt-scroll-fit ${className} ${interactive ? "is-clickable" : ""}`.trim()}
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick?.();
        }
      } : undefined}
      aria-label={interactive ? "Ampliar preview do recibo" : undefined}
    >
      <div
        className="receipt-stage"
        style={{
          width: `${baseWidth * scale}px`,
          height: `${baseHeight * scale}px`
        }}
      >
        <div
          className="receipt-fit-frame"
          style={{
            visibility: ready ? "visible" : "hidden"
          }}
        >
          <div className="receipt-fit-scale" style={{ transform: `scale(${scale})` }}>
            <ReceiptDocument model={model} documentRef={documentRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ReceiptPreview({
  model,
  documentRef,
  onExpand,
  receiptLink
}: {
  model: PersonalReceiptModel;
  documentRef?: RefObject<HTMLElement>;
  onExpand: () => void;
  receiptLink?: string | null;
}) {
  const copy = getReceiptCopy(model.idioma);
  const isGenerated = Boolean(receiptLink);

  return (
    <article className={`receipt-preview-card-shell ${isGenerated ? "is-generated" : ""}`.trim()}>
      {!isGenerated ? (
        <button
          type="button"
          className="receipt-card-shell receipt-preview-card receipt-preview-inline"
          onClick={onExpand}
          aria-label={copy.expandPreviewAria}
        >
          <div className="receipt-preview-copy">
            <span>Preview do recibo</span>
            <small>Toque aqui para visualizar</small>
          </div>
          <div className="receipt-preview-mini-shell">
            <div className="receipt-preview-mini" aria-hidden="true">
              <ReceiptDocument model={model} documentRef={documentRef} />
            </div>
          </div>
        </button>
      ) : null}

      <div className={`receipt-preview-expanded-panel ${isGenerated ? "is-visible" : ""}`.trim()} aria-hidden={!isGenerated}>
        <div className="receipt-preview-expanded-copy">
          <div className="receipt-preview-expanded-copy-main">
            <span>Recibo gerado</span>
            <strong>{displayReceiptValue(model.idPag)}</strong>
            <small>PDF pronto para abrir. Toque no documento para ampliar.</small>
          </div>
          <div className="receipt-preview-status-badge">Pronto</div>
        </div>

        <div className="receipt-preview-expanded-stage-shell">
          <ReceiptScaledCanvas
            model={model}
            documentRef={documentRef}
            className="receipt-preview-expanded-stage"
            interactive
            onClick={onExpand}
          />
        </div>

        <div className="receipt-preview-generated-actions">
          <a className="receipt-preview-generated-action is-primary" href={receiptLink ?? "#"} target="_blank" rel="noreferrer">
            Abrir PDF
          </a>
          <span className="receipt-preview-generated-helper">Link pronto e recibo salvo.</span>
        </div>
      </div>
    </article>
  );
}

function ReceiptExpandedPreview({
  model,
  onClose
}: {
  model: PersonalReceiptModel;
  onClose: () => void;
}) {
  const copy = getReceiptCopy(model.idioma);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="receipt-preview-overlay" role="dialog" aria-modal="true" aria-label={copy.expandedPreviewAria} onClick={onClose}>
      <div className="receipt-preview-overlay-shell" onClick={(event) => event.stopPropagation()}>
        <div className="receipt-preview-overlay-topbar">
          <strong>{copy.expandedPreviewTitle}</strong>
          <button type="button" className="receipt-preview-overlay-close" onClick={onClose} aria-label={copy.closeExpandedPreviewAria}>
            X
          </button>
        </div>
        <div className="receipt-preview-overlay-body">
          <ReceiptZoomCanvas model={model} />
        </div>
      </div>
    </div>
  );
}

function clampZoom(value: number) {
  return Math.min(3.2, Math.max(1, value));
}

function getPointerDistance(points: PointerEvent[]) {
  if (points.length < 2) return 0;
  const [first, second] = points;
  return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
}

function ReceiptZoomCanvas({ model }: { model: PersonalReceiptModel }) {
  const copy = getReceiptCopy(model.idioma);
  const baseWidth = 794;
  const baseHeight = 1123;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pointersRef = useRef<Map<number, PointerEvent>>(new Map());
  const lastPinchDistanceRef = useRef(0);
  const panSessionRef = useRef<{ pointerId: number; lastX: number; lastY: number } | null>(null);
  const [fitScale, setFitScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [ready, setReady] = useState(false);
  const scale = fitScale * zoom;

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateScale = () => {
      const availableWidth = Math.max(0, viewport.clientWidth - 24);
      const availableHeight = Math.max(0, viewport.clientHeight - 24);
      if (!availableWidth || !availableHeight) return;
      setFitScale(Math.min(1, availableWidth / baseWidth, availableHeight / baseHeight));
      setReady(true);
    };

    updateScale();

    const resizeObserver = new ResizeObserver(updateScale);
    resizeObserver.observe(viewport);
    window.addEventListener("resize", updateScale);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, []);

  const resetPinch = () => {
    lastPinchDistanceRef.current = 0;
    pointersRef.current.clear();
    panSessionRef.current = null;
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    if (event.pointerType === "touch") {
      pointersRef.current.set(event.pointerId, event.nativeEvent);
      if (pointersRef.current.size > 1) {
        panSessionRef.current = null;
        return;
      }
    }
    panSessionRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" && pointersRef.current.has(event.pointerId)) {
      pointersRef.current.set(event.pointerId, event.nativeEvent);
      const points = Array.from(pointersRef.current.values());
      if (points.length >= 2) {
        panSessionRef.current = null;
        event.preventDefault();
        const distance = getPointerDistance(points);
        const lastDistance = lastPinchDistanceRef.current;
        lastPinchDistanceRef.current = distance;
        if (!lastDistance || !distance) return;
        setZoom((current) => clampZoom(current * (distance / lastDistance)));
        return;
      }
    }

    const viewport = viewportRef.current;
    const panSession = panSessionRef.current;
    if (!viewport || !panSession || panSession.pointerId !== event.pointerId || zoom <= 1.01) return;

    event.preventDefault();
    viewport.scrollLeft -= event.clientX - panSession.lastX;
    viewport.scrollTop -= event.clientY - panSession.lastY;
    panSessionRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY
    };
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) lastPinchDistanceRef.current = 0;
    if (panSessionRef.current?.pointerId === event.pointerId) panSessionRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div className="receipt-zoom-shell">
      <div className="receipt-zoom-controls" aria-label={copy.zoomControlsAria}>
        <button type="button" onClick={() => setZoom((current) => clampZoom(current - 0.25))} disabled={zoom <= 1.01}>
          -
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom((current) => clampZoom(current + 0.25))} disabled={zoom >= 3.19}>
          +
        </button>
      </div>
      <div
        ref={viewportRef}
        className="receipt-zoom-viewport"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={resetPinch}
      >
        <div className="receipt-zoom-stage">
          <div
            className="receipt-fit-frame receipt-zoom-frame"
            style={{
              width: `${baseWidth * scale}px`,
              height: `${baseHeight * scale}px`,
              visibility: ready ? "visible" : "hidden"
            }}
          >
            <div className="receipt-fit-scale" style={{ transform: `scale(${scale})` }}>
              <ReceiptDocument model={model} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReceiptViewport({
  model,
  draft,
  errors,
  generateState,
  receiptLink,
  clienteOptions,
  metodoPagamentoOptions,
  toast,
  documentRef,
  onDraftChange,
  onGenerate,
  onDismissToast,
  onBack,
  title,
  screenLabel
}: {
  model: PersonalReceiptModel;
  draft?: PersonalReceiptEditableDraft;
  errors?: ReceiptDraftErrors;
  generateState?: ActionButtonState;
  receiptLink?: string | null;
  clienteOptions?: string[];
  toast?: ToastState | null;
  documentRef?: RefObject<HTMLElement>;
  onDraftChange?: (field: ReceiptDraftKey, value: string) => void;
  onGenerate?: () => void;
  onDismissToast?: () => void;
  onBack?: () => void;
  title: string;
  screenLabel: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const openExpandedPreview = () => setIsExpanded(true);

  const closeExpandedPreview = () => {
    setIsExpanded(false);
  };

  return (
    <AppShell screenLabel={screenLabel}>
      <FormMenu title={title} onBack={onBack} />
      <section className="main-panel receipt-main receipt-editor-main">
        <div className={`receipt-editor-layout ${receiptLink ? "is-generated" : ""}`.trim()}>
          <ReceiptPreview model={model} documentRef={documentRef} onExpand={openExpandedPreview} receiptLink={receiptLink} />
          {draft && onDraftChange && onGenerate && !receiptLink ? (
            <ReceiptForm
              draft={draft}
              errors={errors ?? {}}
              generateState={generateState ?? "idle"}
              clienteOptions={clienteOptions}
              receiptLink={receiptLink}
              onChange={onDraftChange}
              onGenerate={onGenerate}
            />
          ) : null}
        </div>
      </section>
      {toast ? <LocalToast toast={toast} onDismiss={onDismissToast ?? (() => undefined)} /> : null}
      {isExpanded ? <ReceiptExpandedPreview model={model} onClose={closeExpandedPreview} /> : null}
    </AppShell>
  );
}

export function ReceiptScreen({
  detail,
  onBack,
  clienteOptions = [],
  metodoPagamentoOptions = [],
  onProgress
}: ReceiptScreenProps) {
  const [draft, setDraft] = useState<PersonalReceiptEditableDraft>(() => buildPersonalReceiptDraft(detail));
  const [errors, setErrors] = useState<ReceiptDraftErrors>({});
  const [toast, setToast] = useState<ToastState | null>(null);
  const [receiptLink, setReceiptLink] = useState<string | null>(null);
  const [generatedIdentifier, setGeneratedIdentifier] = useState("");
  const [generateState, setGenerateState] = useState<ActionButtonState>("idle");
  const receiptDocumentRef = useRef<HTMLElement | null>(null);
  const receiptPdfCacheRef = useRef<{ key: string; blob: Blob } | null>(null);
  const localReceiptLinkRef = useRef<string | null>(null);
  const model = useMemo(
    () => buildPersonalReceiptModel(detail, draft, generatedIdentifier ? { receiptIdentifier: generatedIdentifier } : {}),
    [detail, draft, generatedIdentifier]
  );

  const clearLocalReceiptLink = () => {
    if (localReceiptLinkRef.current) {
      URL.revokeObjectURL(localReceiptLinkRef.current);
      localReceiptLinkRef.current = null;
    }
  };

  const resetReceiptLink = () => {
    clearLocalReceiptLink();
    setReceiptLink(null);
  };

  useEffect(() => {
    setDraft(buildPersonalReceiptDraft(detail));
    setErrors({});
    setToast(null);
    resetReceiptLink();
    setGeneratedIdentifier("");
    setGenerateState("idle");
    receiptPdfCacheRef.current = null;
  }, [detail]);

  useEffect(() => () => {
    clearLocalReceiptLink();
  }, []);

  useEffect(() => {
    if (Object.keys(validateReceiptDraft(draft)).length > 0) {
      receiptPdfCacheRef.current = null;
      return;
    }

    let cancelled = false;
    const cacheKey = JSON.stringify(model);
    const timeoutId = window.setTimeout(() => {
      void generateReceiptPdfBlob(model)
        .then((blob) => {
          if (!cancelled) receiptPdfCacheRef.current = { key: cacheKey, blob };
        })
        .catch(() => {
          if (!cancelled) receiptPdfCacheRef.current = null;
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [draft, model]);

  const updateField = (field: ReceiptDraftKey, value: string) => {
    const nextValue = field === "valorTotal" ? sanitizeReceiptTotalInput(value) : value;
    setDraft((current) => ({ ...current, [field]: nextValue }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    resetReceiptLink();
    setGeneratedIdentifier("");
  };

  const ensureValidDraft = () => {
    const nextErrors = validateReceiptDraft(draft);
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleGenerate = () => {
    if (!ensureValidDraft()) {
      setToast(nextToast("Preencha todos os campos antes de continuar.", "warning"));
      return;
    }

    setGenerateState("loading");
    onProgress?.({ message: "Gerando recibo personalizado", phase: "loading" });

    void (async () => {
      if (!hasDataverseRuntime()) {
        onProgress?.({ message: "Montando recibo local para localhost", phase: "loading" });
        const cacheKey = JSON.stringify(model);
        const cachedBlob = receiptPdfCacheRef.current?.key === cacheKey ? receiptPdfCacheRef.current.blob : null;
        const blob = cachedBlob ?? await generateReceiptPdfBlob(model);
        receiptPdfCacheRef.current = { key: cacheKey, blob };
        const localLink = URL.createObjectURL(blob);
        clearLocalReceiptLink();
        localReceiptLinkRef.current = localLink;
        setGeneratedIdentifier(model.idPag);
        setReceiptLink(localLink);
        setGenerateState("success");
        onProgress?.({ message: "Recibo local pronto para abertura.", phase: "success" });
        setToast(nextToast("Recibo gerado localmente. Abra o PDF.", "success"));
        window.setTimeout(() => setGenerateState("idle"), 1400);
        window.setTimeout(() => onProgress?.(null), 1600);
        return;
      }

      const prepared = await createReceiptRecordRemote({
        detail,
        model,
        onProgress: (message) => {
          onProgress?.({ message, phase: "loading" });
        }
      });
      setGeneratedIdentifier(prepared.identifier);
      onProgress?.({ message: `Montando recibo ${prepared.identifier}`, phase: "loading" });
      const blob = await generateReceiptPdfBlob(prepared.model);
      receiptPdfCacheRef.current = { key: JSON.stringify(prepared.model), blob };
      const result = await ensureReceiptUploaded(prepared, blob);
      setReceiptLink(result.link);
      setGenerateState("success");
      onProgress?.({ message: "Recibo pronto para abertura.", phase: "success" });
      setToast(nextToast("Recibo gerado. Abra o link do PDF.", "success"));
      window.setTimeout(() => setGenerateState("idle"), 1400);
      window.setTimeout(() => onProgress?.(null), 1600);
    })().catch((error) => {
      reportAppError(error, {
        severity: "error",
        source: "receipt",
        action: "generate-pdf-link",
        component: "ReceiptScreen",
        screen: "TelaReciboPersonalizado",
        detailId: detail?.id
      });
      const message = error instanceof Error ? error.message : "Falha ao gerar o recibo em PDF.";
      setGenerateState("idle");
      onProgress?.(null);
      setToast(nextToast(message, "error"));
    });
  };

  const ensureReceiptUploaded = async (prepared: PreparedReceiptUpload, blob: Blob): Promise<ReceiptPdfUploadResult> => {
    return uploadReceiptPdfRemote({
      prepared,
      pdfBlob: blob,
      onProgress: (message) => {
        onProgress?.({ message, phase: "loading" });
      }
    });
  };

  return (
    <ReceiptViewport
      model={model}
      draft={draft}
      errors={errors}
      generateState={generateState}
      clienteOptions={clienteOptions}
      metodoPagamentoOptions={metodoPagamentoOptions}
      receiptLink={receiptLink}
      toast={toast}
      documentRef={receiptDocumentRef}
      onDraftChange={updateField}
      onGenerate={handleGenerate}
      onDismissToast={() => setToast(null)}
      onBack={onBack}
      title="Recibo personalizado"
      screenLabel="TelaReciboPersonalizado"
    />
  );
}

const PREVIEW_MODEL: PersonalReceiptModel = {
  idOp: "OP-301",
  nomePagante: "Renan Batista de Souza",
  cliente: "Tenaris",
  idioma: "pt-BR",
  idPag: "R-0012",
  dataEmissao: "15/06/2026",
  metodoPagamento: "Cartão de Crédito",
  periodo: "15/06/2026 08:30",
  trajetos: "Hotel -> Tenaris\nTenaris -> Aeroporto de Guarulhos",
  valorTotal: "R$ 1.020,50",
  observacoes: "Motorista bilíngue solicitado.\nApresentação 15 minutos antes do horário."
};

export function ReceiptPreviewScreen({ onBack }: { onBack?: () => void }) {
  return <ReceiptViewport model={PREVIEW_MODEL} onBack={onBack} title="Preview do recibo" screenLabel="TelaPreviewRecibo" />;
}




