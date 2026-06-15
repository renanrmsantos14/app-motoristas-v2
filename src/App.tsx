import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  findFirstPendingDetail,
  getInitialDetail,
  getInitialParams,
  getVoucherDraftKey,
  initialStore,
  isSameDetail,
  loadStore,
  STORAGE_KEY
} from "./app/bootstrap";
import {
  getServiceTaskBackScreen,
  hasReceiveProofs,
  hasUploadedReceiveProofs,
  shouldRequireReceiveStep,
  shouldRouteServiceToVoucher
} from "./app/detailFlow";
import { AUTO_REFRESH_INTERVAL_MS, getScreenMotion, shouldAutoRefreshScreen } from "./app/navigation";
import {
  cancelServiceRemote,
  assertCollisionSchemaReadyRemote,
  assertExpenseSchemaReadyRemote,
  createMaintenanceRequestRemote,
  createOne,
  DATAVERSE,
  finalizeExchangeRemote,
  finalizeMaintenanceRemote,
  finalizeServiceRemote,
  getDriverContext,
  getDriverCurrentVehicleId,
  hasDataverseRuntime,
  loadCollisionLookupNavigationNamesRemote,
  loadExpenseReferenceDataRemote,
  loadExpenseLookupNavigationNamesRemote,
  loadMaintenanceRequestVehiclesRemote,
  loadRemoteDetailByParams,
  loadRemoteStore,
  markDetailViewedRemote,
  saveVoucherDraftRemote,
  saveVoucherRemote,
  updateOne,
  uploadCollisionPhotoRemote,
  uploadExpenseInvoiceRemote,
  uploadReceiveProofRemote,
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
import { LocalToast, type ToastState, type ToastTone } from "./components/common/LocalToast";
import { CollisionScreen } from "./screens/CollisionScreen";
import { ButtonPreviewScreen } from "./screens/ButtonPreviewScreen";
import { CollisionStartScreen } from "./screens/CollisionStartScreen";
import { DetailsScreen } from "./screens/DetailsScreen";
import { ExpenseScreen } from "./screens/ExpenseScreen";
import { FinalizeScreen, type MaintenanceFinalizeDraft } from "./screens/FinalizeScreen";
import { HistoryDetailsScreen } from "./screens/HistoryDetailsScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { InitialScreen } from "./screens/InitialScreen";
import { LocalCancelScreen } from "./screens/LocalCancelScreen";
import { MaintenancePhotoScreen } from "./screens/MaintenancePhotoScreen";
import { MaintenancePhotoPreviewScreen } from "./screens/MaintenancePhotoPreviewScreen";
import { ReceiveScreen } from "./screens/ReceiveScreen";
import { ReceiptPreviewScreen, ReceiptScreen } from "./screens/ReceiptScreen";
import {
  MaintenanceRequestScreen,
  type MaintenanceRequestDraft,
  type MaintenanceRequestFields,
  type MaintenanceRequestPhoto
} from "./screens/MaintenanceRequestScreen";
import { ServicesScreen } from "./screens/ServicesScreen";
import { SignatureScreen } from "./screens/SignatureScreen";
import { VoucherScreen } from "./screens/VoucherScreen";
import {
  COLLISION_ATTACHMENT_STATUS,
  buildCollisionCreatePayload,
  createEmptyCollisionDraft,
  getCollisionPhotoLabel,
  hasCollisionThirdParty,
  type CollisionDraft,
  type CollisionPhoto,
  type CollisionPhotoKind
} from "./lib/collisions";
import { DEFAULT_EXPENSE_REFERENCE_DATA, buildExpenseCreatePayload, type ExpenseDraft, type ExpensePhoto, type ExpenseReferenceData } from "./lib/expenses";
import type { DetailData, MaintenancePhotoKind, Screen } from "./types";

type RemoteOperation = {
  title: string;
  message: string;
  detailId?: string;
  phase: "loading" | "success";
};

type RefreshOptions = {
  silent?: boolean;
};

function FlowProgressOverlay({ operation }: { operation: RemoteOperation }) {
  return (
    <div className="flow-progress-overlay" role="status" aria-live="polite" aria-label={operation.title}>
      <div className={`flow-progress-card is-${operation.phase}`}>
        <div className="flow-progress-track" aria-hidden="true">
          <span />
        </div>
        <div className="flow-progress-kicker">{operation.detailId ?? "Processo remoto"}</div>
        <h2>{operation.title}</h2>
        <p>{operation.message}</p>
        <div className="flow-progress-note">Mantenha esta tela aberta.</div>
      </div>
    </div>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isTrueLike(value: unknown) {
  return value === true || value === 1 || value === "true";
}

function inferToastTone(message: string): ToastTone {
  const normalized = message.trim().toLowerCase();

  if (
    normalized.includes("falha") ||
    normalized.includes("erro") ||
    normalized.includes("não foi") ||
    normalized.includes("nao foi") ||
    normalized.includes("não encontrado") ||
    normalized.includes("nao encontrado")
  ) {
    return "error";
  }

  if (
    normalized.includes("atenção") ||
    normalized.includes("atencao") ||
    normalized.includes("aviso") ||
    normalized.includes("conclua") ||
    normalized.includes("ainda nao") ||
    normalized.includes("ainda não")
  ) {
    return "warning";
  }

  if (
    normalized.includes("salva") ||
    normalized.includes("salvo") ||
    normalized.includes("enviado") ||
    normalized.includes("registrado") ||
    normalized.includes("atualizado") ||
    normalized.includes("copiadas") ||
    normalized.includes("copiado") ||
    normalized.includes("reiniciados") ||
    normalized.includes("apagada") ||
    normalized.includes("apagado")
  ) {
    return "success";
  }

  return "info";
}

function App() {
  const devMode = useMemo(() => new URLSearchParams(window.location.search).get("dev") ?? "", []);
  const isButtonPreviewMode = devMode === "preview";
  const isReceiptPreviewMode = devMode === "recibo";
  const isLocalhostRuntime = useMemo(() => ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname), []);
  const [store, setStore] = useState<LocalStore>(() => loadStore());
  const initialDetailRef = useRef<DetailData | null>(getInitialDetail(store));
  const [screen, setScreen] = useState<Screen>(() => (initialDetailRef.current ? "detalhes" : "inicio"));
  const previousScreenRef = useRef<Screen>(initialDetailRef.current ? "detalhes" : "inicio");
  const [selectedDetail, setSelectedDetail] = useState<DetailData | null>(() => initialDetailRef.current);
  const [maintenancePhotoKind, setMaintenancePhotoKind] = useState<MaintenancePhotoKind>("NOTAFISCAL");
  const [photoDraft, setPhotoDraft] = useState<string | null>(null);
  const [photoDraftPreviewUrl, setPhotoDraftPreviewUrl] = useState("");
  const [toast, setToastState] = useState<ToastState | null>(null);
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
    categoriaId: "",
    veiculoId: "",
    valor: "",
    dataGasto: new Date().toISOString().slice(0, 10),
    formaPagamentoId: "",
    cidadeId: "",
    estabelecimento: "",
    descricao: "",
    kmInformado: "",
    litros: ""
  });
  const [expenseReferenceData, setExpenseReferenceData] = useState<ExpenseReferenceData>(DEFAULT_EXPENSE_REFERENCE_DATA);
  const [expenseReferenceLoading, setExpenseReferenceLoading] = useState(false);
  const [expenseReferenceError, setExpenseReferenceError] = useState("");
  const [expensePhotos, setExpensePhotos] = useState<ExpensePhoto[]>([]);
  const [expensePhotoDraft, setExpensePhotoDraft] = useState("");
  const [expensePhotoPreviewUrl, setExpensePhotoPreviewUrl] = useState("");
  const [expensePhotoPosterUrl, setExpensePhotoPosterUrl] = useState("");
  const [expensePhotoDurationLabel, setExpensePhotoDurationLabel] = useState("");
  const [expensePreviewPhotoId, setExpensePreviewPhotoId] = useState("");
  const [receiveProofs, setReceiveProofs] = useState<Record<string, ExpensePhoto[]>>({});
  const [receiveUploadedCounts, setReceiveUploadedCounts] = useState<Record<string, number>>({});
  const [receivePhotoDraft, setReceivePhotoDraft] = useState("");
  const [receivePhotoPreviewUrl, setReceivePhotoPreviewUrl] = useState("");
  const [receivePhotoPosterUrl, setReceivePhotoPosterUrl] = useState("");
  const [receivePhotoDurationLabel, setReceivePhotoDurationLabel] = useState("");
  const [receivePreviewPhotoId, setReceivePreviewPhotoId] = useState("");
  const [collisionDraft, setCollisionDraft] = useState<CollisionDraft>(() => createEmptyCollisionDraft());
  const [collisionPhotos, setCollisionPhotos] = useState<CollisionPhoto[]>([]);
  const [collisionPhotoDraft, setCollisionPhotoDraft] = useState("");
  const [collisionPhotoPreviewUrl, setCollisionPhotoPreviewUrl] = useState("");
  const [collisionPhotoPosterUrl, setCollisionPhotoPosterUrl] = useState("");
  const [collisionPhotoDurationLabel, setCollisionPhotoDurationLabel] = useState("");
  const [collisionPhotoKind, setCollisionPhotoKind] = useState<CollisionPhotoKind>("cena");
  const [collisionPreviewPhotoId, setCollisionPreviewPhotoId] = useState("");
  const [maintenanceRequestPhotos, setMaintenanceRequestPhotos] = useState<MaintenanceRequestPhoto[]>([]);
  const [maintenanceRequestPhotoDraft, setMaintenanceRequestPhotoDraft] = useState("");
  const [maintenanceRequestPhotoPreviewUrl, setMaintenanceRequestPhotoPreviewUrl] = useState("");
  const [maintenanceRequestPhotoPosterUrl, setMaintenanceRequestPhotoPosterUrl] = useState("");
  const [maintenanceRequestPhotoDurationLabel, setMaintenanceRequestPhotoDurationLabel] = useState("");
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

  const setToast = (message: string, tone?: ToastTone) => {
    const trimmed = message.trim();
    if (!trimmed) {
      setToastState(null);
      return;
    }

    setToastState({
      id: Date.now() + Math.floor(Math.random() * 1000),
      message: trimmed,
      tone: tone ?? inferToastTone(trimmed)
    });
  };

  useEffect(() => {
    if (isButtonPreviewMode || isReceiptPreviewMode) return;
    if (remoteMode) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (error) {
      reportAppError(error, {
        severity: "warning",
        source: "app",
        action: "persistLocalStore",
        phase: "localStorage",
        screen
      });
    }
  }, [isButtonPreviewMode, isReceiptPreviewMode, remoteMode, screen, store]);

  useEffect(() => {
    if (isButtonPreviewMode || isReceiptPreviewMode) return;
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
  }, [isButtonPreviewMode, isReceiptPreviewMode]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToastState(null), toast.tone === "error" ? 3600 : 3000);
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
  const canGeneratePersonalReceipt =
    isTrueLike(driverContext?.funcionario?.cr40f_gerarrecibopersonalizado) ||
    isLocalhostRuntime;

  useEffect(() => {
    previousScreenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    if ((screen !== "solicitarManutencao" && screen !== "gastos" && screen !== "colisoes") || !remoteMode) return;
    let alive = true;
    setMaintenanceVehiclesLoading(true);
    getDriverContext()
      .then(async (driver) => {
        const vehicles = await loadMaintenanceRequestVehiclesRemote(driver, { onlyOwnCategory: screen === "solicitarManutencao" });
        if (!alive) return;
        setDriverContext(driver);
        const currentVehicleId = getDriverCurrentVehicleId(driver);
        const availableCurrentVehicleId = vehicles.some((vehicle) => vehicle.id === currentVehicleId) ? currentVehicleId : "";
        setMaintenanceCurrentVehicleId(availableCurrentVehicleId);
        setMaintenanceRequestDraft((current) => (
          current.veiculoId && !vehicles.some((vehicle) => vehicle.id === current.veiculoId)
            ? { ...current, veiculoId: "" }
            : current
        ));
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

  useEffect(() => {
    if (screen !== "gastos" || !remoteMode) return;
    let alive = true;
    setExpenseReferenceLoading(true);
    setExpenseReferenceError("");
    setExpenseReferenceData({ categories: [], paymentMethods: [], cities: [] });
    loadExpenseReferenceDataRemote()
      .then((referenceData) => {
        if (!alive) return;
        setExpenseReferenceData(referenceData);
        setExpenseReferenceError("");
      })
      .catch((error) => {
        if (!alive) return;
        reportAppError(error, {
          severity: "error",
          source: "app",
          action: "loadExpenseReferenceDataRemote",
          phase: "expense-form",
          screen
        });
        const message = error instanceof Error ? error.message : "Falha ao carregar categorias de despesas.";
        setExpenseReferenceError(message);
        setToast(message);
      })
      .finally(() => {
        if (alive) setExpenseReferenceLoading(false);
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
      <LocalToast toast={toast} onDismiss={() => setToastState(null)} />
      {remoteOperation ? <FlowProgressOverlay operation={remoteOperation} /> : null}
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

  if (isButtonPreviewMode) {
    return show(<ButtonPreviewScreen onShowToast={setToast} />);
  }

  if (isReceiptPreviewMode) {
    return show(<ReceiptPreviewScreen />);
  }

  const refreshLocal = async (detailToRefresh?: DetailData, options?: RefreshOptions) => {
    const silent = options?.silent === true;

    if (remoteMode) {
      if (!silent) setToast("Atualizando Dataverse.");
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
        if (!silent) setToast("Atualizado do Dataverse.");
      } catch (error) {
        logAppError(error, "loadRemoteStore", "refresh");
        if (!silent || error instanceof Error) {
          setToast(error instanceof Error ? error.message : "Falha ao atualizar Dataverse.");
        }
      }
      return;
    }
    setStore((current) => ({ ...current }));
    if (!silent) setToast("Atualizado localmente.");
  };

  useEffect(() => {
    if (!remoteMode || remoteOperation || !shouldAutoRefreshScreen(screen)) return;

    const autoRefresh = () => {
      if (document.hidden) return;
      void refreshLocal(selectedDetail ?? undefined, { silent: true });
    };

    const timer = window.setInterval(autoRefresh, AUTO_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [remoteMode, remoteOperation, screen, selectedDetail]);

  const resetLocal = () => {
    const next = initialStore();
    setStore(next);
    setReceiveProofs({});
    setReceiveUploadedCounts({});
    setSelectedDetail(null);
    setScreen("inicio");
    setToast("Dados locais reiniciados.");
  };

  const finalizeSelected = async (fields: Record<string, string>) => {
    if (!selectedDetail || remoteOperation) return;
    const detailToFinalize = selectedDetail;
    const receiveProofCount = receiveProofs[detailToFinalize.id]?.length ?? 0;
    const finalFields =
      receiveProofCount > 0
        ? { ...fields, "Comprovantes de Recebimento": `${receiveProofCount} comprovante(s) anexado(s).` }
        : fields;
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
      const isVoucher = "Horario Inicial" in finalFields || "Horário Inicial" in finalFields;
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
        const isVoucher = "Horario Inicial" in finalFields || "Horário Inicial" in finalFields;

        if (detailToFinalize.type === "SERVICO" && isVoucher) {
          await saveVoucherRemote({ detail: detailToFinalize, fields: finalFields, signatureDataUrl, photos, onProgress: setProgress });
        } else if (detailToFinalize.type === "SERVICO") {
          await finalizeServiceRemote({ detail: detailToFinalize, fields: finalFields, signatureDataUrl, photos, onProgress: setProgress });
        } else if (detailToFinalize.type === "MANUTENCAO") {
          await finalizeMaintenanceRemote({ detail: detailToFinalize, fields: finalFields, signatureDataUrl, photos, onProgress: setProgress });
        } else if (detailToFinalize.type === "TROCA") {
          await finalizeExchangeRemote({ detail: detailToFinalize, fields: finalFields, signatureDataUrl, photos, onProgress: setProgress });
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
          setStore((current) => finalizeDetailLocally(current, detailToFinalize, finalFields));
        }
      } else {
        setStore((current) => finalizeDetailLocally(current, detailToFinalize, finalFields));
      }
      setReceiveProofs((current) => {
        if (!current[detailToFinalize.id]) return current;
        const next = { ...current };
        delete next[detailToFinalize.id];
        return next;
      });
      setReceiveUploadedCounts((current) => {
        if (!current[detailToFinalize.id]) return current;
        const next = { ...current };
        delete next[detailToFinalize.id];
        return next;
      });
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
    const detailToCancel = selectedDetail;
    if (remoteMode) {
      try {
        setRemoteOperation({
          title: "Enviando cancelamento",
          message: "Atualizando status no Dataverse.",
          detailId: detailToCancel.id,
          phase: "loading"
        });
        await cancelServiceRemote(detailToCancel, reason);
        setRemoteOperation({
          title: "Enviando cancelamento",
          message: "Enviado com sucesso.",
          detailId: detailToCancel.id,
          phase: "success"
        });
        await wait(720);
        setSelectedDetail(null);
        setScreen("servicos");
        setToast("Cancelamento enviado para analise.");
        setReceiveProofs((current) => {
          if (!current[detailToCancel.id]) return current;
          const next = { ...current };
          delete next[detailToCancel.id];
          return next;
        });
        setReceiveUploadedCounts((current) => {
          if (!current[detailToCancel.id]) return current;
          const next = { ...current };
          delete next[detailToCancel.id];
          return next;
        });
        loadRemoteStore()
          .then((remote) => setStore((current) => ({ ...current, agenda: remote.agenda, history: remote.history })))
          .catch((error) => {
            reportAppError(error, {
              severity: "error",
              source: "app",
              action: "loadRemoteStore",
              phase: "after-cancel",
              screen: "servicos",
              detailId: detailToCancel.id,
              detailType: detailToCancel.type
            });
            setToast(error instanceof Error ? error.message : "Cancelado, mas falhou ao atualizar a agenda.");
          })
          .finally(() => {
            setRemoteOperation(null);
          });
        return;
      } catch (error) {
        logAppError(error, "cancelSelected", detailToCancel.type);
        setRemoteOperation(null);
        setToast(error instanceof Error ? error.message : "Falha ao cancelar no Dataverse.");
        return;
      }
    }
    const next = cancelDetailLocally(store, detailToCancel, reason);
    const historyItem = next.history[0];
    setStore(next);
    setReceiveProofs((current) => {
      if (!current[detailToCancel.id]) return current;
      const copy = { ...current };
      delete copy[detailToCancel.id];
      return copy;
    });
    setReceiveUploadedCounts((current) => {
      if (!current[detailToCancel.id]) return current;
      const copy = { ...current };
      delete copy[detailToCancel.id];
      return copy;
    });
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
    if (screenName === "servicos" || screenName === "historico" || screenName === "solicitarManutencao" || screenName === "gastos" || screenName === "colisoesInicio") {
      setScreen(screenName);
    }
  };

  const submitExpense = async (draft: ExpenseDraft) => {
    if (remoteOperation) return;
    if (!remoteMode) {
      setToast("Abra no Power Apps para registrar no Dataverse.");
      return;
    }

    let createdExpenseId = "";
    try {
      setRemoteOperation({
        title: "Registrando gasto",
        message: "Identificando motorista.",
        phase: "loading"
      });
      const driver = driverContext ?? await getDriverContext();
      const veiculoId = draft.veiculoId || getDriverCurrentVehicleId(driver);
      const photosToSubmit = expensePhotos.filter((photo) => Boolean(photo.dataUrl));
      setRemoteOperation({
        title: "Registrando gasto",
        message: "Conferindo schema do Dataverse.",
        phase: "loading"
      });
      await assertExpenseSchemaReadyRemote();
      const lookupNavigationNames = await loadExpenseLookupNavigationNamesRemote({
        includeVeiculo: Boolean(draft.veiculoId || veiculoId),
        includeReserva: false
      });
      setRemoteOperation({
        title: "Registrando gasto",
        message: "Criando despesa.",
        phase: "loading"
      });
      const payload = buildExpenseCreatePayload({
        draft,
        photos: photosToSubmit,
        referenceData: expenseReferenceData,
        motoristaId: driver.id,
        veiculoId,
        categoryEntitySet: DATAVERSE.categoriasDespesasOperacionais,
        paymentMethodEntitySet: DATAVERSE.formasPagamentoDespesas,
        cityEntitySet: DATAVERSE.cidades,
        motoristaEntitySet: DATAVERSE.funcionarios,
        veiculoEntitySet: DATAVERSE.veiculos,
        reservaEntitySet: DATAVERSE.geral,
        lookupNavigationNames
      });
      const result = await createOne(DATAVERSE.despesasOperacionais, payload);
      createdExpenseId = result.id;
      if (photosToSubmit.length) {
        let completedUploads = 0;
        setRemoteOperation({
          title: "Registrando gasto",
          message: `Enviando ${photosToSubmit.length} arquivo(s) em paralelo (0/${photosToSubmit.length}).`,
          detailId: result.id,
          phase: "loading"
        });
        const uploadResults = await Promise.allSettled(photosToSubmit.map(async (photo, index) => {
          const link = await uploadExpenseInvoiceRemote({
            expenseId: result.id,
            expenseName: String(payload.cr40f_nome ?? "Despesa"),
            motoristaId: driver.id,
            dataUrl: photo.dataUrl,
            fileName: photo.mediaType === "video" ? `video-comprovante-${index + 1}` : `comprovante-${index + 1}`,
            order: index + 1,
            onProgress: (message) => setRemoteOperation({
              title: "Registrando gasto",
              message: `Uploads paralelos: ${message}`,
              detailId: result.id,
              phase: "loading"
            })
          });
          completedUploads += 1;
          setRemoteOperation({
            title: "Registrando gasto",
            message: `Uploads paralelos concluídos (${completedUploads}/${photosToSubmit.length}).`,
            detailId: result.id,
            phase: "loading"
          });
          return link;
        }));
        const failedUploads = uploadResults.filter((uploadResult) => uploadResult.status === "rejected").length;
        if (failedUploads) {
          throw new Error(`Despesa criada, mas ${failedUploads} de ${photosToSubmit.length} arquivo(s) falharam no upload.`);
        }
      }
      if (photosToSubmit.length) {
        await updateOne(DATAVERSE.despesasOperacionais, result.id, { cr40f_statusanexo: 100000002 });
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
        categoriaId: "",
        veiculoId: "",
        valor: "",
        dataGasto: new Date().toISOString().slice(0, 10),
        formaPagamentoId: "",
        cidadeId: "",
        estabelecimento: "",
        descricao: "",
        kmInformado: "",
        litros: ""
      });
      setExpensePhotos([]);
      setExpensePhotoDraft("");
      setExpensePhotoPreviewUrl("");
      setExpensePhotoPosterUrl("");
      setExpensePhotoDurationLabel("");
      setExpensePreviewPhotoId("");
      setScreen("inicio");
      setToast("Gasto registrado.");
    } catch (error) {
      if (createdExpenseId) {
        try {
          await updateOne(DATAVERSE.despesasOperacionais, createdExpenseId, { cr40f_statusanexo: 100000003 });
        } catch (statusError) {
          logAppError(statusError, "submitExpense", "statusanexo");
        }
      }
      logAppError(error, "submitExpense", "create");
      setRemoteOperation(null);
      setCriticalError(error instanceof Error ? error.message : "Falha ao registrar gasto.");
    }
  };

  const submitCollision = async (draft: CollisionDraft) => {
    if (remoteOperation) return;
    if (!remoteMode) {
      setToast("Abra no Power Apps para registrar no Dataverse.");
      return;
    }

    let createdCollisionId = "";
    let uploadedCount = 0;
    try {
      setRemoteOperation({
        title: "Registrando colisão",
        message: "Identificando motorista.",
        phase: "loading"
      });
      const driver = driverContext ?? await getDriverContext();
      const veiculoId = draft.veiculoId || getDriverCurrentVehicleId(driver);
      const collisionHasThirdParty = hasCollisionThirdParty(draft);
      const photosToSubmit = collisionPhotos.filter((photo) =>
        Boolean(photo.dataUrl) &&
        (collisionHasThirdParty || (photo.kind !== "danoTerceiro" && photo.kind !== "documentoTerceiro"))
      );
      setRemoteOperation({
        title: "Registrando colisão",
        message: "Conferindo schema do Dataverse.",
        phase: "loading"
      });
      await assertCollisionSchemaReadyRemote();
      const lookupNavigationNames = await loadCollisionLookupNavigationNamesRemote();
      setRemoteOperation({
        title: "Registrando colisão",
        message: "Criando ocorrência.",
        phase: "loading"
      });
      const payload = buildCollisionCreatePayload({
        draft,
        photos: photosToSubmit,
        motoristaId: driver.id,
        veiculoId,
        motoristaEntitySet: DATAVERSE.funcionarios,
        veiculoEntitySet: DATAVERSE.veiculos,
        lookupNavigationNames
      });
      const result = await createOne(DATAVERSE.colisoes, payload);
      createdCollisionId = result.id;
      const collisionName = String(payload.cr40f_nome ?? "Colisão");
      if (photosToSubmit.length) {
        setRemoteOperation({
          title: "Registrando colisão",
          message: `Enviando ${photosToSubmit.length} arquivo(s) em paralelo (0/${photosToSubmit.length}).`,
          detailId: result.id,
          phase: "loading"
        });
        const uploadResults = await Promise.allSettled(photosToSubmit.map(async (photo, index) => {
          const link = await uploadCollisionPhotoRemote({
            collisionId: result.id,
            collisionName,
            motoristaId: driver.id,
            dataUrl: photo.dataUrl,
            kind: photo.kind,
            order: index + 1,
            onProgress: (message) => setRemoteOperation({
              title: "Registrando colisão",
              message: `Uploads paralelos: ${message}`,
              detailId: result.id,
              phase: "loading"
            })
          });
          uploadedCount += 1;
          setRemoteOperation({
            title: "Registrando colisão",
            message: `Uploads paralelos concluídos (${uploadedCount}/${photosToSubmit.length}).`,
            detailId: result.id,
            phase: "loading"
          });
          return link;
        }));
        const failedUploads = uploadResults.filter((uploadResult) => uploadResult.status === "rejected").length;
        if (failedUploads) {
          throw new Error(`Colisão criada, mas ${failedUploads} de ${photosToSubmit.length} arquivo(s) falharam no upload.`);
        }
      }
      if (photosToSubmit.length) {
        await updateOne(DATAVERSE.colisoes, result.id, { cr40f_statusanexo: COLLISION_ATTACHMENT_STATUS.completo });
      }
      setRemoteOperation({
        title: "Registrando colisão",
        message: "Colisão registrada.",
        detailId: result.id,
        phase: "success"
      });
      await wait(720);
      setRemoteOperation(null);
      setCollisionDraft(createEmptyCollisionDraft());
      setCollisionPhotos([]);
      setCollisionPhotoDraft("");
      setCollisionPhotoPreviewUrl("");
      setCollisionPhotoPosterUrl("");
      setCollisionPhotoDurationLabel("");
      setCollisionPreviewPhotoId("");
      setScreen("inicio");
      setToast("Colisão registrada.");
    } catch (error) {
      if (createdCollisionId) {
        try {
          await updateOne(DATAVERSE.colisoes, createdCollisionId, {
            cr40f_statusanexo: uploadedCount > 0 ? COLLISION_ATTACHMENT_STATUS.parcial : COLLISION_ATTACHMENT_STATUS.falhou
          });
        } catch (statusError) {
          logAppError(statusError, "submitCollision", "statusanexo");
        }
      }
      logAppError(error, "submitCollision", "create");
      setRemoteOperation(null);
      setCriticalError(error instanceof Error ? error.message : "Falha ao registrar colisão.");
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
      setMaintenanceRequestPhotoDraft("");
      setMaintenanceRequestPhotoPreviewUrl("");
      setMaintenanceRequestPhotoPosterUrl("");
      setMaintenanceRequestPhotoDurationLabel("");
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
    setMaintenanceRequestPhotoPreviewUrl("");
    setMaintenanceRequestPhotoPosterUrl("");
    setMaintenanceRequestPhotoDurationLabel("");
    setMaintenanceRequestPreviewPhotoId("");
    setScreen("fotoSolicitacaoManutencao");
  };

  const openMaintenanceRequestVideoPreview = (videoDataUrl: string, _previewUrl: string, posterUrl: string, durationLabel = "") => {
    setMaintenanceRequestPhotoDraft(videoDataUrl);
    setMaintenanceRequestPhotoPreviewUrl("");
    setMaintenanceRequestPhotoPosterUrl(posterUrl);
    setMaintenanceRequestPhotoDurationLabel(durationLabel);
    setMaintenanceRequestPreviewPhotoId("");
    setScreen("previewFotoSolicitacaoManutencao");
  };

  const openMaintenanceRequestPreview = (photoId: string) => {
    const photo = maintenanceRequestPhotos.find((item) => item.id === photoId);
    if (!photo) return;
    setMaintenanceRequestPhotoDraft(photo.dataUrl);
    setMaintenanceRequestPhotoPreviewUrl(photo.previewUrl ?? "");
    setMaintenanceRequestPhotoPosterUrl(photo.posterUrl ?? "");
    setMaintenanceRequestPhotoDurationLabel(photo.durationLabel ?? "");
    setMaintenanceRequestPreviewPhotoId(photoId);
    setScreen("previewFotoSolicitacaoManutencao");
  };

  const confirmMaintenanceRequestPhoto = () => {
    if (!maintenanceRequestPhotoDraft) return setScreen("solicitarManutencao");
    if (maintenanceRequestPreviewPhotoId) {
      setMaintenanceRequestPhotos((current) =>
        current.map((photo) => photo.id === maintenanceRequestPreviewPhotoId ? {
          ...photo,
          dataUrl: maintenanceRequestPhotoDraft,
          previewUrl: maintenanceRequestPhotoPreviewUrl || undefined,
          posterUrl: maintenanceRequestPhotoPosterUrl || undefined,
          durationLabel: maintenanceRequestPhotoDurationLabel || undefined,
          mediaType: maintenanceRequestPhotoDraft.startsWith("data:video/") ? "video" : "foto"
        } : photo)
      );
    } else {
      setMaintenanceRequestPhotos((current) => [
        ...current,
        {
          id: `request-photo-${Date.now()}-${current.length + 1}`,
          dataUrl: maintenanceRequestPhotoDraft,
          previewUrl: maintenanceRequestPhotoPreviewUrl || undefined,
          posterUrl: maintenanceRequestPhotoPosterUrl || undefined,
          durationLabel: maintenanceRequestPhotoDurationLabel || undefined,
          mediaType: maintenanceRequestPhotoDraft.startsWith("data:video/") ? "video" : "foto"
        }
      ]);
    }
    setMaintenanceRequestPhotoDraft("");
    setMaintenanceRequestPhotoPreviewUrl("");
    setMaintenanceRequestPhotoPosterUrl("");
    setMaintenanceRequestPhotoDurationLabel("");
    setMaintenanceRequestPreviewPhotoId("");
    setScreen("solicitarManutencao");
  };

  const deleteMaintenanceRequestPhoto = () => {
    if (maintenanceRequestPreviewPhotoId) {
      setMaintenanceRequestPhotos((current) => current.filter((photo) => photo.id !== maintenanceRequestPreviewPhotoId));
    }
    setMaintenanceRequestPhotoDraft("");
    setMaintenanceRequestPhotoPreviewUrl("");
    setMaintenanceRequestPhotoPosterUrl("");
    setMaintenanceRequestPhotoDurationLabel("");
    setMaintenanceRequestPreviewPhotoId("");
    setScreen("solicitarManutencao");
  };

  const openExpenseCamera = () => {
    setExpensePhotoDraft("");
    setExpensePhotoPreviewUrl("");
    setExpensePhotoPosterUrl("");
    setExpensePhotoDurationLabel("");
    setExpensePreviewPhotoId("");
    setScreen("fotoGasto");
  };

  const openExpenseVideoPreview = (videoDataUrl: string, _previewUrl: string, posterUrl: string, durationLabel = "") => {
    setExpensePhotoDraft(videoDataUrl);
    setExpensePhotoPreviewUrl("");
    setExpensePhotoPosterUrl(posterUrl);
    setExpensePhotoDurationLabel(durationLabel);
    setExpensePreviewPhotoId("");
    setScreen("previewFotoGasto");
  };

  const openExpensePreview = (photoId: string) => {
    const photo = expensePhotos.find((item) => item.id === photoId);
    if (!photo) return;
    setExpensePhotoDraft(photo.dataUrl);
    setExpensePhotoPreviewUrl(photo.previewUrl ?? "");
    setExpensePhotoPosterUrl(photo.posterUrl ?? "");
    setExpensePhotoDurationLabel(photo.durationLabel ?? "");
    setExpensePreviewPhotoId(photoId);
    setScreen("previewFotoGasto");
  };

  const confirmExpensePhoto = () => {
    if (!expensePhotoDraft) return setScreen("gastos");
    if (expensePreviewPhotoId) {
      setExpensePhotos((current) =>
        current.map((photo) => photo.id === expensePreviewPhotoId ? {
          ...photo,
          dataUrl: expensePhotoDraft,
          previewUrl: expensePhotoPreviewUrl || undefined,
          posterUrl: expensePhotoPosterUrl || undefined,
          durationLabel: expensePhotoDurationLabel || undefined,
          mediaType: expensePhotoDraft.startsWith("data:video/") ? "video" : "foto"
        } : photo)
      );
    } else {
      setExpensePhotos((current) => [
        ...current,
        {
          id: `expense-photo-${Date.now()}-${current.length + 1}`,
          dataUrl: expensePhotoDraft,
          previewUrl: expensePhotoPreviewUrl || undefined,
          posterUrl: expensePhotoPosterUrl || undefined,
          durationLabel: expensePhotoDurationLabel || undefined,
          mediaType: expensePhotoDraft.startsWith("data:video/") ? "video" : "foto"
        }
      ]);
    }
    setExpensePhotoDraft("");
    setExpensePhotoPreviewUrl("");
    setExpensePhotoPosterUrl("");
    setExpensePhotoDurationLabel("");
    setExpensePreviewPhotoId("");
    setScreen("gastos");
  };

  const deleteExpensePhoto = () => {
    if (expensePreviewPhotoId) {
      setExpensePhotos((current) => current.filter((photo) => photo.id !== expensePreviewPhotoId));
    }
    setExpensePhotoDraft("");
    setExpensePhotoPreviewUrl("");
    setExpensePhotoPosterUrl("");
    setExpensePhotoDurationLabel("");
    setExpensePreviewPhotoId("");
    setScreen("gastos");
  };

  const openReceiveCamera = () => {
    setReceivePhotoDraft("");
    setReceivePhotoPreviewUrl("");
    setReceivePhotoPosterUrl("");
    setReceivePhotoDurationLabel("");
    setReceivePreviewPhotoId("");
    setScreen("fotoReceber");
  };

  const openReceiveVideoPreview = (videoDataUrl: string, _previewUrl: string, posterUrl: string, durationLabel = "") => {
    setReceivePhotoDraft(videoDataUrl);
    setReceivePhotoPreviewUrl("");
    setReceivePhotoPosterUrl(posterUrl);
    setReceivePhotoDurationLabel(durationLabel);
    setReceivePreviewPhotoId("");
    setScreen("previewFotoReceber");
  };

  const openReceivePreview = (photoId: string) => {
    if (!selectedDetail) return;
    const photo = receiveProofs[selectedDetail.id]?.find((item) => item.id === photoId);
    if (!photo) return;
    setReceivePhotoDraft(photo.dataUrl);
    setReceivePhotoPreviewUrl(photo.previewUrl ?? "");
    setReceivePhotoPosterUrl(photo.posterUrl ?? "");
    setReceivePhotoDurationLabel(photo.durationLabel ?? "");
    setReceivePreviewPhotoId(photoId);
    setScreen("previewFotoReceber");
  };

  const confirmReceivePhoto = () => {
    if (!selectedDetail) return setScreen("servicos");
    if (!receivePhotoDraft) return setScreen("receber");

    setReceiveProofs((current) => {
      const detailPhotos = current[selectedDetail.id] ?? [];
      const nextPhoto: ExpensePhoto = {
        id: receivePreviewPhotoId || `receive-photo-${Date.now()}-${detailPhotos.length + 1}`,
        dataUrl: receivePhotoDraft,
        previewUrl: receivePhotoPreviewUrl || undefined,
        posterUrl: receivePhotoPosterUrl || undefined,
        durationLabel: receivePhotoDurationLabel || undefined,
        mediaType: receivePhotoDraft.startsWith("data:video/") ? "video" : "foto"
      };
      const nextPhotos = receivePreviewPhotoId
        ? detailPhotos.map((photo) => (photo.id === receivePreviewPhotoId ? nextPhoto : photo))
        : [...detailPhotos, nextPhoto];
      return {
        ...current,
        [selectedDetail.id]: nextPhotos
      };
    });
    setReceiveUploadedCounts((current) => {
      if (!current[selectedDetail.id]) return current;
      const next = { ...current };
      delete next[selectedDetail.id];
      return next;
    });

    setReceivePhotoDraft("");
    setReceivePhotoPreviewUrl("");
    setReceivePhotoPosterUrl("");
    setReceivePhotoDurationLabel("");
    setReceivePreviewPhotoId("");
    setScreen("receber");
  };

  const deleteReceivePhoto = () => {
    if (!selectedDetail) return;
    if (receivePreviewPhotoId) {
      setReceiveProofs((current) => ({
        ...current,
        [selectedDetail.id]: (current[selectedDetail.id] ?? []).filter((photo) => photo.id !== receivePreviewPhotoId)
      }));
    }
    setReceiveUploadedCounts((current) => {
      if (!current[selectedDetail.id]) return current;
      const next = { ...current };
      delete next[selectedDetail.id];
      return next;
    });
    setReceivePhotoDraft("");
    setReceivePhotoPreviewUrl("");
    setReceivePhotoPosterUrl("");
    setReceivePhotoDurationLabel("");
    setReceivePreviewPhotoId("");
    setScreen("receber");
  };

  const continueAfterReceive = async () => {
    if (!selectedDetail || remoteOperation) return;
    const detailToContinue = selectedDetail;
    const photos = receiveProofs[detailToContinue.id] ?? [];
    if (!photos.length) return;

    const goNext = () => setScreen(shouldRouteServiceToVoucher(detailToContinue) ? "voucher" : "finalizar");

    if (hasUploadedReceiveProofs(detailToContinue, receiveProofs, receiveUploadedCounts) || !remoteMode) {
      goNext();
      return;
    }

    const dvId = detailToContinue.dataverse?.id;
    if (!dvId) {
      goNext();
      return;
    }

    try {
      setRemoteOperation({
        title: "Enviando comprovantes",
        message: "Preparando upload dos comprovantes.",
        detailId: detailToContinue.id,
        phase: "loading"
      });
      let completedUploads = 0;
      const uploadResults = await Promise.allSettled(
        photos.map(async (photo, index) => {
          const link = await uploadReceiveProofRemote({
            reservaId: dvId,
            reservaName: detailToContinue.id,
            motoristaId: driverContext?.id,
            dataUrl: photo.dataUrl,
            fileName: photo.id,
            order: index + 1,
            onProgress: (message) =>
              setRemoteOperation({
                title: "Enviando comprovantes",
                message,
                detailId: detailToContinue.id,
                phase: "loading"
              })
          });
          completedUploads += 1;
          setRemoteOperation({
            title: "Enviando comprovantes",
            message: `Comprovantes enviados (${completedUploads}/${photos.length}).`,
            detailId: detailToContinue.id,
            phase: "loading"
          });
          return link;
        })
      );
      const failedUploads = uploadResults.filter((result) => result.status === "rejected").length;
      if (failedUploads) {
        throw new Error(`${failedUploads} de ${photos.length} comprovante(s) falharam no upload.`);
      }
      setReceiveUploadedCounts((current) => ({ ...current, [detailToContinue.id]: photos.length }));
      setRemoteOperation({
        title: "Enviando comprovantes",
        message: "Comprovantes enviados com sucesso.",
        detailId: detailToContinue.id,
        phase: "success"
      });
      await wait(420);
      setRemoteOperation(null);
      goNext();
    } catch (error) {
      logAppError(error, "continueAfterReceive", detailToContinue.type);
      setRemoteOperation(null);
      setCriticalError(error instanceof Error ? error.message : "Falha ao enviar comprovantes de recebimento.");
    }
  };

  const openVoucherFlow = () => {
    if (!selectedDetail) return;
    if (
      shouldRequireReceiveStep(selectedDetail) &&
      (!hasReceiveProofs(selectedDetail, receiveProofs) || (remoteMode && !hasUploadedReceiveProofs(selectedDetail, receiveProofs, receiveUploadedCounts)))
    ) {
      setScreen("receber");
      return;
    }
    setScreen("voucher");
  };

  const openFinalizeFlow = () => {
    if (!selectedDetail) return;
    if (
      shouldRequireReceiveStep(selectedDetail) &&
      (!hasReceiveProofs(selectedDetail, receiveProofs) || (remoteMode && !hasUploadedReceiveProofs(selectedDetail, receiveProofs, receiveUploadedCounts)))
    ) {
      setScreen("receber");
      return;
    }
    setScreen("finalizar");
  };

  const openPersonalReceipt = () => {
    if (!selectedDetail) return;
    setScreen("reciboPersonalizado");
  };

  const startCollision = (type: CollisionDraft["tipoOcorrencia"]) => {
    setCollisionDraft((current) => ({
      ...current,
      tipoOcorrencia: type,
      houveTerceiro: type === "bateram_em_mim" ? true : current.houveTerceiro,
      veiculoId: current.veiculoId || maintenanceCurrentVehicleId
    }));
    setScreen("colisoes");
  };

  const openCollisionCamera = (kind: CollisionPhotoKind) => {
    setCollisionPhotoKind(kind);
    setCollisionPhotoDraft("");
    setCollisionPhotoPreviewUrl("");
    setCollisionPhotoPosterUrl("");
    setCollisionPhotoDurationLabel("");
    setCollisionPreviewPhotoId("");
    setScreen("fotoColisao");
  };

  const openCollisionVideoPreview = (videoDataUrl: string, _previewUrl: string, posterUrl: string, durationLabel = "") => {
    setCollisionPhotoDraft(videoDataUrl);
    setCollisionPhotoPreviewUrl("");
    setCollisionPhotoPosterUrl(posterUrl);
    setCollisionPhotoDurationLabel(durationLabel);
    setCollisionPreviewPhotoId("");
    setScreen("previewFotoColisao");
  };

  const openCollisionPreview = (photoId: string) => {
    const photo = collisionPhotos.find((item) => item.id === photoId);
    if (!photo) return;
    setCollisionPhotoKind(photo.kind);
    setCollisionPhotoDraft(photo.dataUrl);
    setCollisionPhotoPreviewUrl(photo.previewUrl ?? "");
    setCollisionPhotoPosterUrl(photo.posterUrl ?? "");
    setCollisionPhotoDurationLabel(photo.durationLabel ?? "");
    setCollisionPreviewPhotoId(photoId);
    setScreen("previewFotoColisao");
  };

  const confirmCollisionPhoto = () => {
    if (!collisionPhotoDraft) return setScreen("colisoes");
    if (collisionPreviewPhotoId) {
      setCollisionPhotos((current) =>
        current.map((photo) => photo.id === collisionPreviewPhotoId ? {
          ...photo,
          dataUrl: collisionPhotoDraft,
          previewUrl: collisionPhotoPreviewUrl || undefined,
          posterUrl: collisionPhotoPosterUrl || undefined,
          durationLabel: collisionPhotoDurationLabel || undefined,
          mediaType: collisionPhotoDraft.startsWith("data:video/") ? "video" : "foto"
        } : photo)
      );
    } else {
      setCollisionPhotos((current) => {
        return [
          ...current,
          {
            id: `collision-photo-${Date.now()}-${current.length + 1}`,
            kind: collisionPhotoKind,
            dataUrl: collisionPhotoDraft,
            previewUrl: collisionPhotoPreviewUrl || undefined,
            posterUrl: collisionPhotoPosterUrl || undefined,
            durationLabel: collisionPhotoDurationLabel || undefined,
            mediaType: collisionPhotoDraft.startsWith("data:video/") ? "video" : "foto"
          }
        ];
      });
    }
    setCollisionPhotoDraft("");
    setCollisionPhotoPreviewUrl("");
    setCollisionPhotoPosterUrl("");
    setCollisionPhotoDurationLabel("");
    setCollisionPreviewPhotoId("");
    setScreen("colisoes");
  };

  const deleteCollisionPhoto = () => {
    if (collisionPreviewPhotoId) {
      setCollisionPhotos((current) => current.filter((photo) => photo.id !== collisionPreviewPhotoId));
    }
    setCollisionPhotoDraft("");
    setCollisionPhotoPreviewUrl("");
    setCollisionPhotoPosterUrl("");
    setCollisionPhotoDurationLabel("");
    setCollisionPreviewPhotoId("");
    setScreen("colisoes");
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
        title="Manutenção"
        onBack={() => setScreen("solicitarManutencao")}
        onCapture={(photoDataUrl) => {
          setMaintenanceRequestPhotoDraft(photoDataUrl);
          setMaintenanceRequestPhotoPreviewUrl("");
          setMaintenanceRequestPhotoPosterUrl("");
          setMaintenanceRequestPhotoDurationLabel("");
          setScreen("previewFotoSolicitacaoManutencao");
        }}
        onCaptureVideo={openMaintenanceRequestVideoPreview}
        onSwitchCamera={() => setToast("Câmera alternada localmente.")}
      />
    );
  }

  if (screen === "previewFotoSolicitacaoManutencao") {
    return show(
      <MaintenancePhotoPreviewScreen
        kind="FOTO1"
        title="Foto da manutenção"
        prompt={maintenanceRequestPhotoDraft.startsWith("data:video/") ? "O vídeo está correto?" : "A foto está legível?"}
        photoDataUrl={maintenanceRequestPhotoDraft}
        videoPreviewUrl={maintenanceRequestPhotoPreviewUrl}
        onBack={() => setScreen("solicitarManutencao")}
        onRetake={() => setScreen("fotoSolicitacaoManutencao")}
        onDelete={maintenanceRequestPreviewPhotoId ? deleteMaintenanceRequestPhoto : undefined}
        onConfirm={confirmMaintenanceRequestPhoto}
        confirmLabel={maintenanceRequestPreviewPhotoId ? "Voltar" : "Confirmar"}
        deleteOnly={Boolean(maintenanceRequestPreviewPhotoId)}
      />
    );
  }

  if (screen === "fotoColisao") {
    return show(
      <MaintenancePhotoScreen
        kind="NOTAFISCAL"
        title={`Capturar: ${getCollisionPhotoLabel(collisionPhotoKind)}`}
        onBack={() => setScreen("colisoes")}
        onCapture={(photoDataUrl) => {
          setCollisionPhotoDraft(photoDataUrl);
          setCollisionPhotoPreviewUrl("");
          setCollisionPhotoPosterUrl("");
          setCollisionPhotoDurationLabel("");
          setCollisionPreviewPhotoId("");
          setScreen("previewFotoColisao");
        }}
        onCaptureVideo={openCollisionVideoPreview}
        onSwitchCamera={() => setToast("Câmera alternada localmente.")}
      />
    );
  }

  if (screen === "previewFotoColisao") {
    return show(
      <MaintenancePhotoPreviewScreen
        kind="NOTAFISCAL"
        title={getCollisionPhotoLabel(collisionPhotoKind)}
        prompt={collisionPhotoDraft.startsWith("data:video/") ? "O vídeo está correto?" : "A foto está legível?"}
        photoDataUrl={collisionPhotoDraft}
        videoPreviewUrl={collisionPhotoPreviewUrl}
        onBack={() => {
          setCollisionPhotoDraft("");
          setCollisionPhotoPreviewUrl("");
          setCollisionPhotoPosterUrl("");
          setCollisionPhotoDurationLabel("");
          setCollisionPreviewPhotoId("");
          setScreen("colisoes");
        }}
        onRetake={() => {
          setCollisionPhotoDraft("");
          setCollisionPhotoPreviewUrl("");
          setCollisionPhotoPosterUrl("");
          setCollisionPhotoDurationLabel("");
          setCollisionPreviewPhotoId("");
          setScreen("fotoColisao");
        }}
        onDelete={collisionPreviewPhotoId ? deleteCollisionPhoto : undefined}
        onConfirm={confirmCollisionPhoto}
        confirmLabel={collisionPreviewPhotoId ? "Voltar" : "Confirmar"}
        deleteOnly={Boolean(collisionPreviewPhotoId)}
      />
    );
  }

  if (screen === "fotoGasto") {
    return show(
      <MaintenancePhotoScreen
        kind="NOTAFISCAL"
        title="Comprovante"
        onBack={() => setScreen("gastos")}
        onCapture={(photoDataUrl) => {
          setExpensePhotoDraft(photoDataUrl);
          setExpensePhotoPreviewUrl("");
          setExpensePhotoPosterUrl("");
          setExpensePhotoDurationLabel("");
          setExpensePreviewPhotoId("");
          setScreen("previewFotoGasto");
        }}
        onCaptureVideo={openExpenseVideoPreview}
        onSwitchCamera={() => setToast("Câmera alternada localmente.")}
      />
    );
  }

  if (screen === "previewFotoGasto") {
    return show(
      <MaintenancePhotoPreviewScreen
        kind="NOTAFISCAL"
        title="Comprovante"
        prompt={expensePhotoDraft.startsWith("data:video/") ? "O vídeo está correto?" : "O comprovante está legível?"}
        photoDataUrl={expensePhotoDraft}
        videoPreviewUrl={expensePhotoPreviewUrl}
        onBack={() => {
          setExpensePhotoDraft("");
          setExpensePhotoPreviewUrl("");
          setExpensePhotoPosterUrl("");
          setExpensePreviewPhotoId("");
          setScreen("gastos");
        }}
        onRetake={() => {
          setExpensePhotoDraft("");
          setExpensePhotoPreviewUrl("");
          setExpensePhotoPosterUrl("");
          setExpensePhotoDurationLabel("");
          setExpensePreviewPhotoId("");
          setScreen("fotoGasto");
        }}
        onDelete={expensePreviewPhotoId ? deleteExpensePhoto : undefined}
        onConfirm={confirmExpensePhoto}
        confirmLabel={expensePreviewPhotoId ? "Voltar" : "Confirmar"}
        deleteOnly={Boolean(expensePreviewPhotoId)}
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
        photos={expensePhotos}
        referenceData={expenseReferenceData}
        referenceLoading={expenseReferenceLoading}
        referenceError={!remoteMode ? "Visualização local. Para gravar, abra o app publicado no Model-driven." : expenseReferenceError}
        onDraftChange={setExpenseDraft}
        onAddPhoto={openExpenseCamera}
        onPreviewPhoto={openExpensePreview}
        onBack={() => setScreen("inicio")}
        onSubmit={submitExpense}
        submitState={remoteOperation?.phase ?? "idle"}
        vehicles={maintenanceVehicles}
        vehiclesLoading={maintenanceVehiclesLoading}
        currentVehicleId={maintenanceCurrentVehicleId}
      />
    );
  }

  if (screen === "colisoesInicio") {
    return show(
      <CollisionStartScreen
        onBack={() => setScreen("inicio")}
        onSelect={startCollision}
      />
    );
  }

  if (screen === "colisoes") {
    return show(
      <CollisionScreen
        draft={collisionDraft}
        photos={collisionPhotos}
        onDraftChange={setCollisionDraft}
        onAddPhoto={openCollisionCamera}
        onPreviewPhoto={openCollisionPreview}
        onBack={() => setScreen("colisoesInicio")}
        onSubmit={submitCollision}
        submitState={remoteOperation?.phase ?? "idle"}
        vehicles={maintenanceVehicles}
        vehiclesLoading={maintenanceVehiclesLoading}
        currentVehicleId={maintenanceCurrentVehicleId}
        driverName={driverContext?.fullName}
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
          setPhotoDraftPreviewUrl("");
          setMaintenanceExistingPreview(false);
          setScreen("previewFotoManutencao");
        }}
        onCaptureVideo={(videoDataUrl) => {
          setPhotoDraft(videoDataUrl);
          setPhotoDraftPreviewUrl("");
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
        videoPreviewUrl={photoDraftPreviewUrl}
        onBack={() => setScreen("finalizar")}
        onRetake={() => setScreen("fotoManutencao")}
        onConfirm={() => {
          setStore((current) => saveMaintenancePhoto(current, selectedDetail.id, maintenancePhotoKind, photoDraft ?? ""));
          setToast("Foto salva localmente.");
          setPhotoDraftPreviewUrl("");
          setMaintenanceExistingPreview(false);
          setScreen("finalizar");
        }}
        onDelete={maintenanceExistingPreview ? () => {
          setStore((current) => deleteFinalizationMaintenancePhoto(current, selectedDetail.id, maintenancePhotoKind));
          setToast("Foto apagada.");
          setPhotoDraft(null);
          setPhotoDraftPreviewUrl("");
          setMaintenanceExistingPreview(false);
          setScreen("finalizar");
        } : undefined}
        deleteOnly={maintenanceExistingPreview}
      />
    );
  }

  if (screen === "receber" && selectedDetail) {
    return show(
      <ReceiveScreen
        detail={selectedDetail}
        photos={receiveProofs[selectedDetail.id] ?? []}
        onAddPhoto={openReceiveCamera}
        onPreviewPhoto={openReceivePreview}
        onBack={() => setScreen("detalhes")}
        onContinue={continueAfterReceive}
        onGeneratePersonalReceipt={openPersonalReceipt}
        canGeneratePersonalReceipt={canGeneratePersonalReceipt}
        submitState={remoteOperation?.phase ?? "idle"}
      />
    );
  }

  if (screen === "reciboPersonalizado" && selectedDetail) {
    return show(<ReceiptScreen detail={selectedDetail} onBack={() => setScreen("receber")} />);
  }

  if (screen === "fotoReceber") {
    return show(
      <MaintenancePhotoScreen
        kind="NOTAFISCAL"
        title="Comprovante"
        onBack={() => setScreen("receber")}
        onCapture={(photoDataUrl) => {
          setReceivePhotoDraft(photoDataUrl);
          setReceivePhotoPreviewUrl("");
          setReceivePhotoPosterUrl("");
          setReceivePhotoDurationLabel("");
          setReceivePreviewPhotoId("");
          setScreen("previewFotoReceber");
        }}
        onCaptureVideo={openReceiveVideoPreview}
        onSwitchCamera={() => setToast("Câmera alternada localmente.")}
      />
    );
  }

  if (screen === "previewFotoReceber") {
    return show(
      <MaintenancePhotoPreviewScreen
        kind="NOTAFISCAL"
        title="Comprovante"
        prompt={receivePhotoDraft.startsWith("data:video/") ? "O vídeo está correto?" : "O comprovante está legível?"}
        photoDataUrl={receivePhotoDraft}
        videoPreviewUrl={receivePhotoPreviewUrl}
        onBack={() => {
          setReceivePhotoDraft("");
          setReceivePhotoPreviewUrl("");
          setReceivePhotoPosterUrl("");
          setReceivePhotoDurationLabel("");
          setReceivePreviewPhotoId("");
          setScreen("receber");
        }}
        onRetake={() => {
          setReceivePhotoDraft("");
          setReceivePhotoPreviewUrl("");
          setReceivePhotoPosterUrl("");
          setReceivePhotoDurationLabel("");
          setReceivePreviewPhotoId("");
          setScreen("fotoReceber");
        }}
        onDelete={receivePreviewPhotoId ? deleteReceivePhoto : undefined}
        onConfirm={confirmReceivePhoto}
        confirmLabel={receivePreviewPhotoId ? "Voltar" : "Confirmar"}
        deleteOnly={Boolean(receivePreviewPhotoId)}
      />
    );
  }

  if (screen === "finalizar" && selectedDetail) {
    if (
      shouldRequireReceiveStep(selectedDetail) &&
      (!hasReceiveProofs(selectedDetail, receiveProofs) || (remoteMode && !hasUploadedReceiveProofs(selectedDetail, receiveProofs, receiveUploadedCounts)))
    ) {
      return show(
        <ReceiveScreen
          detail={selectedDetail}
          photos={receiveProofs[selectedDetail.id] ?? []}
          onAddPhoto={openReceiveCamera}
          onPreviewPhoto={openReceivePreview}
          onBack={() => setScreen("detalhes")}
          onContinue={continueAfterReceive}
          onGeneratePersonalReceipt={openPersonalReceipt}
          canGeneratePersonalReceipt={canGeneratePersonalReceipt}
          submitState={remoteOperation?.phase ?? "idle"}
        />
      );
    }
    return show(
      <FinalizeScreen
        detail={selectedDetail}
        onBack={() => setScreen(getServiceTaskBackScreen(selectedDetail))}
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
            setPhotoDraftPreviewUrl(existingPhoto.startsWith("data:video/") ? existingPhoto : "");
            setMaintenanceExistingPreview(true);
            setScreen("previewFotoManutencao");
            return;
          }
          setPhotoDraft(null);
          setPhotoDraftPreviewUrl("");
          setMaintenanceExistingPreview(false);
          setScreen("fotoManutencao");
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
    if (
      shouldRequireReceiveStep(selectedDetail) &&
      (!hasReceiveProofs(selectedDetail, receiveProofs) || (remoteMode && !hasUploadedReceiveProofs(selectedDetail, receiveProofs, receiveUploadedCounts)))
    ) {
      return show(
        <ReceiveScreen
          detail={selectedDetail}
          photos={receiveProofs[selectedDetail.id] ?? []}
          onAddPhoto={openReceiveCamera}
          onPreviewPhoto={openReceivePreview}
          onBack={() => setScreen("detalhes")}
          onContinue={continueAfterReceive}
          onGeneratePersonalReceipt={openPersonalReceipt}
          canGeneratePersonalReceipt={canGeneratePersonalReceipt}
          submitState={remoteOperation?.phase ?? "idle"}
        />
      );
    }
    return show(
      <VoucherScreen
        detail={selectedDetail}
        hasSignature={Boolean(store.signatures[selectedDetail.id])}
        initialDraft={voucherDrafts[getVoucherDraftKey(selectedDetail)]}
        onBack={() => setScreen(getServiceTaskBackScreen(selectedDetail))}
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
        onOpenReceive={() => setScreen("receber")}
        onOpenVoucher={openVoucherFlow}
        onOpenFinalize={openFinalizeFlow}
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
