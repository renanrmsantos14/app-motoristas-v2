import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { agendaMock, historyMock } from "./data/mockData";
import {
  cancelServiceRemote,
  finalizeExchangeRemote,
  finalizeMaintenanceRemote,
  finalizeServiceRemote,
  hasDataverseRuntime,
  loadRemoteDetailByParams,
  loadRemoteStore,
  markDetailViewedRemote,
  saveVoucherDraftRemote,
  saveVoucherRemote
} from "./lib/dataverse";
import {
  cancelDetailLocally,
  clearMaintenancePhotos,
  detailsToClipboardText,
  finalizeDetailLocally,
  findDetailByParams,
  saveMaintenancePhoto,
  saveSignatureLocally,
  type LocalStore
} from "./lib/localWorkflow";
import { DetailsScreen } from "./screens/DetailsScreen";
import { FinalizeScreen } from "./screens/FinalizeScreen";
import { HistoryDetailsScreen } from "./screens/HistoryDetailsScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { InitialScreen } from "./screens/InitialScreen";
import { LocalCancelScreen } from "./screens/LocalCancelScreen";
import { MaintenancePhotoScreen } from "./screens/MaintenancePhotoScreen";
import { MaintenancePhotoPreviewScreen } from "./screens/MaintenancePhotoPreviewScreen";
import { ServicesScreen } from "./screens/ServicesScreen";
import { SignatureScreen } from "./screens/SignatureScreen";
import { VoucherScreen } from "./screens/VoucherScreen";
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

const isListScreen = (screenName: Screen) => screenName === "servicos" || screenName === "historico";
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

function App() {
  const [store, setStore] = useState<LocalStore>(() => loadStore());
  const initialDetailRef = useRef<DetailData | null>(getInitialDetail(store));
  const [screen, setScreen] = useState<Screen>(() => (initialDetailRef.current ? "detalhes" : "inicio"));
  const previousScreenRef = useRef<Screen>(initialDetailRef.current ? "detalhes" : "inicio");
  const [selectedDetail, setSelectedDetail] = useState<DetailData | null>(() => initialDetailRef.current);
  const [maintenancePhotoKind, setMaintenancePhotoKind] = useState<MaintenancePhotoKind>("NOTAFISCAL");
  const [photoDraft, setPhotoDraft] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [completingDetailKey, setCompletingDetailKey] = useState("");
  const [remoteMode, setRemoteMode] = useState(false);
  const finalizeTimerRef = useRef<number | null>(null);
  const voucherDraftTimerRef = useRef<number | null>(null);

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
        setStore((current) => ({
          ...current,
          agenda: remote.agenda,
          history: remote.history
        }));
        if (remoteInitialDetail) {
          markDetailViewedRemote(remoteInitialDetail).catch((error) => {
            setToast(error instanceof Error ? error.message : "Falha ao marcar visualizacao.");
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
                setToast("Servico remoto nao encontrado.");
                return;
              }
              markDetailViewedRemote(detail).catch((error) => {
                setToast(error instanceof Error ? error.message : "Falha ao marcar visualizacao.");
              });
              setSelectedDetail(detail);
              setScreen("detalhes");
              setToast("");
            })
            .catch((error) => {
              if (!alive) return;
              setToast(error instanceof Error ? error.message : "Servico remoto nao encontrado.");
            });
          return;
        }
        setToast("");
      })
      .catch((error) => {
        if (!alive) return;
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
    </>
  );

  const refreshLocal = () => {
    if (remoteMode) {
      setToast("Atualizando Dataverse.");
      loadRemoteStore()
        .then((remote) => {
          setStore((current) => ({ ...current, agenda: remote.agenda, history: remote.history }));
          setToast("Atualizado do Dataverse.");
        })
        .catch((error) => {
          setToast(error instanceof Error ? error.message : "Falha ao atualizar Dataverse.");
        });
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
    if (!selectedDetail) return;
    const detailToFinalize = selectedDetail;
    const detailKey = `${detailToFinalize.type}:${detailToFinalize.id}`;
    const firstPendingDetail = findFirstPendingDetail(store.agenda);

    if (firstPendingDetail && !isSameDetail(firstPendingDetail, detailToFinalize)) {
      setToast("Conclua os itens anteriores da fila antes de prosseguir.");
      setScreen("servicos");
      return;
    }

    if (finalizeTimerRef.current) window.clearTimeout(finalizeTimerRef.current);

    if (remoteMode) {
      try {
        const remoteBeforeFinalize = await loadRemoteStore();
        const remoteFirstPendingDetail = findFirstPendingDetail(remoteBeforeFinalize.agenda);
        setStore((current) => ({ ...current, agenda: remoteBeforeFinalize.agenda, history: remoteBeforeFinalize.history }));

        if (remoteFirstPendingDetail && !isSameDetail(remoteFirstPendingDetail, detailToFinalize)) {
          setToast("Conclua os itens anteriores da fila antes de prosseguir.");
          setSelectedDetail(null);
          setScreen("servicos");
          return;
        }

        const signatureDataUrl = store.signatures[detailToFinalize.id];
        const photos = store.photos[detailToFinalize.id];
        const isVoucher = "Km Inicial" in fields || "Horario Inicial" in fields || "Horário Inicial" in fields;

        if (detailToFinalize.type === "SERVICO" && isVoucher) {
          await saveVoucherRemote({ detail: detailToFinalize, fields, signatureDataUrl, photos });
        } else if (detailToFinalize.type === "SERVICO") {
          await finalizeServiceRemote({ detail: detailToFinalize, fields, signatureDataUrl, photos });
        } else if (detailToFinalize.type === "MANUTENCAO") {
          await finalizeMaintenanceRemote({ detail: detailToFinalize, fields, signatureDataUrl, photos });
        } else if (detailToFinalize.type === "TROCA") {
          await finalizeExchangeRemote({ detail: detailToFinalize, fields, signatureDataUrl, photos });
        }
      } catch (error) {
        setToast(error instanceof Error ? error.message : "Falha ao finalizar no Dataverse.");
        return;
      }
    }

    setCompletingDetailKey(detailKey);
    setSelectedDetail(null);
    setScreen("servicos");

    finalizeTimerRef.current = window.setTimeout(() => {
      if (remoteMode) {
        loadRemoteStore()
          .then((remote) => setStore((current) => ({ ...current, agenda: remote.agenda, history: remote.history })))
          .catch(() => setStore((current) => finalizeDetailLocally(current, detailToFinalize, fields)));
      } else {
        setStore((current) => finalizeDetailLocally(current, detailToFinalize, fields));
      }
      setCompletingDetailKey("");
      finalizeTimerRef.current = null;
    }, 1650);
  };

  const cancelSelected = async (reason: string) => {
    if (!selectedDetail) return;
    if (remoteMode) {
      try {
        await cancelServiceRemote(selectedDetail, reason);
        setSelectedDetail(null);
        setScreen("servicos");
        setToast("Cancelamento enviado para analise.");
        loadRemoteStore()
          .then((remote) => setStore((current) => ({ ...current, agenda: remote.agenda, history: remote.history })))
          .catch((error) => {
            setToast(error instanceof Error ? error.message : "Cancelado, mas falhou ao atualizar a agenda.");
          });
        return;
      } catch (error) {
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
    if (!remoteMode || !selectedDetail || selectedDetail.type !== "SERVICO") return;
    const detail = selectedDetail;
    if (voucherDraftTimerRef.current) window.clearTimeout(voucherDraftTimerRef.current);
    voucherDraftTimerRef.current = window.setTimeout(() => {
      saveVoucherDraftRemote(detail, fields).catch((error) => {
        setToast(error instanceof Error ? error.message : "Falha ao salvar rascunho do voucher.");
      });
    }, 450);
  };

  if (screen === "canceladoLocal" && selectedDetail) {
    return show(
      <LocalCancelScreen
        detail={selectedDetail}
        onBack={() => setScreen("detalhes")}
        onWrongClick={() => setScreen("detalhes")}
        onSubmit={cancelSelected}
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
        onConfirm={() => {
          setStore((current) => saveMaintenancePhoto(current, selectedDetail.id, maintenancePhotoKind, photoDraft ?? ""));
          setToast("Foto salva localmente.");
          setScreen("finalizar");
        }}
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
        onClearPhotos={() => {
          setStore((current) => clearMaintenancePhotos(current, selectedDetail.id));
          setToast("Fotos locais limpas.");
        }}
        onPreviewMaintenancePhoto={(kind) => {
          setMaintenancePhotoKind(kind);
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
    return show(
      <VoucherScreen
        detail={selectedDetail}
        hasSignature={Boolean(store.signatures[selectedDetail.id])}
        onBack={() => setScreen("servicos")}
        onOpenSignature={() => setScreen("assinatura")}
        onFinalize={finalizeSelected}
        onDraftChange={saveVoucherDraft}
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
        onCopy={() => {
          void navigator.clipboard?.writeText(detailsToClipboardText(selectedDetail));
          setToast("Informações copiadas.");
        }}
      />
    );
  }

  if (screen === "detalhesHistorico" && selectedDetail) {
    return show(<HistoryDetailsScreen detail={selectedDetail} onBack={() => setScreen("historico")} />);
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
              setToast(error instanceof Error ? error.message : "Falha ao marcar visualizacao.");
            });
          }
          setSelectedDetail(detail);
          setScreen("detalhes");
        }}
      />
    );
  }

  return show(<InitialScreen onNavigate={setScreen} onResetLocal={resetLocal} services={store.agenda} />);
}

export default App;
