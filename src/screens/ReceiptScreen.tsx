import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import logoBetinhosB from "../../Logo Betinhos B.png";
import logoBetinhosPreta from "../../Logo Betinhos Preta.png";
import nlaLogo from "../../NLA.jpg";
import qrCodeAvaliacao from "../../QrCode-Avaliação.png";
import invoiceReceiptIcon from "../assets/icons/invoice-receipt.svg";
import { ActionBar, ActionButton, type ActionButtonState } from "../components/common/ActionButton";
import { LocalToast, type ToastState, type ToastTone } from "../components/common/LocalToast";
import { AppShell } from "../components/layout/AppShell";
import { FormMenu } from "../components/navigation/FormMenu";
import { reportAppError } from "../lib/appErrorLogger";
import { uploadReceiptPdfRemote, type ReceiptPdfUploadResult } from "../lib/dataverse";
import { buildPersonalReceiptDraft, buildPersonalReceiptModel, type PersonalReceiptEditableDraft, type PersonalReceiptModel } from "../lib/personalReceipt";
import { generateReceiptPdfBlob } from "../lib/receiptPdf";
import type { DetailData } from "../types";

type ReceiptScreenProps = {
  detail: DetailData;
  onBack: () => void;
};

type ReceiptDraftKey = keyof PersonalReceiptEditableDraft;
type ReceiptDraftErrors = Partial<Record<ReceiptDraftKey, string>>;

function nextToast(message: string, tone: ToastTone): ToastState {
  return { id: Date.now() + Math.random(), message, tone };
}

function buildReceiptPdfFileName(model: PersonalReceiptModel) {
  const safeId = (model.idPag || "recibo").replace(/[^\w-]+/g, "-");
  return `${safeId}.pdf`;
}

function validateReceiptDraft(draft: PersonalReceiptEditableDraft) {
  const errors: ReceiptDraftErrors = {};
  if (!draft.nomePagante.trim()) errors.nomePagante = "Informe o pagante.";
  if (!draft.cliente.trim()) errors.cliente = "Informe o cliente.";
  if (!draft.valorTotal.trim()) errors.valorTotal = "Informe o total.";
  if (!draft.dataEmissao.trim()) errors.dataEmissao = "Informe a data de emissão.";
  if (!draft.metodoPagamento.trim()) errors.metodoPagamento = "Informe o método de pagamento.";
  return errors;
}

function ReceiptForm({
  draft,
  errors,
  generateState,
  receiptLink,
  onChange,
  onGenerate
}: {
  draft: PersonalReceiptEditableDraft;
  errors: ReceiptDraftErrors;
  generateState: ActionButtonState;
  receiptLink?: string | null;
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
            <div className={`finalize-input-block receipt-editor-block receipt-editor-block-span-2 ${errors.nomePagante ? "is-invalid" : ""}`}>
              <label>Pagante</label>
              <input value={draft.nomePagante} onChange={(event) => onChange("nomePagante", event.target.value)} />
              {errors.nomePagante ? <div className="field-error">{errors.nomePagante}</div> : null}
            </div>
            <div className={`finalize-input-block receipt-editor-block receipt-editor-block-span-2 ${errors.cliente ? "is-invalid" : ""}`}>
              <label>Cliente</label>
              <input value={draft.cliente} onChange={(event) => onChange("cliente", event.target.value)} />
              {errors.cliente ? <div className="field-error">{errors.cliente}</div> : null}
            </div>
            <div className={`finalize-input-block receipt-editor-block ${errors.valorTotal ? "is-invalid" : ""}`}>
              <label>Total</label>
              <input value={draft.valorTotal} onChange={(event) => onChange("valorTotal", event.target.value)} />
              {errors.valorTotal ? <div className="field-error">{errors.valorTotal}</div> : null}
            </div>
            <div className={`finalize-input-block receipt-editor-block ${errors.dataEmissao ? "is-invalid" : ""}`}>
              <label>Data de emissão</label>
              <input value={draft.dataEmissao} onChange={(event) => onChange("dataEmissao", event.target.value)} />
              {errors.dataEmissao ? <div className="field-error">{errors.dataEmissao}</div> : null}
            </div>
            <div className={`finalize-input-block receipt-editor-block receipt-editor-block-span-2 ${errors.metodoPagamento ? "is-invalid" : ""}`}>
              <label>Método de pagamento</label>
              <input value={draft.metodoPagamento} onChange={(event) => onChange("metodoPagamento", event.target.value)} />
              {errors.metodoPagamento ? <div className="field-error">{errors.metodoPagamento}</div> : null}
            </div>
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
  return (
    <article ref={documentRef} className="receipt-document" aria-label={`Recibo ${model.idPag}`}>
      <header className="receipt-header">
        <div className="receipt-header-main">
          <div className="receipt-header-title">INVOICE</div>
          <img className="receipt-header-logo" src={logoBetinhosB} alt="Betinhos B" />
        </div>
        <div className="receipt-header-note">
          <div className="receipt-header-note-text">Obrigado por escolher seu recibo digital, você faz parte da solução!</div>
          <div className="receipt-header-note-id">{model.idOp}</div>
        </div>
      </header>

      <section className="receipt-summary">
        <div className="receipt-summary-main">
          <div className="receipt-party-name">{model.nomePagante}</div>
          <div className="receipt-party-client">{model.cliente}</div>
        </div>
        <div className="receipt-summary-meta">
          <div className="receipt-meta-labels">
            <div>Identificação</div>
            <div>Data de Emissão</div>
            <div>Método de Pagamento</div>
          </div>
          <div className="receipt-meta-values">
            <div>{model.idPag}</div>
            <div>{model.dataEmissao}</div>
            <div>{model.metodoPagamento}</div>
          </div>
        </div>
      </section>

      <section className="receipt-body">
        <div className="receipt-block receipt-description-head">
          <div className="receipt-description-title">Descrição</div>
        </div>

        <div className="receipt-block receipt-description-body">
          <p>
            Serviço(s) de transporte terrestre executivo prestado(s) no período de <strong>{model.periodo}</strong>.
          </p>
          <p className="receipt-trajetos-title">Viagens percorridas nos seguintes trajetos:</p>
          <div className="receipt-trajetos-text">{model.trajetos}</div>
        </div>

        <div className="receipt-total-row">
          <div className="receipt-total-thanks">Obrigado por viajar com a Betinhos</div>
          <div className="receipt-total-label">Total</div>
          <div className="receipt-total-value">{model.valorTotal}</div>
        </div>

        <div className="receipt-observations-row">
          <div className="receipt-observations">
            <div className="receipt-observations-label">Observações:</div>
            <div className="receipt-observations-text">{model.observacoes}</div>
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
              <div className="receipt-qr-caption">Avalie sua experiência</div>
            </div>
          </div>
        </div>

        <div className="receipt-footer-separator" />

        <div className="receipt-footer-contacts">
          <div className="receipt-contact-row">
            <div className="receipt-contact-name">Junior de Paula</div>
            <div className="receipt-contact-role">Concierge (Bilingual)</div>
            <div className="receipt-contact-phone">+55 12 99723 6961</div>
            <div className="receipt-contact-email">junior@betinhos.com.br</div>
          </div>
          <div className="receipt-contact-row">
            <div className="receipt-contact-name">Deborah Keila</div>
            <div className="receipt-contact-role">Operations Manager</div>
            <div className="receipt-contact-phone">+55 12 99615 9093</div>
            <div className="receipt-contact-email">deborah.keila@betinhos.com.br</div>
          </div>
          <div className="receipt-contact-row">
            <div className="receipt-contact-name">Juliana Rodrigues</div>
            <div className="receipt-contact-role">Finance Manager</div>
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
      <div className="receipt-stage">
        <div
          className="receipt-fit-frame"
          style={{
            width: `${baseWidth * scale}px`,
            height: `${baseHeight * scale}px`,
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
  onExpand
}: {
  model: PersonalReceiptModel;
  documentRef?: RefObject<HTMLElement>;
  onExpand: () => void;
}) {
  return (
    <article className="receipt-card-shell receipt-preview-card">
      <div className="receipt-preview-title">
        <span>Preview do recibo</span>
        <small>Clique para ampliar</small>
      </div>
      <ReceiptScaledCanvas model={model} documentRef={documentRef} interactive onClick={onExpand} />
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
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="receipt-preview-overlay" role="dialog" aria-modal="true" aria-label="Preview ampliado do recibo" onClick={onClose}>
      <div className="receipt-preview-overlay-shell" onClick={(event) => event.stopPropagation()}>
        <div className="receipt-preview-overlay-topbar">
          <div>
            <strong>Preview ampliado</strong>
          </div>
          <button type="button" className="receipt-preview-overlay-close" onClick={onClose}>
            Fechar
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
  const baseWidth = 794;
  const baseHeight = 1123;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pointersRef = useRef<Map<number, PointerEvent>>(new Map());
  const lastPinchDistanceRef = useRef(0);
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
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, event.nativeEvent);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch" || !pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, event.nativeEvent);
    const points = Array.from(pointersRef.current.values());
    if (points.length < 2) return;

    event.preventDefault();
    const distance = getPointerDistance(points);
    const lastDistance = lastPinchDistanceRef.current;
    lastPinchDistanceRef.current = distance;
    if (!lastDistance || !distance) return;
    setZoom((current) => clampZoom(current * (distance / lastDistance)));
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) lastPinchDistanceRef.current = 0;
  };

  return (
    <div className="receipt-zoom-shell">
      <div className="receipt-zoom-controls" aria-label="Controle de zoom do recibo">
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
  detail,
  model,
  draft,
  errors,
  generateState,
  receiptLink,
  toast,
  documentRef,
  onDraftChange,
  onGenerate,
  onDismissToast,
  onBack,
  title,
  screenLabel
}: {
  detail?: DetailData;
  model: PersonalReceiptModel;
  draft?: PersonalReceiptEditableDraft;
  errors?: ReceiptDraftErrors;
  generateState?: ActionButtonState;
  receiptLink?: string | null;
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
        <div className="receipt-editor-layout">
          {detail && draft && onDraftChange && onGenerate ? (
            <ReceiptForm
              draft={draft}
              errors={errors ?? {}}
              generateState={generateState ?? "idle"}
              receiptLink={receiptLink}
              onChange={onDraftChange}
              onGenerate={onGenerate}
            />
          ) : null}
          <ReceiptPreview model={model} documentRef={documentRef} onExpand={openExpandedPreview} />
        </div>
      </section>
      {toast ? <LocalToast toast={toast} onDismiss={onDismissToast ?? (() => undefined)} /> : null}
      {isExpanded ? <ReceiptExpandedPreview model={model} onClose={closeExpandedPreview} /> : null}
    </AppShell>
  );
}

export function ReceiptScreen({ detail, onBack }: ReceiptScreenProps) {
  const [draft, setDraft] = useState<PersonalReceiptEditableDraft>(() => buildPersonalReceiptDraft(detail));
  const [errors, setErrors] = useState<ReceiptDraftErrors>({});
  const [toast, setToast] = useState<ToastState | null>(null);
  const [receiptLink, setReceiptLink] = useState<string | null>(null);
  const [generateState, setGenerateState] = useState<ActionButtonState>("idle");
  const receiptDocumentRef = useRef<HTMLElement | null>(null);
  const receiptPdfCacheRef = useRef<{ key: string; blob: Blob } | null>(null);
  const receiptUploadCacheRef = useRef<{ key: string; result: ReceiptPdfUploadResult } | null>(null);
  const model = useMemo(() => buildPersonalReceiptModel(detail, draft), [detail, draft]);

  useEffect(() => {
    setDraft(buildPersonalReceiptDraft(detail));
    setErrors({});
    setToast(null);
    setReceiptLink(null);
    setGenerateState("idle");
    receiptPdfCacheRef.current = null;
    receiptUploadCacheRef.current = null;
  }, [detail]);

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
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setReceiptLink(null);
    receiptUploadCacheRef.current = null;
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

    void (async () => {
      const cacheKey = JSON.stringify(model);
      const cachedPdf = receiptPdfCacheRef.current;
      const blob = cachedPdf?.key === cacheKey ? cachedPdf.blob : await generateReceiptPdfBlob(model);
      receiptPdfCacheRef.current = { key: cacheKey, blob };
      const fileName = buildReceiptPdfFileName(model);
      const result = await ensureReceiptUploaded(blob, fileName, cacheKey);
      setReceiptLink(result.link);
      setGenerateState("success");
      setToast(nextToast("Recibo gerado. Abra o link do PDF.", "success"));
      window.setTimeout(() => setGenerateState("idle"), 1400);
    })().catch((error) => {
      reportAppError(error, {
        severity: "error",
        source: "receipt",
        action: "generate-pdf-link",
        component: "ReceiptScreen",
        screen: "TelaReciboPersonalizado",
        detailId: detail.id
      });
      const message = error instanceof Error ? error.message : "Falha ao gerar o recibo em PDF.";
      setGenerateState("idle");
      setToast(nextToast(message, "error"));
    });
  };

  const ensureReceiptUploaded = async (blob: Blob, fileName: string, cacheKey: string) => {
    const cachedUpload = receiptUploadCacheRef.current;
    if (cachedUpload?.key === cacheKey) return cachedUpload.result;

    const result = await uploadReceiptPdfRemote({
      detail,
      model,
      pdfBlob: blob,
      fileName
    });
    receiptUploadCacheRef.current = { key: cacheKey, result };
    return result;
  };

  return (
    <ReceiptViewport
      detail={detail}
      model={model}
      draft={draft}
      errors={errors}
      generateState={generateState}
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
  idPag: "PAG-0012",
  dataEmissao: "15/06/2026",
  metodoPagamento: "Pedido de Compra",
  periodo: "15/06/2026 08:30",
  trajetos: "Hotel -> Tenaris\nTenaris -> Aeroporto de Guarulhos",
  valorTotal: "R$ 1.020,50",
  observacoes: "Motorista bilíngue solicitado.\nApresentação 15 minutos antes do horário."
};

export function ReceiptPreviewScreen({ onBack }: { onBack?: () => void }) {
  return <ReceiptViewport model={PREVIEW_MODEL} onBack={onBack} title="Preview do recibo" screenLabel="TelaPreviewRecibo" />;
}
