import type { Screen } from "../types";

export const AUTO_REFRESH_INTERVAL_MS = 60_000;

const SCREEN_DEPTH: Record<Screen, number> = {
  inicio: 0,
  servicos: 1,
  historico: 1,
  detalhes: 2,
  detalhesHistorico: 2,
  receber: 3,
  reciboPersonalizado: 4,
  voucher: 3,
  finalizar: 3,
  gastos: 1,
  fotoReceber: 4,
  previewFotoReceber: 5,
  fotoGasto: 2,
  previewFotoGasto: 3,
  colisoesInicio: 1,
  colisoes: 2,
  fotoColisao: 3,
  previewFotoColisao: 4,
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

const isListScreen = (screenName: Screen) => screenName === "servicos" || screenName === "historico" || screenName === "gastos" || screenName === "colisoesInicio";
const isDetailScreen = (screenName: Screen) => screenName === "detalhes" || screenName === "detalhesHistorico";
const isTaskScreen = (screenName: Screen) =>
  screenName === "receber" || screenName === "voucher" || screenName === "finalizar" || screenName === "canceladoLocal";
const isCaptureScreen = (screenName: Screen) =>
  screenName === "fotoReceber" ||
  screenName === "previewFotoReceber" ||
  screenName === "fotoManutencao" ||
  screenName === "previewFotoManutencao" ||
  screenName === "fotoGasto" ||
  screenName === "previewFotoGasto" ||
  screenName === "fotoColisao" ||
  screenName === "previewFotoColisao" ||
  screenName === "fotoSolicitacaoManutencao" ||
  screenName === "previewFotoSolicitacaoManutencao";

export const shouldAutoRefreshScreen = (screenName: Screen) =>
  screenName === "inicio" ||
  screenName === "servicos" ||
  screenName === "historico" ||
  screenName === "detalhes" ||
  screenName === "detalhesHistorico";

export function getScreenMotion(current: Screen, previous: Screen) {
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
