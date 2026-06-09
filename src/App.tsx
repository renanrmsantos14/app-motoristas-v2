import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { agendaMock, historyMock } from "./data/mockData";
import {
  cancelServiceRemote,
  createMaintenanceRequestRemote,
  createOne,
  DATAVERSE,
  finalizeExchangeRemote,
  finalizeMaintenanceRemote,
  finalizeServiceRemote,
  getDriverContext,
  getDriverCurrentVehicleId,
  hasDataverseRuntime,
  loadMaintenanceRequestVehiclesRemote,
  loadRemoteDetailByParams,
  loadRemoteStore,
  markDetailViewedRemote,
  saveVoucherDraftRemote,
  saveVoucherRemote,
  uploadExpenseInvoiceRemote,
  type DriverContext,
  type MaintenanceRequestVehicleOption
} from "./lib/dataverse";
import { reportAppError } from "./lib/appErrorLogger";
import {
  cancelDetailLocally,
  clearMaintenancePhotos,
  deleteMaintenancePhoto as deleteFinalizationMaintenancePhoto,
  detailsToClipboardText,
  finalizeDetailLocally,
  findDetailByParams,
  removeAgendaDetail,
  saveMaintenancePhoto,
  saveSignatureLocally,
  type LocalStore
} from "./lib/localWorkflow";
import { DetailsScreen } from "./screens/DetailsScreen";
import { ExpenseScreen } from "./screens/ExpenseScreen";
import { FinalizeScreen, type MaintenanceFinalizeDraft } from "./screens/FinalizeScreen";
import { HistoryDetailsScreen } from "./screens/HistoryDetailsScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { InitialScreen } from "./screens/InitialScreen";
import { LocalCancelScreen } from "./screens/LocalCancelScreen";
import { MaintenancePhotoScreen } from "./screens/MaintenancePhotoScreen";
import { MaintenancePhotoPreviewScreen } from "./screens/MaintenancePhotoPreviewScreen";
import {
  MaintenanceRequestScreen,
  type MaintenanceRequestDraft,
  type MaintenanceRequestFields,
  type MaintenanceRequestPhoto
} from "./screens/MaintenanceRequestScreen";
import { ServicesScreen } from "./screens/ServicesScreen";
import { SignatureScreen } from "./screens/SignatureScreen";
import { VoucherScreen } from "./screens/VoucherScreen";
import { buildExpenseCreatePayload, type ExpenseDraft } from "./lib/expenses";
import type { DetailData, MaintenancePhotoKind, Screen } from "./types";

const STORAGE_KEY = "app-motoristas-local-v1";

function isSameDetail(left: DetailData | undefined, right: DetailData) {
  return Boolean(left && left.id === right.id && left.type === right.type);
}

function findFirstPendingDetail(agenda: LocalStore["agenda"]) {
  return agenda.find((item) => item.tipo !== "HEADER" && item.detail)?.detail;
}

const SCREEN_DEPTH: Record<Screen, number> = {
  inicio: 0,
  servicos: 1,
  historico: 1,
  detalhes: 2,
  detalhesHistorico: 2,
  voucher: 3,
  finalizar: 3,
  gastos: 1,
  solicitarManutencao: 1,
  fotoSolicitacaoManutencao: 2,
  previewFotoSolicitacaoManutencao: 3,
  canceladoLocal: 3,
  assinatura: 4,
  fotoManutencao: 4,
  previewFotoManutencao: 5
};

const drillSpring = {
  type: "spring" as const,
  stiffness: 540,
  damping: 44,
  mass: 0.58
};

const settleSpring = {
  type: "spring" as const,
  stiffness: 620,
  damping: 48,
  mass: 0.52
};

const sheetSpring = {
  type: "spring" as const,
  stiffness: 680,
  damping: 54,
  mass: 0.48
};

const focusSpring = {
  type: "spring" as const,
  stiffness: 760,
  damping: 56,
  mass: 0.42
};

const fastFade = {
  duration: 0.16,
  ease: "easeOut" as const
};

const isListScreen = (screenName: Screen) => screenName === "servicos" || screenName === "historico" || screenName === "gastos";
const isDetailScreen = (screenName: Screen) => screenName === "detalhes" || screenName === "detalhesHistorico";
const isTaskScreen = (screenName: Screen) =>
  screenName === "voucher" || screenName === "finalizar" || screenName === "canceladoLocal";
const isCaptureScreen = (screenName: Screen) =>
  screenName === "fotoManutencao" || screenName === "previewFotoManutencao";

function getScreenMotion(current: Screen, previous: Screen) {
  const delta = SCREEN_DEPTH[current] - SCREEN_DEPTH[previous];

  if (previous === "inicio" && isListScreen(current)) {
    return {
      kind: "module-open",
      origin: "50% 12%",
      initial: { opacity: 0, y: 18, scale: 0.986, filter: "blur(2px)" },
      exit: { opacity: 0, y: -8, scale: 0.998, filter: "blur(1px)" },
      transition: settleSpring
    };
  }

  if (current === "inicio") {
    return {
      kind: "home",
      origin: "50% 0%",
      initial: { opacity: 0, y: -10, scale: 0.994, filter: "blur(1px)" },
      exit: { opacity: 0, y: 12, scale: 0.99, filter: "blur(2px)" },
      transition: fastFade
    };
  }

  if (isListScreen(previous) && isDetailScreen(current)) {
    return {
      kind: "drill-in",
      origin: "100% 50%",
      initial: { opacity: 0, x: 26, scale: 0.992, filter: "blur(1px)" },
      exit: { opacity: 0, x: -14, scale: 0.996, filter: "blur(1px)" },
      transition: drillSpring
    };
  }

  if (isDetailScreen(previous) && isListScreen(current)) {
    return {
      kind: "drill-out",
      origin: "0% 50%",
      initial: { opacity: 0, x: -20, scale: 0.996, filter: "blur(1px)" },
      exit: { opacity: 0, x: 20, scale: 0.992, filter: "blur(1px)" },
      transition: settleSpring
    };
  }

  if (isDetailScreen(previous) && isTaskScreen(current)) {
    return {
      kind: "task-open",
      origin: "50% 100%",
      initial: { opacity: 0, y: 24, scale: 0.982, filter: "blur(2px)" },
      exit: { opacity: 0, y: -8, scale: 0.996, filter: "blur(1px)" },
      transition: sheetSpring
    };
  }

  if (isTaskScreen(previous) && isDetailScreen(current)) {
    return {
      kind: "task-close",
      origin: "50% 40%",
      initial: { opacity: 0, y: -12, scale: 0.996, filter: "blur(1px)" },
      exit: { opacity: 0, y: 22, scale: 0.986, filter: "blur(1px)" },
      transition: settleSpring
    };
  }

  if (previous === "voucher" && current === "assinatura") {
    return {
      kind: "focus-in",
      origin: "50% 72%",
      initial: { opacity: 0, y: 12, scale: 0.968, filter: "blur(2px)" },
      exit: { opacity: 0, y: -4, scale: 1.012, filter: "blur(1px)" },
      transition: focusSpring
    };
  }

  if (previous === "assinatura" && current === "voucher") {
    return {
      kind: "focus-out",
      origin: "50% 72%",
      initial: { opacity: 0, y: -8, scale: 1.012, filter: "blur(1px)" },
      exit: { opacity: 0, y: 12, scale: 0.968, filter: "blur(1px)" },
      transition: focusSpring
    };
  }

  if (previous === "finalizar" && current === "fotoManutencao") {
    return {
      kind: "capture-open",
      origin: "50% 88%",
      initial: { opacity: 0, y: 28, scale: 0.976, filter: "blur(2px)" },
      exit: { opacity: 0, y: -6, scale: 0.998, filter: "blur(1px)" },
      transition: sheetSpring
    };
  }

  if (previous === "fotoManutencao" && current === "previewFotoManutencao") {
    return {
      kind: "capture-preview",
      origin: "50% 50%",
      initial: { opacity: 0, scale: 1.018, filter: "blur(2px)" },
      exit: { opacity: 0, scale: 0.982, filter: "blur(1px)" },
      transition: focusSpring
    };
  }

  if (isCaptureScreen(previous) && current === "finalizar") {
    return {
      kind: "capture-close",
      origin: "50% 84%",
      initial: { opacity: 0, y: -10, scale: 0.996, filter: "blur(1px)" },
      exit: { opacity: 0, y: 24, scale: 0.982, filter: "blur(1px)" },
      transition: settleSpring
    };
  }

  if (isTaskScreen(previous) && current === "historico") {
    return {
      kind: "complete",
      origin: "50% 28%",
      initial: { opacity: 0, y: 18, scale: 0.99, filter: "blur(2px)" },
      exit: { opacity: 0, y: -12, scale: 0.996, filter: "blur(1px)" },
      transition: settleSpring
    };
  }

  if (delta > 0) {
    return {
      kind: "forward",
      origin: "100% 50%",
      initial: { opacity: 0, x: 22, scale: 0.994, filter: "blur(1px)" },
      exit: { opacity: 0, x: -12, scale: 0.998, filter: "blur(1px)" },
      transition: drillSpring
    };
  }

  if (delta < 0) {
    return {
      kind: "back",
      origin: "0% 50%",
      initial: { opacity: 0, x: -16, scale: 0.998, filter: "blur(1px)" },
      exit: { opacity: 0, x: 18, scale: 0.994, filter: "blur(1px)" },
      transition: settleSpring
    };
  }

  return {
    kind: "neutral",
    origin: "50% 50%",
    initial: { opacity: 0, y: 8, scale: 0.998, filter: "blur(1px)" },
    exit: { opacity: 0, y: -6, scale: 0.998, filter: "blur(1px)" },
    transition: settleSpring
  };
}

function initialStore(): LocalStore {
  return {
    agenda: agendaMock,
    history: historyMock,
    signatures: {},
    photos: {}
  };
}

function loadStore(): LocalStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as LocalStore;
  } catch {
    // fallback local
  }

  return initialStore();
}

function getInitialDetail(store: LocalStore): DetailData | null {
  const params = new URLSearchParams(window.location.search);
  const serviceId = params.get("servicoId") ?? "";
  const type = params.get("tipo") ?? "";
  return findDetailByParams([...store.agenda, ...store.history], serviceId, type);
}

function getInitialParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    serviceId: params.get("servicoId") ?? "",
    type: params.get("tipo") ?? ""
  };
}

function getVoucherDraftKey(detail: DetailData) {
  return `${detail.type}:${detail.id}`;
}

type RemoteOperation = {
  title: string;
  message: string;
  detailId?: string;
  phase: "loading" | "success";
};

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function App() {
  const [store, setStore] = useState<LocalStore>(() => loadStore());
  const initialDetailRef = useRef<DetailData | null>(getInitialDetail(store));
  const [screen, setScreen] = useState<Screen>(() => (initialDetailRef.current ? "detalhes" : "inicio"));
  const previousScreenRef = useRef<Screen>(initialDetailRef.current ? "detalhes" : "inicio");
  const [selectedDetail, setSelectedDetail] = useState<DetailData | null>(() => initialDetailRef.current);
  const [maintenancePhotoKind, setMaintenancePhotoKind] = useState<MaintenancePhotoKind>("NOTAFISCAL");
  const [photoDraft, setPhotoDraft] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [criticalError, setCriticalError] = useState("");
  const [completingDetailKey, setCompletingDetailKey] = useState("");
  const [remoteOperation, setRemoteOperation] = useState<RemoteOperation | null>(null);
  const [remoteMode, setRemoteMode] = useState(false);
  const [driverContext, setDriverContext] = useState<DriverContext | null>(null);
  const [voucherDrafts, setVoucherDrafts] = useState<Record<string, Record<string, string>>>({});
  const [maintenanceVehicles, setMaintenanceVehicles] = useState<MaintenanceRequestVehicleOption[]>([]);
  const [maintenanceCurrentVehicleId, setMaintenanceCurrentVehicleId] = useState("");
  const [maintenanceVehiclesLoading, setMaintenanceVehiclesLoading] = useState(false);
  const [maintenanceRequestDraft, setMaintenanceRequestDraft] = useState<MaintenanceRequestDraft>({
    descricao: "",
    kmAtual: "",
    veiculoId: "",
    gravidade: ""
  });
  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft>({
    categoria: "",
    veiculoId: "",
    cidade: "",
    valor: "",
    dataGasto: new Date().toISOString().slice(0, 10),
    formaPagamento: "",
    descricao: "",
    kmInformado: "",
    litros: "",
    observacao: "",
    notaFiscalDataUrl: "",
    notaFiscalFileName: ""
  });
  const [maintenanceRequestPhotos, setMaintenanceRequestPhotos] = useState<MaintenanceRequestPhoto[]>([]);
  const [maintenanceRequestPhotoDraft, setMaintenanceRequestPhotoDraft] = useState("");
  const [maintenanceRequestPreviewPhotoId, setMaintenanceRequestPreviewPhotoId] = useState("");
  const [maintenanceExistingPreview, setMaintenanceExistingPreview] = useState(false);
  const [maintenanceFinalizeDraft, setMaintenanceFinalizeDraft] = useState<MaintenanceFinalizeDraft>({
    serviceDone: "",
    value: "",
    payment: "",
    establishment: "",
    notes: ""
  });
  const finalizeTimerRef = useRef<number | null>(null);
  const completingClearTimerRef = useRef<number | null>(null);
  const voucherDraftTimerRef = useRef<number | null>(null);

  const logAppError = (error: unknown, action: string, phase = "") => {
    reportAppError(error, {
      severity: "error",
      source: "app",
      action,
      phase,
      screen,
      detailId: selectedDetail?.id,
      detailType: selectedDetail?.type
    });
  };

  useEffect(() => {
    if (remoteMode) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [remoteMode, store]);

  useEffect(() => {
    if (!hasDataverseRuntime()) return;
    let alive = true;
    setRemoteMode(true);
    setToast("Carregando Dataverse.");
    loadRemoteStore()
      .then((remote) => {
        if (!alive) return;
        const remoteInitialDetail = getInitialDetail({ ...store, agenda: remote.agenda, history: remote.history });
        setDriverContext(remote.driver);
        setStore((current) => ({
          ...current,
          agenda: remote.agenda,
          history: remote.history
        }));
        if (remoteInitialDetail) {
          markDetailViewedRemote(remoteInitialDetail).catch((error) => {
            reportAppError(error, {
              severity: "error",
              source: "app",
              action: "markDetailViewedRemote",
              phase: "initial-detail",
              screen: "detalhes",
              detailId: remoteInitialDetail.id,
              detailType: remoteInitialDetail.type
            });
            setToast(error instanceof Error ? error.message : "Falha ao marcar visualização.");
          });
          setSelectedDetail(remoteInitialDetail);
          setScreen("detalhes");
          return;
        }
        const initialParams = getInitialParams();
        if (initialParams.serviceId) {
          loadRemoteDetailByParams(initialParams.serviceId, initialParams.type)
            .then((detail) => {
              if (!alive) return;
              if (!detail) {
                setToast("Serviço remoto não encontrado.");
                return;
              }
              markDetailViewedRemote(detail).catch((error) => {
                reportAppError(error, {
                  severity: "error",
                  source: "app",
                  action: "markDetailViewedRemote",
                  phase: "deep-link",
                  screen: "detalhes",
                  detailId: detail.id,
                  detailType: detail.type
                });
                setToast(error instanceof Error ? error.message : "Falha ao marcar visualização.");
              });
              setSelectedDetail(detail);
              setScreen("detalhes");
              setToast("");
            })
            .catch((error) => {
              if (!alive) return;
              reportAppError(error, {
                severity: "error",
                source: "app",
                action: "loadRemoteDetailByParams",
                phase: "initial-deep-link",
                screen
              });
              setToast(error instanceof Error ? error.message : "Serviço remoto não encontrado.");
            });
          return;
        }
        setToast("");
      })
      .catch((error) => {
        if (!alive) return;
        reportAppError(error, {
          severity: "critical",
          source: "app",
          action: "loadRemoteStore",
          phase: "bootstrap",
          screen
        });
        setRemoteMode(false);
        setToast(error instanceof Error ? error.message : "Falha ao carregar Dataverse.");
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    return () => {
      if (finalizeTimerRef.current) window.clearTimeout(finalizeTimerRef.current);
      if (completingClearTimerRef.current) window.clearTimeout(completingClearTimerRef.current);
      if (voucherDraftTimerRef.current) window.clearTimeout(voucherDraftTimerRef.current);
    };
  }, []);

  const confirmedMaintenancePhotos = useMemo(() => {
    if (!selectedDetail) return [];
    return Object.keys(store.photos[selectedDetail.id] ?? {}) as MaintenancePhotoKind[];
  }, [selectedDetail, store.photos]);

  const screenMotion = getScreenMotion(screen, previousScreenRef.current);

  useEffect(() => {
    previousScreenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    if ((screen !== "solicitarManutencao" && screen !== "gastos") || !remoteMode) return;
    let alive = true;
    setMaintenanceVehiclesLoading(true);
    getDriverContext()
      .then(async (driver) => {
        const vehicles = await loadMaintenanceRequestVehiclesRemote(driver);
        if (!alive) return;
        const currentVehicleId = getDriverCurrentVehicleId(driver);
        setMaintenanceCurrentVehicleId(currentVehicleId);
        setMaintenanceVehicles(vehicles);
      })
      .catch((error) => {
        if (!alive) return;
        reportAppError(error, {
          severity: "error",
          source: "app",
          action: "loadMaintenanceRequestVehiclesRemote",
          phase: "maintenance-request",
          screen
        });
        setToast(error instanceof Error ? error.message : "Falha ao carregar veículos.");
      })
      .finally(() => {
        if (alive) setMaintenanceVehiclesLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [screen, remoteMode]);

  const show = (node: React.ReactNode) => (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          className={`screen-motion screen-motion--${screenMotion.kind}`}
          style={{ transformOrigin: screenMotion.origin }}
          initial={screenMotion.initial}
          animate={{ opacity: 1, x: 0, y: 0, scale: 1, filter: "blur(0px)" }}
          exit={screenMotion.exit}
          transition={screenMotion.transition}
        >
          {node}
        </motion.div>
      </AnimatePresence>
      {toast ? <div className="local-toast">{toast}</div> : null}
      {remoteOperation ? (
        <div className="flow-progress-overlay" role="status" aria-live="polite" aria-label={remoteOperation.title}>
          <div className={`flow-progress-card is-${remoteOperation.phase}`}>
            <div className="flow-progress-track" aria-hidden="true">
              <span />
            </div>
            <div className="flow-progress-kicker">{remoteOperation.detailId ?? "Processo remoto"}</div>
            <h2>{remoteOperation.title}</h2>
            <p>{remoteOperation.message}</p>
            <div className="flow-progress-note">Mantenha esta tela aberta.</div>
          </div>
        </div>
      ) : null}
      {criticalError ? (
        <div className="critical-error-overlay" role="dialog" aria-modal="true" aria-labelledby="critical-error-title">
          <div className="critical-error-card">
            <div className="critical-error-kicker">Falha no envio</div>
            <h2 id="critical-error-title">Processo não foi concluído</h2>
            <p>{criticalError}</p>
            <div className="critical-error-actions">
              <button type="button" onClick={() => setCriticalError("")}>Entendi</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );

  const refreshLocal = async (detailToRefresh?: DetailData) => {
    if (remoteMode) {
      setToast("Atualizando Dataverse.");
      try {
        const remote = await loadRemoteStore();
        setDriverContext(remote.driver);
        setStore((current) => ({ ...current, agenda: remote.agenda, history: remote.history }));
        if (detailToRefresh) {
          const refreshedDetail =
            findDetailByParams([...remote.agenda, ...remote.history], detailToRefresh.id, detailToRefresh.type) ??
            await loadRemoteDetailByParams(detailToRefresh.dataverse?.id ?? detailToRefresh.id, detailToRefresh.type);
          if (refreshedDetail) setSelectedDetail(refreshedDetail);
        }
        setToast("Atualizado do Dataverse.");
      } catch (error) {
        logAppError(error, "loadRemoteStore", "refresh");
        setToast(error instanceof Error ? error.message : "Falha ao atualizar Dataverse.");
      }
      return;
    }
    setStore((current) => ({ ...current }));
    setToast("Atualizado localmente.");
  };

  const resetLocal = () => {
    const next = initialStore();
    setStore(next);
    setSelectedDetail(null);
    setScreen("inicio");
    setToast("Dados locais reiniciados.");
  };

  const finalizeSelected = async (fields: Record<string, string>) => {
    if (!selectedDetail || remoteOperation) return;
    const detailToFinalize = selectedDetail;
    const detailKey = `${detailToFinalize.type}:${detailToFinalize.id}`;
    const firstPendingDetail = findFirstPendingDetail(store.agenda);

    if (firstPendingDetail && !isSameDetail(firstPendingDetail, detailToFinalize)) {
      setToast("Conclua os itens anteriores da fila antes de prosseguir.");
      setScreen("servicos");
      return;
    }

    if (finalizeTimerRef.current) window.clearTimeout(finalizeTimerRef.current);
    if (completingClearTimerRef.current) window.clearTimeout(completingClearTimerRef.current);

    if (remoteMode) {
      const isVoucher = "Horario Inicial" in fields || "Horário Inicial" in fields;
      const operationTitle =
        detailToFinalize.type === "SERVICO" && isVoucher
          ? "Enviando voucher"
          : detailToFinalize.type === "MANUTENCAO"
            ? "Enviando manutenção"
            : detailToFinalize.type === "TROCA"
              ? "Finalizando troca"
              : "Finalizando serviço";
      const setProgress = (message: string) => {
        setRemoteOperation({
          title: operationTitle,
          message,
          detailId: detailToFinalize.id,
          phase: "loading"
        });
      };
      const setSuccess = (message: string) => {
        setRemoteOperation({
          title: operationTitle,
          message,
          detailId: detailToFinalize.id,
          phase: "success"
        });
      };
      try {
        setProgress("Conferindo fila no Dataverse.");
        const remoteBeforeFinalize = await loadRemoteStore();
        const remoteFirstPendingDetail = findFirstPendingDetail(remoteBeforeFinalize.agenda);
        setStore((current) => ({ ...current, agenda: remoteBeforeFinalize.agenda, history: remoteBeforeFinalize.history }));

        if (remoteFirstPendingDetail && !isSameDetail(remoteFirstPendingDetail, detailToFinalize)) {
          setRemoteOperation(null);
          setToast("Conclua os itens anteriores da fila antes de prosseguir.");
          setSelectedDetail(null);
          setScreen("servicos");
          return;
        }

        const signatureDataUrl = store.signatures[detailToFinalize.id];
        const photos = store.photos[detailToFinalize.id];
        const isVoucher = "Horario Inicial" in fields || "Horário Inicial" in fields;

        if (detailToFinalize.type === "SERVICO" && isVoucher) {
          await saveVoucherRemote({ detail: detailToFinalize, fields, signatureDataUrl, photos, onProgress: setProgress });
        } else if (detailToFinalize.type === "SERVICO") {
          await finalizeServiceRemote({ detail: detailToFinalize, fields, signatureDataUrl, photos, onProgress: setProgress });
        } else if (detailToFinalize.type === "MANUTENCAO") {
          await finalizeMaintenanceRemote({ detail: detailToFinalize, fields, signatureDataUrl, photos, onProgress: setProgress });
        } else if (detailToFinalize.type === "TROCA") {
          await finalizeExchangeRemote({ detail: detailToFinalize, fields, signatureDataUrl, photos, onProgress: setProgress });
        }
        setSuccess("Enviado com sucesso.");
        await wait(720);
      } catch (error) {
        logAppError(error, "finalizeSelected", detailToFinalize.type);
        setRemoteOperation(null);
        setCriticalError(error instanceof Error ? error.message : "Falha ao finalizar no Dataverse.");
        return;
      }
    }

    setCompletingDetailKey(detailKey);
    if (detailToFinalize.type === "MANUTENCAO") {
      setMaintenanceFinalizeDraft({ serviceDone: "", value: "", payment: "", establishment: "", notes: "" });
    }
    setSelectedDetail(null);
    setScreen("servicos");

    finalizeTimerRef.current = window.setTimeout(async () => {
      if (remoteMode) {
        try {
          const remote = await loadRemoteStore();
          setStore((current) => ({
            ...current,
            agenda: removeAgendaDetail(remote.agenda, detailToFinalize),
            history: remote.history
          }));
        } catch {
          setStore((current) => finalizeDetailLocally(current, detailToFinalize, fields));
        }
      } else {
        setStore((current) => finalizeDetailLocally(current, detailToFinalize, fields));
      }
      setRemoteOperation(null);
      finalizeTimerRef.current = null;
      completingClearTimerRef.current = window.setTimeout(() => {
        setCompletingDetailKey("");
        completingClearTimerRef.current = null;
      }, 620);
    }, 1650);
  };

  const cancelSelected = async (reason: string) => {
    if (!selectedDetail || remoteOperation) return;
    if (remoteMode) {
      try {
        setRemoteOperation({
          title: "Enviando cancelamento",
          message: "Atualizando status no Dataverse.",
          detailId: selectedDetail.id,
          phase: "loading"
        });
        await cancelServiceRemote(selectedDetail, reason);
        setRemoteOperation({
          title: "Enviando cancelamento",
          message: "Enviado com sucesso.",
          detailId: selectedDetail.id,
          phase: "success"
        });
        await wait(720);
        setSelectedDetail(null);
        setScreen("servicos");
        setToast("Cancelamento enviado para analise.");
        loadRemoteStore()
          .then((remote) => setStore((current) => ({ ...current, agenda: remote.agenda, history: remote.history })))
          .catch((error) => {
            reportAppError(error, {
              severity: "error",
              source: "app",
              action: "loadRemoteStore",
              phase: "after-cancel",
              screen: "servicos",
              detailId: selectedDetail.id,
              detailType: selectedDetail.type
            });
            setToast(error instanceof Error ? error.message : "Cancelado, mas falhou ao atualizar a agenda.");
          })
          .finally(() => {
            setRemoteOperation(null);
          });
        return;
      } catch (error) {
        logAppError(error, "cancelSelected", selectedDetail.type);
        setRemoteOperation(null);
        setToast(error instanceof Error ? error.message : "Falha ao cancelar no Dataverse.");
        return;
      }
    }
    const next = cancelDetailLocally(store, selectedDetail, reason);
    const historyItem = next.history[0];
    setStore(next);
    setSelectedDetail(historyItem.detail ?? null);
    setScreen("historico");
    setToast("Cancelado localmente.");
  };

  const saveVoucherDraft = (fields: Record<string, string>) => {
    if (!selectedDetail || selectedDetail.type !== "SERVICO") return;
    const detail = selectedDetail;
    setVoucherDrafts((current) => ({
      ...current,
      [getVoucherDraftKey(detail)]: fields
    }));

    if (!remoteMode) return;
    if (voucherDraftTimerRef.current) window.clearTimeout(voucherDraftTimerRef.current);
    voucherDraftTimerRef.current = window.setTimeout(() => {
      saveVoucherDraftRemote(detail, fields).catch((error) => {
        reportAppError(error, {
          severity: "error",
          source: "app",
          action: "saveVoucherDraftRemote",
          phase: "debounced-save",
          screen: "voucher",
          detailId: detail.id,
          detailType: detail.type
        });
        setToast(error instanceof Error ? error.message : "Falha ao salvar rascunho do voucher.");
      });
    }, 450);
  };

  const navigateFromInitial = (screenName: string) => {
    if (screenName === "servicos" || screenName === "historico" || screenName === "solicitarManutencao" || screenName === "gastos") {
      setScreen(screenName);
    }
  };

  const submitExpense = async (draft: ExpenseDraft) => {
    if (remoteOperation) return;
    if (!remoteMode) {
      setToast("Abra no Power Apps para registrar no Dataverse.");
      return;
    }

    try {
      setRemoteOperation({
        title: "Registrando gasto",
        message: "Identificando motorista.",
        phase: "loading"
      });
      const driver = driverContext ?? await getDriverContext();
      const veiculoId = draft.veiculoId || getDriverCurrentVehicleId(driver);
      setRemoteOperation({
        title: "Registrando gasto",
        message: "Criando despesa.",
        phase: "loading"
      });
      const payload = buildExpenseCreatePayload({
        draft,
        motoristaId: driver.id,
        veiculoId
      });
      const result = await createOne(DATAVERSE.despesas, payload);
      if (draft.notaFiscalDataUrl) {
        await uploadExpenseInvoiceRemote({
          expenseId: result.id,
          expenseName: String(payload.cr40f_nome ?? "Despesa"),
          motoristaId: driver.id,
          dataUrl: draft.notaFiscalDataUrl,
          fileName: draft.notaFiscalFileName,
          onProgress: (message) => setRemoteOperation({
            title: "Registrando gasto",
            message,
            detailId: result.id,
            phase: "loading"
          })
        });
      }
      setRemoteOperation({
        title: "Registrando gasto",
        message: "Despesa registrada.",
        detailId: result.id,
        phase: "success"
      });
      await wait(720);
      setRemoteOperation(null);
      setExpenseDraft({
        categoria: "",
        veiculoId: "",
        cidade: "",
        valor: "",
        dataGasto: new Date().toISOString().slice(0, 10),
        formaPagamento: "",
        descricao: "",
        kmInformado: "",
        litros: "",
        observacao: "",
        notaFiscalDataUrl: "",
        notaFiscalFileName: ""
      });
      setScreen("inicio");
      setToast("Gasto registrado.");
    } catch (error) {
      logAppError(error, "submitExpense", "create");
      setRemoteOperation(null);
      setCriticalError(error instanceof Error ? error.message : "Falha ao registrar gasto.");
    }
  };

  const submitMaintenanceRequest = async (fields: MaintenanceRequestFields) => {
    if (remoteOperation) return;
    if (!remoteMode) {
      setToast("Abra no Power Apps para enviar ao Dataverse.");
      return;
    }

    try {
      setRemoteOperation({
        title: "Solicitando manutenção",
        message: "Identificando motorista.",
        phase: "loading"
      });
      const driver = await getDriverContext();
      setRemoteOperation({
        title: "Solicitando manutenção",
        message: "Criando ordem de manutenção.",
        phase: "loading"
      });
      const result = await createMaintenanceRequestRemote({
        descricao: fields.descricao,
        kmAtual: fields.kmAtual,
        veiculoId: fields.veiculoId,
        motoristaId: driver.id,
        gravidade: fields.gravidade,
        photos: maintenanceRequestPhotos.map((photo) => photo.dataUrl),
        onProgress: (message) => setRemoteOperation({
          title: "Solicitando manutenção",
          message,
          phase: "loading"
        })
      });
      setRemoteOperation({
        title: "Solicitando manutenção",
        message: "Solicitação enviada.",
        detailId: result.id,
        phase: "success"
      });
      await wait(720);
      setRemoteOperation(null);
      setMaintenanceRequestDraft({ descricao: "", kmAtual: "", veiculoId: maintenanceCurrentVehicleId, gravidade: "" });
      setMaintenanceRequestPhotos([]);
      setScreen("inicio");
      setToast("Solicitação enviada para aprovação.");
    } catch (error) {
      logAppError(error, "submitMaintenanceRequest", "create");
      setRemoteOperation(null);
      setCriticalError(error instanceof Error ? error.message : "Falha ao solicitar manutenção.");
    }
  };

  const openMaintenanceRequestCamera = () => {
    setMaintenanceRequestPhotoDraft("");
    setMaintenanceRequestPreviewPhotoId("");
    setScreen("fotoSolicitacaoManutencao");
  };

  const openMaintenanceRequestNativePreview = (photoDataUrl: string) => {
    setMaintenanceRequestPhotoDraft(photoDataUrl);
    setMaintenanceRequestPreviewPhotoId("");
    setScreen("previewFotoSolicitacaoManutencao");
  };

  const openMaintenanceRequestPreview = (photoId: string) => {
    const photo = maintenanceRequestPhotos.find((item) => item.id === photoId);
    if (!photo) return;
    setMaintenanceRequestPhotoDraft(photo.dataUrl);
    setMaintenanceRequestPreviewPhotoId(photoId);
    setScreen("previewFotoSolicitacaoManutencao");
  };

  const confirmMaintenanceRequestPhoto = () => {
    if (!maintenanceRequestPhotoDraft) return setScreen("solicitarManutencao");
    if (maintenanceRequestPreviewPhotoId) {
      setMaintenanceRequestPhotos((current) =>
        current.map((photo) => photo.id === maintenanceRequestPreviewPhotoId ? { ...photo, dataUrl: maintenanceRequestPhotoDraft } : photo)
      );
    } else {
      setMaintenanceRequestPhotos((current) => [
        ...current,
        { id: `request-photo-${Date.now()}-${current.length + 1}`, dataUrl: maintenanceRequestPhotoDraft }
      ]);
    }
    setMaintenanceRequestPhotoDraft("");
    setMaintenanceRequestPreviewPhotoId("");
    setScreen("solicitarManutencao");
  };

  const deleteMaintenanceRequestPhoto = () => {
    if (maintenanceRequestPreviewPhotoId) {
      setMaintenanceRequestPhotos((current) => current.filter((photo) => photo.id !== maintenanceRequestPreviewPhotoId));
    }
    setMaintenanceRequestPhotoDraft("");
    setMaintenanceRequestPreviewPhotoId("");
    setScreen("solicitarManutencao");
  };

  if (screen === "canceladoLocal" && selectedDetail) {
    return show(
      <LocalCancelScreen
        detail={selectedDetail}
        onBack={() => setScreen("detalhes")}
        onWrongClick={() => setScreen("detalhes")}
        onSubmit={cancelSelected}
        submitState={remoteOperation?.phase ?? "idle"}
      />
    );
  }

  if (screen === "fotoSolicitacaoManutencao") {
    return show(
      <MaintenancePhotoScreen
        kind="FOTO1"
        title="Tire a foto da manutenção"
        onBack={() => setScreen("solicitarManutencao")}
        onCapture={(photoDataUrl) => {
          setMaintenanceRequestPhotoDraft(photoDataUrl);
          setScreen("previewFotoSolicitacaoManutencao");
        }}
        onSwitchCamera={() => setToast("Câmera alternada localmente.")}
      />
    );
  }

  if (screen === "previewFotoSolicitacaoManutencao") {
    return show(
      <MaintenancePhotoPreviewScreen
        kind="FOTO1"
        title="Foto da manutenção"
        prompt="A foto está legível?"
        photoDataUrl={maintenanceRequestPhotoDraft}
        onBack={() => setScreen("solicitarManutencao")}
        onRetake={() => setScreen("fotoSolicitacaoManutencao")}
        onNativeRetake={(photoDataUrl) => {
          setMaintenanceRequestPhotoDraft(photoDataUrl);
          setScreen("previewFotoSolicitacaoManutencao");
        }}
        onDelete={maintenanceRequestPreviewPhotoId ? deleteMaintenanceRequestPhoto : undefined}
        onConfirm={confirmMaintenanceRequestPhoto}
        confirmLabel={maintenanceRequestPreviewPhotoId ? "Voltar" : "Confirmar"}
        deleteOnly={Boolean(maintenanceRequestPreviewPhotoId)}
      />
    );
  }

  if (screen === "solicitarManutencao") {
    return show(
      <MaintenanceRequestScreen
        draft={maintenanceRequestDraft}
        photos={maintenanceRequestPhotos}
        onDraftChange={setMaintenanceRequestDraft}
        onAddPhoto={openMaintenanceRequestCamera}
        onNativeAddPhoto={openMaintenanceRequestNativePreview}
        onPreviewPhoto={openMaintenanceRequestPreview}
        onBack={() => setScreen("inicio")}
        onSubmit={submitMaintenanceRequest}
        submitState={remoteOperation?.phase ?? "idle"}
        vehicles={maintenanceVehicles}
        initialVehicleId={maintenanceCurrentVehicleId}
        vehiclesLoading={maintenanceVehiclesLoading}
      />
    );
  }

  if (screen === "gastos") {
    return show(
      <ExpenseScreen
        draft={expenseDraft}
        onDraftChange={setExpenseDraft}
        onBack={() => setScreen("inicio")}
        onSubmit={submitExpense}
        submitState={remoteOperation?.phase ?? "idle"}
        vehicles={maintenanceVehicles}
        vehiclesLoading={maintenanceVehiclesLoading}
        currentVehicleId={maintenanceCurrentVehicleId}
      />
    );
  }

  if (screen === "fotoManutencao" && selectedDetail) {
    return show(
      <MaintenancePhotoScreen
        kind={maintenancePhotoKind}
        onBack={() => setScreen("finalizar")}
        onCapture={(photoDataUrl) => {
          setPhotoDraft(photoDataUrl);
          setMaintenanceExistingPreview(false);
          setScreen("previewFotoManutencao");
        }}
        onSwitchCamera={() => setToast("Câmera alternada localmente.")}
      />
    );
  }

  if (screen === "previewFotoManutencao" && selectedDetail) {
    return show(
      <MaintenancePhotoPreviewScreen
        kind={maintenancePhotoKind}
        photoDataUrl={photoDraft}
        onBack={() => setScreen("finalizar")}
        onRetake={() => setScreen("fotoManutencao")}
        onNativeRetake={(photoDataUrl) => {
          setPhotoDraft(photoDataUrl);
          setMaintenanceExistingPreview(false);
          setScreen("previewFotoManutencao");
        }}
        onConfirm={() => {
          setStore((current) => saveMaintenancePhoto(current, selectedDetail.id, maintenancePhotoKind, photoDraft ?? ""));
          setToast("Foto salva localmente.");
          setMaintenanceExistingPreview(false);
          setScreen("finalizar");
        }}
        onDelete={maintenanceExistingPreview ? () => {
          setStore((current) => deleteFinalizationMaintenancePhoto(current, selectedDetail.id, maintenancePhotoKind));
          setToast("Foto apagada.");
          setPhotoDraft(null);
          setMaintenanceExistingPreview(false);
          setScreen("finalizar");
        } : undefined}
        deleteOnly={maintenanceExistingPreview}
      />
    );
  }

  if (screen === "finalizar" && selectedDetail) {
    return show(
      <FinalizeScreen
        detail={selectedDetail}
        onBack={() => setScreen("servicos")}
        onDone={finalizeSelected}
        confirmedPhotos={confirmedMaintenancePhotos}
        maintenancePhotos={store.photos[selectedDetail.id] ?? {}}
        maintenanceDraft={maintenanceFinalizeDraft}
        onMaintenanceDraftChange={setMaintenanceFinalizeDraft}
        submitState={remoteOperation?.phase ?? "idle"}
        onClearPhotos={() => {
          setStore((current) => clearMaintenancePhotos(current, selectedDetail.id));
          setToast("Fotos locais limpas.");
        }}
        onPreviewMaintenancePhoto={(kind) => {
          setMaintenancePhotoKind(kind);
          const existingPhoto = store.photos[selectedDetail.id]?.[kind];
          if (existingPhoto) {
            setPhotoDraft(existingPhoto);
            setMaintenanceExistingPreview(true);
            setScreen("previewFotoManutencao");
            return;
          }
          setPhotoDraft(null);
          setMaintenanceExistingPreview(false);
          setScreen("fotoManutencao");
        }}
        onCaptureMaintenancePhoto={(kind, photoDataUrl) => {
          setMaintenancePhotoKind(kind);
          setPhotoDraft(photoDataUrl);
          setMaintenanceExistingPreview(false);
          setScreen("previewFotoManutencao");
        }}
      />
    );
  }

  if (screen === "assinatura" && selectedDetail) {
    return show(
      <SignatureScreen
        detail={selectedDetail}
        onBack={() => setScreen("voucher")}
        onConfirm={(signatureDataUrl) => {
          if (signatureDataUrl) {
            setStore((current) => saveSignatureLocally(current, selectedDetail.id, signatureDataUrl));
            setToast("Assinatura salva localmente.");
          }
          setScreen("voucher");
        }}
      />
    );
  }

  if (screen === "voucher" && selectedDetail) {
    return show(
      <VoucherScreen
        detail={selectedDetail}
        hasSignature={Boolean(store.signatures[selectedDetail.id])}
        initialDraft={voucherDrafts[getVoucherDraftKey(selectedDetail)]}
        onBack={() => setScreen("servicos")}
        onOpenSignature={() => setScreen("assinatura")}
        onFinalize={finalizeSelected}
        onDraftChange={saveVoucherDraft}
        submitState={remoteOperation?.phase ?? "idle"}
      />
    );
  }

  if (screen === "detalhes" && selectedDetail) {
    return show(
      <DetailsScreen
        detail={selectedDetail}
        onBack={() => setScreen("servicos")}
        onOpenVoucher={() => setScreen("voucher")}
        onOpenFinalize={() => setScreen("finalizar")}
        onCancelLocal={() => setScreen("canceladoLocal")}
        onRefresh={() => refreshLocal(selectedDetail)}
        onCopy={() => {
          void navigator.clipboard?.writeText(detailsToClipboardText(selectedDetail));
          setToast("Informações copiadas.");
        }}
      />
    );
  }

  if (screen === "detalhesHistorico" && selectedDetail) {
    return show(<HistoryDetailsScreen detail={selectedDetail} onBack={() => setScreen("historico")} onRefresh={() => refreshLocal(selectedDetail)} />);
  }

  if (screen === "historico") {
    return show(
      <HistoryScreen
        items={store.history}
        onHome={() => setScreen("inicio")}
        onRefresh={refreshLocal}
        onOpenDetails={(detail) => {
          setSelectedDetail(detail);
          setScreen("detalhesHistorico");
        }}
      />
    );
  }

  if (screen === "servicos") {
    return show(
      <ServicesScreen
        items={store.agenda}
        onHome={() => setScreen("inicio")}
        onRefresh={refreshLocal}
        completingDetailKey={completingDetailKey}
        onOpenDetails={(detail) => {
          if (remoteMode) {
            markDetailViewedRemote(detail).catch((error) => {
              reportAppError(error, {
                severity: "error",
                source: "app",
                action: "markDetailViewedRemote",
                phase: "open-details",
                screen: "servicos",
                detailId: detail.id,
                detailType: detail.type
              });
              setToast(error instanceof Error ? error.message : "Falha ao marcar visualização.");
            });
          }
          setSelectedDetail(detail);
          setScreen("detalhes");
        }}
      />
    );
  }

  return show(
    <InitialScreen
      onNavigate={navigateFromInitial}
      onResetLocal={resetLocal}
      onRefresh={refreshLocal}
      services={store.agenda}
      driverName={driverContext?.fullName}
    />
  );
}

export default App;
