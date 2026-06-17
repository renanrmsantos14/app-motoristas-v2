import { useEffect, useMemo, useRef, useState } from "react";
import invoiceReceiptIcon from "../assets/icons/invoice-receipt.svg";
import { ActionBar, ActionButton, type ActionButtonState } from "../components/common/ActionButton";
import { LocalToast, type ToastState } from "../components/common/LocalToast";
import { SearchableSelect } from "../components/common/SearchableSelect";
import { SystemIcon } from "../components/icons/SystemIcon";
import { agendaMock, historyMock } from "../data/mockData";
import { createEmptyCollisionDraft, type CollisionDraft, type CollisionPhoto, type CollisionPhotoKind } from "../lib/collisions";
import type { MaintenanceRequestVehicleOption } from "../lib/dataverse";
import { DEFAULT_EXPENSE_REFERENCE_DATA } from "../lib/expenses.defaults";
import type { ExpenseDraft, ExpensePhoto, ExpenseReferenceData } from "../lib/expenses.types";
import type { MaintenancePhotoKind, DetailData } from "../types";
import { CollisionScreen } from "./CollisionScreen";
import { CollisionStartScreen } from "./CollisionStartScreen";
import { DetailsScreen } from "./DetailsScreen";
import { ExpenseScreen } from "./ExpenseScreen";
import { FinalizeScreen, type MaintenanceFinalizeDraft } from "./FinalizeScreen";
import { HistoryDetailsScreen } from "./HistoryDetailsScreen";
import { HistoryScreen } from "./HistoryScreen";
import { InitialScreen } from "./InitialScreen";
import { LocalCancelScreen } from "./LocalCancelScreen";
import { MaintenancePhotoPreviewScreen } from "./MaintenancePhotoPreviewScreen";
import {
  MaintenanceRequestScreen,
  type MaintenanceRequestDraft,
  type MaintenanceRequestPhoto
} from "./MaintenanceRequestScreen";
import { ReceiveScreen } from "./ReceiveScreen";
import { ReceiptPreviewScreen } from "./ReceiptScreen";
import { ServicesScreen } from "./ServicesScreen";
import { SignatureScreen } from "./SignatureScreen";
import { VoucherScreen } from "./VoucherScreen";

type PreviewButtonId =
  | "variants-primary"
  | "variants-secondary"
  | "variants-danger"
  | "icons-primary"
  | "icons-secondary"
  | "icons-danger"
  | "bar-secondary"
  | "bar-primary"
  | "receipt"
  | "receipt-secondary"
  | "receipt-primary"
  | "danger-secondary"
  | "danger-primary";

type PreviewStates = Record<PreviewButtonId, ActionButtonState>;

type DemoId =
  | "buttons"
  | "selects"
  | "toasts"
  | "initial"
  | "services"
  | "details"
  | "receive"
  | "voucher"
  | "signature"
  | "finalize"
  | "maintenance-request"
  | "expense"
  | "collision-start"
  | "collision"
  | "cancel"
  | "history"
  | "history-details"
  | "photo-preview"
  | "receipt-preview";

type DemoGroup = {
  title: string;
  items: Array<{ id: DemoId; label: string; note: string }>;
};

type ButtonPreviewScreenProps = {
  onShowToast?: (message: string) => void;
};

const INITIAL_STATES: PreviewStates = {
  "variants-primary": "idle",
  "variants-secondary": "idle",
  "variants-danger": "idle",
  "icons-primary": "idle",
  "icons-secondary": "idle",
  "icons-danger": "idle",
  "bar-secondary": "idle",
  "bar-primary": "idle",
  receipt: "idle",
  "receipt-secondary": "idle",
  "receipt-primary": "idle",
  "danger-secondary": "idle",
  "danger-primary": "idle"
};

const DEMO_DELAY_MS = 900;

const PREVIEW_GROUPS: DemoGroup[] = [
  {
    title: "Componentes",
    items: [
      { id: "buttons", label: "Botoes", note: "Estados, icones e action bars" },
      { id: "selects", label: "Selects", note: "Searchable select e filtros" },
      { id: "toasts", label: "Toasts", note: "Mensagens reais do app" },
      { id: "photo-preview", label: "Preview de foto", note: "Confirmacao, delete e mock media" }
    ]
  },
  {
    title: "Fluxos",
    items: [
      { id: "initial", label: "Tela inicial", note: "Cards e atalhos do app" },
      { id: "services", label: "Servicos", note: "Lista ativa com cards" },
      { id: "details", label: "Detalhes", note: "Acao principal e scroll hint" },
      { id: "receive", label: "Receber", note: "Comprovantes e recibo" },
      { id: "voucher", label: "Voucher", note: "Tempos, assinatura e rascunho" },
      { id: "signature", label: "Assinatura", note: "Canvas editavel" },
      { id: "finalize", label: "Finalizar", note: "Servico, troca e manutencao" },
      { id: "cancel", label: "Cancelado local", note: "Texto e CTA destrutivo" }
    ]
  },
  {
    title: "Operacao",
    items: [
      { id: "maintenance-request", label: "Solicitar manutencao", note: "Campos, fotos e erros" },
      { id: "expense", label: "Gastos", note: "Regras dinamicas por categoria" },
      { id: "collision-start", label: "Inicio colisao", note: "Escolha do tipo" },
      { id: "collision", label: "Registro de colisao", note: "Terceiro, evidencias e validacao" }
    ]
  },
  {
    title: "Historico",
    items: [
      { id: "history", label: "Historico", note: "Busca e cards finalizados" },
      { id: "history-details", label: "Detalhe historico", note: "Visualizacao finalizada" },
      { id: "receipt-preview", label: "Recibo", note: "Preview ampliavel para CSS/HTML" }
    ]
  }
];

const REAL_TOAST_PRESETS = [
  { label: "Dataverse carregado", message: "Atualizado do Dataverse." },
  { label: "Gasto registrado", message: "Gasto registrado." },
  { label: "Assinatura salva", message: "Assinatura salva localmente." },
  { label: "Info operacional", message: "Carregando Dataverse." },
  { label: "Fila bloqueada", message: "Conclua os itens anteriores da fila antes de prosseguir." },
  { label: "Recibo indisponivel", message: "Recibo personalizado ainda nao foi configurado." },
  { label: "Servico ausente", message: "Servico remoto nao encontrado." },
  { label: "Falha Dataverse", message: "Falha ao carregar Dataverse." },
  { label: "Falha veiculos", message: "Falha ao carregar veiculos." },
  { label: "Foto apagada", message: "Foto apagada." },
  { label: "Cancelamento enviado", message: "Cancelamento enviado para analise." },
  { label: "Dados reiniciados", message: "Dados locais reiniciados." }
] as const;

const PREVIEW_TOAST: ToastState = {
  id: 1,
  tone: "success",
  message: "Flow enviado. Mantenha esta tela aberta enquanto a operacao termina."
};

const PREVIEW_VEHICLES: MaintenanceRequestVehicleOption[] = [
  { id: "veh-corolla", label: "Corolla Preto ABC1D23", isCurrent: true },
  { id: "veh-civic", label: "Civic Prata XYZ9A87", isCurrent: false },
  { id: "veh-van", label: "Van Executiva QWE5R67", isCurrent: false }
];

const PREVIEW_EXPENSE_REFERENCE_DATA: ExpenseReferenceData = {
  ...DEFAULT_EXPENSE_REFERENCE_DATA,
  cities: [
    { id: "city-sjc", name: "Sao Jose dos Campos", uf: "SP", pais: "Brasil", codigoIbge: "3549904", order: 10 },
    { id: "city-sp", name: "Sao Paulo", uf: "SP", pais: "Brasil", codigoIbge: "3550308", order: 20 },
    { id: "city-gru", name: "Guarulhos", uf: "SP", pais: "Brasil", codigoIbge: "3518800", order: 30 }
  ]
};

const SERVICE_DETAIL = agendaMock.find((item) => item.detail?.type === "SERVICO")?.detail as DetailData;
const EXCHANGE_DETAIL = agendaMock.find((item) => item.detail?.type === "TROCA")?.detail as DetailData;
const MAINTENANCE_DETAIL = agendaMock.find((item) => item.detail?.type === "MANUTENCAO")?.detail as DetailData;
const HISTORY_DETAIL = historyMock.find((item) => item.detail?.type === "SERVICO")?.detail as DetailData;

function svgDataUrl(title: string, bg: string, fg: string, accent = "") {
  const safeAccent = accent || title;
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="620" viewBox="0 0 900 620">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${bg}" />
          <stop offset="100%" stop-color="${fg}" />
        </linearGradient>
      </defs>
      <rect width="900" height="620" rx="32" fill="url(#g)"/>
      <rect x="38" y="38" width="824" height="544" rx="24" fill="rgba(255,255,255,0.13)" stroke="rgba(255,255,255,0.28)"/>
      <text x="64" y="120" fill="#ffffff" font-family="Manrope" font-size="54" font-weight="700">${title}</text>
      <text x="64" y="188" fill="rgba(255,255,255,0.82)" font-family="Manrope" font-size="28">${safeAccent}</text>
      <rect x="64" y="244" width="270" height="180" rx="18" fill="rgba(255,255,255,0.14)"/>
      <rect x="364" y="244" width="472" height="36" rx="12" fill="rgba(255,255,255,0.14)"/>
      <rect x="364" y="304" width="426" height="24" rx="12" fill="rgba(255,255,255,0.12)"/>
      <rect x="364" y="344" width="448" height="24" rx="12" fill="rgba(255,255,255,0.12)"/>
      <rect x="364" y="384" width="390" height="24" rx="12" fill="rgba(255,255,255,0.12)"/>
      <rect x="64" y="470" width="210" height="44" rx="14" fill="rgba(255,255,255,0.18)"/>
      <text x="88" y="500" fill="#ffffff" font-family="Manrope" font-size="24" font-weight="700">Mock data preview</text>
    </svg>`
  )}`;
}

function buildExpensePhotos(): ExpensePhoto[] {
  return [
    {
      id: "expense-photo-1",
      dataUrl: svgDataUrl("Comprovante", "#245c73", "#0c2430", "Posto Shell - R$ 238,70"),
      mediaType: "foto"
    },
    {
      id: "expense-photo-2",
      dataUrl: svgDataUrl("Cupom", "#6b5032", "#2d1f13", "Estacionamento - 6h"),
      mediaType: "foto"
    }
  ];
}

function buildReceivePhotos(): ExpensePhoto[] {
  return [
    {
      id: "receive-photo-1",
      dataUrl: svgDataUrl("PIX recebido", "#177245", "#0a2e1d", "Comprovante PDF mockado em imagem"),
      mediaType: "foto"
    }
  ];
}

function buildMaintenanceRequestPhotos(): MaintenanceRequestPhoto[] {
  return [
    {
      id: "maintenance-request-photo-1",
      dataUrl: svgDataUrl("Pneu", "#5a4c7a", "#271d3a", "Corte lateral e bolha"),
      mediaType: "foto"
    }
  ];
}

function buildCollisionPhotos(includeThirdParty: boolean): CollisionPhoto[] {
  const basePhotos: CollisionPhoto[] = [
    {
      id: "collision-photo-scene",
      kind: "cena",
      dataUrl: svgDataUrl("Local", "#5a1f2d", "#16070b", "Av. Paulista - faixa da direita"),
      mediaType: "foto"
    },
    {
      id: "collision-photo-betinhos",
      kind: "danoBetinhos",
      dataUrl: svgDataUrl("Veiculo Betinhos", "#243b5e", "#0a1628", "Parachoque traseiro"),
      mediaType: "foto"
    },
    {
      id: "collision-photo-extra",
      kind: "extra",
      dataUrl: svgDataUrl("Complementar", "#465469", "#171d25", "Contexto do local"),
      mediaType: "foto"
    }
  ];

  if (!includeThirdParty) return basePhotos;

  return basePhotos.concat([
    {
      id: "collision-photo-third-damage",
      kind: "danoTerceiro",
      dataUrl: svgDataUrl("CNH terceiro", "#6c3a21", "#241108", "Documento mock"),
      mediaType: "foto"
    },
    {
      id: "collision-photo-third-document",
      kind: "documentoTerceiro",
      dataUrl: svgDataUrl("Documento veiculo", "#2d614c", "#10241b", "CRLV mock"),
      mediaType: "foto"
    }
  ]);
}

function buildMaintenanceFinalizePhotos(): Partial<Record<MaintenancePhotoKind, string>> {
  return {
    NOTAFISCAL: svgDataUrl("Nota fiscal", "#6a5522", "#251d09", "Auto Center Vila Olimpia"),
    FOTO1: svgDataUrl("Manutencao", "#344b7f", "#10182c", "Freio dianteiro"),
    FOTO2: svgDataUrl("Manutencao", "#344b7f", "#10182c", "Pastilha nova")
  };
}

function PreviewSection({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="preview-lab-section">
      <div className="preview-lab-section-head">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function PreviewControl({
  label,
  active,
  onClick
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`preview-lab-chip ${active ? "is-active" : ""}`} onClick={onClick}>
      {label}
    </button>
  );
}

function PreviewNav({
  selectedDemo,
  onSelect
}: {
  selectedDemo: DemoId;
  onSelect: (demo: DemoId) => void;
}) {
  return (
    <aside className="preview-lab-nav">
      <div className="preview-lab-brand">
        <span>Dev only</span>
        <strong>Preview Lab</strong>
        <small>`#preview` ou `?dev=preview`</small>
      </div>
      {PREVIEW_GROUPS.map((group) => (
        <div key={group.title} className="preview-lab-nav-group">
          <div className="preview-lab-nav-title">{group.title}</div>
          {group.items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`preview-lab-nav-item ${selectedDemo === item.id ? "is-active" : ""}`}
              onClick={() => onSelect(item.id)}
            >
              <strong>{item.label}</strong>
              <span>{item.note}</span>
            </button>
          ))}
        </div>
      ))}
    </aside>
  );
}

export function ButtonPreviewScreen({ onShowToast }: ButtonPreviewScreenProps) {
  const [selectedDemo, setSelectedDemo] = useState<DemoId>("buttons");
  const [states, setStates] = useState<PreviewStates>(INITIAL_STATES);
  const [inlineToast, setInlineToast] = useState<ToastState | null>(PREVIEW_TOAST);
  const [submitState, setSubmitState] = useState<ActionButtonState>("idle");
  const [canGeneratePersonalReceipt, setCanGeneratePersonalReceipt] = useState(true);
  const [hasSignature, setHasSignature] = useState(false);
  const [showFilledPhotos, setShowFilledPhotos] = useState(true);
  const [showDeleteOnly, setShowDeleteOnly] = useState(false);
  const [showCollisionThirdParty, setShowCollisionThirdParty] = useState(true);
  const [activeDetailKind, setActiveDetailKind] = useState<"service" | "exchange" | "maintenance">("service");
  const [activeFinalizeKind, setActiveFinalizeKind] = useState<"service" | "exchange" | "maintenance">("maintenance");
  const [maintenanceRequestDraft, setMaintenanceRequestDraft] = useState<MaintenanceRequestDraft>({
    descricao: "Ruido no freio dianteiro ao reduzir a velocidade.",
    kmAtual: "58230",
    veiculoId: PREVIEW_VEHICLES[0].id,
    gravidade: "3"
  });
  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft>({
    categoriaId: "local-abastecimento",
    veiculoId: PREVIEW_VEHICLES[0].id,
    valor: "238,70",
    dataGasto: new Date().toISOString().slice(0, 10),
    formaPagamentoId: "local-ticketlog",
    cidadeId: "city-sjc",
    estabelecimento: "Posto Shell Colinas",
    descricao: "Abastecimento antes de viagem executiva.",
    kmInformado: "58230",
    litros: "42,5"
  });
  const [collisionDraft, setCollisionDraft] = useState<CollisionDraft>(() => ({
    ...createEmptyCollisionDraft(new Date("2026-06-16T10:30:00")),
    tipoOcorrencia: "eu_bati",
    local: "Av. Paulista, 1000 - Sao Paulo",
    veiculoId: PREVIEW_VEHICLES[0].id,
    descricao: "Toque em baixa velocidade na saida do estacionamento.",
    houveTerceiro: true,
    terceiroNome: "Carlos Almeida",
    terceiroTelefone: "(11) 99888-7766",
    terceiroPlaca: "BRA2E19",
    terceiroVeiculo: "Compass cinza",
    terceiroObservacao: "Disse que entraria em contato com a seguradora."
  }));
  const [maintenanceFinalizeDraft, setMaintenanceFinalizeDraft] = useState<MaintenanceFinalizeDraft>({
    serviceDone: "Troca das pastilhas dianteiras e alinhamento rapido.",
    value: "480,00",
    payment: "Cartao de credito",
    establishment: "Auto Center Vila Olimpia",
    notes: "Sem pendencias apos o teste."
  });
  const [selectValue, setSelectValue] = useState("city-sp");
  const timersRef = useRef<number[]>([]);

  const expensePhotos = useMemo(() => (showFilledPhotos ? buildExpensePhotos() : []), [showFilledPhotos]);
  const receivePhotos = useMemo(() => (showFilledPhotos ? buildReceivePhotos() : []), [showFilledPhotos]);
  const maintenanceRequestPhotos = useMemo(() => (showFilledPhotos ? buildMaintenanceRequestPhotos() : []), [showFilledPhotos]);
  const collisionPhotos = useMemo(() => (showFilledPhotos ? buildCollisionPhotos(showCollisionThirdParty) : []), [showFilledPhotos, showCollisionThirdParty]);
  const maintenancePhotos = useMemo(() => (showFilledPhotos ? buildMaintenanceFinalizePhotos() : {}), [showFilledPhotos]);
  const confirmedMaintenancePhotos = useMemo(
    () => (showFilledPhotos ? (["NOTAFISCAL", "FOTO1", "FOTO2"] as MaintenancePhotoKind[]) : []),
    [showFilledPhotos]
  );
  const activeDetail = activeDetailKind === "exchange" ? EXCHANGE_DETAIL : activeDetailKind === "maintenance" ? MAINTENANCE_DETAIL : SERVICE_DETAIL;
  const finalizeDetail = activeFinalizeKind === "exchange" ? EXCHANGE_DETAIL : activeFinalizeKind === "maintenance" ? MAINTENANCE_DETAIL : SERVICE_DETAIL;

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    setCollisionDraft((current) => ({
      ...current,
      houveTerceiro: showCollisionThirdParty,
      tipoOcorrencia: showCollisionThirdParty ? current.tipoOcorrencia || "eu_bati" : "eu_bati",
      terceiroNome: showCollisionThirdParty ? current.terceiroNome || "Carlos Almeida" : "",
      terceiroTelefone: showCollisionThirdParty ? current.terceiroTelefone || "(11) 99888-7766" : "",
      terceiroPlaca: showCollisionThirdParty ? current.terceiroPlaca || "BRA2E19" : "",
      terceiroVeiculo: showCollisionThirdParty ? current.terceiroVeiculo || "Compass cinza" : "",
      terceiroDocumento: showCollisionThirdParty ? current.terceiroDocumento : "",
      terceiroSeguradora: showCollisionThirdParty ? current.terceiroSeguradora : "",
      terceiroObservacao: showCollisionThirdParty ? current.terceiroObservacao || "Relatou susto, sem feridos." : ""
    }));
  }, [showCollisionThirdParty]);

  const openDemo = (demo: DemoId) => setSelectedDemo(demo);

  const runDemo = (buttonId: PreviewButtonId) => {
    setStates((current) => ({ ...current, [buttonId]: "loading" }));

    const successTimer = window.setTimeout(() => {
      setStates((current) => ({ ...current, [buttonId]: "success" }));
    }, DEMO_DELAY_MS);

    const idleTimer = window.setTimeout(() => {
      setStates((current) => ({ ...current, [buttonId]: "idle" }));
    }, DEMO_DELAY_MS * 2);

    timersRef.current.push(successTimer, idleTimer);
    onShowToast?.(`Preview acionado: ${buttonId}.`);
  };

  const pulseSubmitState = () => {
    setSubmitState("loading");
    const successTimer = window.setTimeout(() => setSubmitState("success"), DEMO_DELAY_MS);
    const idleTimer = window.setTimeout(() => setSubmitState("idle"), DEMO_DELAY_MS * 2);
    timersRef.current.push(successTimer, idleTimer);
  };

  const emitToast = (message: string, tone: ToastState["tone"] = "info") => {
    const nextToast = { id: Date.now() + Math.random(), message, tone };
    setInlineToast(nextToast);
    onShowToast?.(message);
  };

  const previewSelectOptions = [
    { value: "city-sjc", label: "Sao Jose dos Campos", subtitle: "SP - Brasil", searchText: "sjc sao jose 3549904" },
    { value: "city-sp", label: "Sao Paulo", subtitle: "SP - Brasil", searchText: "capital paulista 3550308" },
    { value: "city-gru", label: "Guarulhos", subtitle: "SP - Brasil", searchText: "gru aeroporto 3518800" }
  ];

  const renderButtonsDemo = () => (
    <PreviewSection title="Botoes e action bars" subtitle="Estados reais para inspecionar classe, texto, transicao e spinner.">
      <div className="preview-lab-card">
        <div className="button-preview-grid">
          <ActionButton className="button-preview-button" variant="primary" label="Primario" loadingLabel="Carregando" successLabel="Pronto" onClick={() => runDemo("variants-primary")} state={states["variants-primary"]} />
          <ActionButton className="button-preview-button" label="Secundario" loadingLabel="Carregando" successLabel="Pronto" onClick={() => runDemo("variants-secondary")} state={states["variants-secondary"]} />
          <ActionButton className="button-preview-button" variant="danger" label="Cancelado" loadingLabel="Cancelando" successLabel="Cancelado" onClick={() => runDemo("variants-danger")} state={states["variants-danger"]} />
        </div>
      </div>

      <div className="preview-lab-card">
        <div className="button-preview-grid">
          <ActionButton className="button-preview-button" variant="primary" label="Confirmar" loadingLabel="Confirmando" successLabel="Confirmado" icon={<SystemIcon name="check" />} onClick={() => runDemo("icons-primary")} state={states["icons-primary"]} />
          <ActionButton className="button-preview-button" label="Voltar" loadingLabel="Voltando" successLabel="Voltou" icon={<SystemIcon name="arrowLeft" />} onClick={() => runDemo("icons-secondary")} state={states["icons-secondary"]} />
          <ActionButton className="button-preview-button" variant="danger" label="Apagar foto" loadingLabel="Apagando foto" successLabel="Apagada" icon={<SystemIcon name="trash" />} onClick={() => runDemo("icons-danger")} state={states["icons-danger"]} />
        </div>
      </div>

      <div className="preview-lab-card">
        <ActionBar className="button-preview-action-bar">
          <ActionButton className="button-preview-button" label="Voltar" loadingLabel="Voltando" successLabel="Voltou" icon={<SystemIcon name="arrowLeft" />} onClick={() => runDemo("bar-secondary")} state={states["bar-secondary"]} />
          <ActionButton className="button-preview-button" variant="primary" idleLabel="FINALIZAR" loadingLabel="ENVIANDO" successLabel="FINALIZADO" state={states["bar-primary"]} onClick={() => runDemo("bar-primary")} />
        </ActionBar>
      </div>

      <div className="preview-lab-card">
        <ActionBar className="button-preview-action-bar receive-actions has-personal-receipt">
          <ActionButton className="button-preview-button receive-receipt" label="Abrir recibo personalizado" loadingLabel="Abrindo recibo" successLabel="Recibo aberto" icon={<img src={invoiceReceiptIcon} alt="" />} state={states.receipt} onClick={() => runDemo("receipt")} />
          <ActionButton className="button-preview-button receive-secondary" label="Voltar" loadingLabel="Voltando" successLabel="Voltou" icon={<SystemIcon name="arrowLeft" />} onClick={() => runDemo("receipt-secondary")} state={states["receipt-secondary"]} />
          <ActionButton className="button-preview-button receive-primary" variant="primary" idleLabel="FINALIZAR" loadingLabel="ENVIANDO" successLabel="FINALIZADO" state={states["receipt-primary"]} onClick={() => runDemo("receipt-primary")} />
        </ActionBar>
      </div>

      <div className="preview-lab-card">
        <ActionBar className="button-preview-action-bar">
          <ActionButton className="button-preview-button" label="Cancelar" loadingLabel="Cancelando" successLabel="Cancelado" icon={<SystemIcon name="dismiss" />} onClick={() => runDemo("danger-secondary")} state={states["danger-secondary"]} />
          <ActionButton className="button-preview-button" variant="danger" idleLabel="Enviar" loadingLabel="ENVIANDO" successLabel="ENVIADO" state={states["danger-primary"]} onClick={() => runDemo("danger-primary")} />
        </ActionBar>
      </div>
    </PreviewSection>
  );

  const renderSelectsDemo = () => (
    <PreviewSection title="SearchableSelect" subtitle="Abra, filtre, navegue com teclado e inspecione lista, trigger e estados.">
      <div className="preview-lab-card preview-lab-card--narrow">
        <div className="preview-lab-form-row">
          <label>Cidade operacional</label>
          <SearchableSelect
            value={selectValue}
            options={previewSelectOptions}
            placeholder="Selecione"
            ariaLabel="Selecionar cidade de preview"
            onChange={setSelectValue}
          />
        </div>
        <div className="preview-lab-form-row">
          <label>Estado atual</label>
          <div className="preview-lab-inline-value">{previewSelectOptions.find((item) => item.value === selectValue)?.label ?? "Nenhum"}</div>
        </div>
      </div>
    </PreviewSection>
  );

  const renderToastsDemo = () => (
    <PreviewSection title="Toasts e feedback" subtitle="Dispara overlay global do app e tambem um toast inline fixo para inspecao.">
      <div className="preview-lab-card">
        <div className="button-preview-grid">
          {REAL_TOAST_PRESETS.map((preset) => (
            <ActionButton key={preset.label} className="button-preview-button" label={preset.label} onClick={() => emitToast(preset.message)} />
          ))}
        </div>
      </div>
      <div className="preview-lab-card">
        <div className="button-preview-toast-stage">
          <LocalToast toast={inlineToast} onDismiss={() => setInlineToast(null)} inline />
        </div>
      </div>
    </PreviewSection>
  );

  const renderCurrentDemo = () => {
    if (selectedDemo === "buttons") return renderButtonsDemo();
    if (selectedDemo === "selects") return renderSelectsDemo();
    if (selectedDemo === "toasts") return renderToastsDemo();

    if (selectedDemo === "initial") {
      return (
        <InitialScreen
          onNavigate={(screen) => {
            if (screen === "servicos") openDemo("services");
            if (screen === "historico") openDemo("history");
            if (screen === "solicitarManutencao") openDemo("maintenance-request");
            if (screen === "gastos") openDemo("expense");
            if (screen === "colisoesInicio") openDemo("collision-start");
            if (screen === "reciboPersonalizado") openDemo("receipt-preview");
          }}
          onRefresh={() => emitToast("Refresh local do preview executado.", "success")}
          onResetLocal={() => emitToast("Reset local interceptado no preview.", "warning")}
          canGeneratePersonalReceipt={canGeneratePersonalReceipt}
          services={agendaMock}
          driverName="Renan Batista"
        />
      );
    }

    if (selectedDemo === "services") {
      return (
        <ServicesScreen
          items={agendaMock}
          onHome={() => openDemo("initial")}
          onRefresh={() => emitToast("Atualizacao da agenda simulada.", "success")}
          completingDetailKey={submitState === "loading" ? "SERVICO:10241" : ""}
          onOpenDetails={(detail) => {
            setActiveDetailKind(detail.type === "TROCA" ? "exchange" : detail.type === "MANUTENCAO" ? "maintenance" : "service");
            openDemo("details");
          }}
        />
      );
    }

    if (selectedDemo === "details") {
      return (
        <DetailsScreen
          detail={activeDetail}
          onBack={() => openDemo(activeDetailKind === "service" ? "services" : "initial")}
          onOpenReceive={() => openDemo("receive")}
          onOpenVoucher={() => openDemo("voucher")}
          onOpenFinalize={() => {
            setActiveFinalizeKind(activeDetail.type === "TROCA" ? "exchange" : activeDetail.type === "MANUTENCAO" ? "maintenance" : "service");
            openDemo("finalize");
          }}
          onCancelLocal={() => openDemo("cancel")}
          onRefresh={() => emitToast("Detalhe atualizado no preview.", "success")}
          onCopy={() => emitToast("Texto copiado no preview.", "success")}
        />
      );
    }

    if (selectedDemo === "receive") {
      return (
        <ReceiveScreen
          detail={SERVICE_DETAIL}
          photos={receivePhotos}
          onAddPhoto={() => emitToast("Adicionar comprovante mockado.", "info")}
          onPreviewPhoto={() => openDemo("photo-preview")}
          onBack={() => openDemo("details")}
          onContinue={pulseSubmitState}
          onGeneratePersonalReceipt={() => openDemo("receipt-preview")}
          canGeneratePersonalReceipt={canGeneratePersonalReceipt}
          submitState={submitState}
        />
      );
    }

    if (selectedDemo === "voucher") {
      return (
        <VoucherScreen
          detail={SERVICE_DETAIL}
          hasSignature={hasSignature}
          initialDraft={{
            "Horário Inicial": "08:30",
            "Espera Início": "09:00",
            "Espera Final": "09:25",
            Desvio: "Nao",
            "Observação Voucher": "Cliente solicitou parada rapida na recepcao.",
            Pedagio: "R$ 32,40",
            Estacionamento: "R$ 28,00"
          }}
          onBack={() => openDemo("details")}
          onOpenSignature={() => openDemo("signature")}
          onFinalize={pulseSubmitState}
          onDraftChange={() => undefined}
          submitState={submitState}
        />
      );
    }

    if (selectedDemo === "signature") {
      return (
        <SignatureScreen
          detail={SERVICE_DETAIL}
          onBack={() => openDemo("voucher")}
          onConfirm={() => {
            setHasSignature(true);
            emitToast("Assinatura simulada salva.", "success");
            openDemo("voucher");
          }}
        />
      );
    }

    if (selectedDemo === "finalize") {
      return (
        <FinalizeScreen
          detail={finalizeDetail}
          onBack={() => openDemo("details")}
          onDone={pulseSubmitState}
          confirmedPhotos={activeFinalizeKind === "maintenance" ? confirmedMaintenancePhotos : []}
          maintenancePhotos={activeFinalizeKind === "maintenance" ? maintenancePhotos : {}}
          maintenanceDraft={maintenanceFinalizeDraft}
          onMaintenanceDraftChange={setMaintenanceFinalizeDraft}
          submitState={submitState}
          onClearPhotos={() => emitToast("Fotos locais limpas no preview.", "warning")}
          onPreviewMaintenancePhoto={() => openDemo("photo-preview")}
        />
      );
    }

    if (selectedDemo === "maintenance-request") {
      return (
        <MaintenanceRequestScreen
          draft={maintenanceRequestDraft}
          photos={maintenanceRequestPhotos}
          onDraftChange={setMaintenanceRequestDraft}
          onAddPhoto={() => emitToast("Adicionar foto de manutencao mockada.", "info")}
          onPreviewPhoto={() => openDemo("photo-preview")}
          onBack={() => openDemo("initial")}
          onSubmit={pulseSubmitState}
          submitState={submitState}
          vehicles={PREVIEW_VEHICLES}
          initialVehicleId={PREVIEW_VEHICLES[0].id}
          vehiclesLoading={false}
        />
      );
    }

    if (selectedDemo === "expense") {
      return (
        <ExpenseScreen
          draft={expenseDraft}
          photos={expensePhotos}
          referenceData={PREVIEW_EXPENSE_REFERENCE_DATA}
          referenceLoading={false}
          onDraftChange={setExpenseDraft}
          onAddPhoto={() => emitToast("Adicionar comprovante de gasto mockado.", "info")}
          onPreviewPhoto={() => openDemo("photo-preview")}
          onBack={() => openDemo("initial")}
          onSubmit={pulseSubmitState}
          submitState={submitState}
          vehicles={PREVIEW_VEHICLES}
          vehiclesLoading={false}
          currentVehicleId={PREVIEW_VEHICLES[0].id}
        />
      );
    }

    if (selectedDemo === "collision-start") {
      return (
        <CollisionStartScreen
          onBack={() => openDemo("initial")}
          onSelect={(type) => {
            setCollisionDraft((current) => ({ ...current, tipoOcorrencia: type }));
            openDemo("collision");
          }}
        />
      );
    }

    if (selectedDemo === "collision") {
      return (
        <CollisionScreen
          draft={collisionDraft}
          photos={collisionPhotos}
          onDraftChange={setCollisionDraft}
          onAddPhoto={(kind: CollisionPhotoKind) => emitToast(`Adicionar evidencia mockada: ${kind}.`, "info")}
          onPreviewPhoto={() => openDemo("photo-preview")}
          onBack={() => openDemo("collision-start")}
          onSubmit={pulseSubmitState}
          submitState={submitState}
          vehicles={PREVIEW_VEHICLES}
          vehiclesLoading={false}
          currentVehicleId={PREVIEW_VEHICLES[0].id}
          driverName="Renan Batista"
        />
      );
    }

    if (selectedDemo === "cancel") {
      return (
        <LocalCancelScreen
          detail={SERVICE_DETAIL}
          onBack={() => openDemo("details")}
          onWrongClick={() => openDemo("details")}
          onSubmit={() => pulseSubmitState()}
          submitState={submitState}
        />
      );
    }

    if (selectedDemo === "history") {
      return (
        <HistoryScreen
          items={historyMock}
          onHome={() => openDemo("initial")}
          onRefresh={() => emitToast("Historico atualizado no preview.", "success")}
          onOpenDetails={() => openDemo("history-details")}
        />
      );
    }

    if (selectedDemo === "history-details") {
      return <HistoryDetailsScreen detail={HISTORY_DETAIL} onBack={() => openDemo("history")} onRefresh={() => emitToast("Historico revalidado no preview.", "success")} />;
    }

    if (selectedDemo === "photo-preview") {
      return (
        <MaintenancePhotoPreviewScreen
          kind="NOTAFISCAL"
          title="Preview de comprovante"
          prompt="Confirme visualmente ou inspecione a estrutura."
          photoDataUrl={svgDataUrl("Preview", "#345b75", "#10202c", "Comprovante pronto para inspecao")}
          onBack={() => openDemo("expense")}
          onRetake={() => emitToast("Refazer captura mockada.", "warning")}
          onConfirm={() => emitToast("Confirmacao mockada.", "success")}
          onDelete={() => emitToast("Delete mockado.", "warning")}
          confirmLabel={showDeleteOnly ? "Voltar" : "Confirmar"}
          deleteOnly={showDeleteOnly}
        />
      );
    }

    return <ReceiptPreviewScreen onBack={() => openDemo("receive")} />;
  };

  return (
    <div className="button-preview-screen preview-lab-screen">
      <PreviewNav selectedDemo={selectedDemo} onSelect={setSelectedDemo} />
      <div className="preview-lab-main">
        <header className="preview-lab-header">
          <div>
            <div className="preview-lab-kicker">Superficie de desenvolvimento</div>
            <h1>Inspecione componentes e telas em isolamento</h1>
            <p>Use `#preview` para abrir direto. O palco abaixo existe para F5 local, inspecao HTML/CSS e acionamento de estados sem navegar pelo fluxo inteiro.</p>
          </div>
          <div className="preview-lab-header-actions">
            <ActionButton className="preview-lab-header-button" label="Toast global" onClick={() => emitToast("Preview global acionado.", "success")} />
            <ActionButton className="preview-lab-header-button" variant="primary" label="Simular submit" onClick={pulseSubmitState} />
          </div>
        </header>

        <div className="preview-lab-controls">
          <div className="preview-lab-control-group">
            <span>Submit</span>
            <div className="preview-lab-chip-row">
              <PreviewControl label="Idle" active={submitState === "idle"} onClick={() => setSubmitState("idle")} />
              <PreviewControl label="Loading" active={submitState === "loading"} onClick={() => setSubmitState("loading")} />
              <PreviewControl label="Success" active={submitState === "success"} onClick={() => setSubmitState("success")} />
            </div>
          </div>

          <div className="preview-lab-control-group">
            <span>Flags</span>
            <div className="preview-lab-chip-row">
              <PreviewControl label={canGeneratePersonalReceipt ? "Recibo on" : "Recibo off"} active={canGeneratePersonalReceipt} onClick={() => setCanGeneratePersonalReceipt((current) => !current)} />
              <PreviewControl label={hasSignature ? "Assinado" : "Sem assinatura"} active={hasSignature} onClick={() => setHasSignature((current) => !current)} />
              <PreviewControl label={showFilledPhotos ? "Com fotos" : "Sem fotos"} active={showFilledPhotos} onClick={() => setShowFilledPhotos((current) => !current)} />
              <PreviewControl label={showCollisionThirdParty ? "Com terceiro" : "Sem terceiro"} active={showCollisionThirdParty} onClick={() => setShowCollisionThirdParty((current) => !current)} />
              <PreviewControl label={showDeleteOnly ? "Delete only" : "Confirmacao"} active={showDeleteOnly} onClick={() => setShowDeleteOnly((current) => !current)} />
            </div>
          </div>

          <div className="preview-lab-control-group">
            <span>Detalhe</span>
            <div className="preview-lab-chip-row">
              <PreviewControl label="Servico" active={activeDetailKind === "service"} onClick={() => setActiveDetailKind("service")} />
              <PreviewControl label="Troca" active={activeDetailKind === "exchange"} onClick={() => setActiveDetailKind("exchange")} />
              <PreviewControl label="Manutencao" active={activeDetailKind === "maintenance"} onClick={() => setActiveDetailKind("maintenance")} />
            </div>
          </div>

          <div className="preview-lab-control-group">
            <span>Finalizar</span>
            <div className="preview-lab-chip-row">
              <PreviewControl label="Servico" active={activeFinalizeKind === "service"} onClick={() => setActiveFinalizeKind("service")} />
              <PreviewControl label="Troca" active={activeFinalizeKind === "exchange"} onClick={() => setActiveFinalizeKind("exchange")} />
              <PreviewControl label="Manutencao" active={activeFinalizeKind === "maintenance"} onClick={() => setActiveFinalizeKind("maintenance")} />
            </div>
          </div>
        </div>

        <div className="preview-lab-stage">
          {renderCurrentDemo()}
        </div>
      </div>
    </div>
  );
}
