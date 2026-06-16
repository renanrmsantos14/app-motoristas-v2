import type { Screen } from "../types";

export const AUTO_REFRESH_INTERVAL_MS = 60_000;

export type HashRoute = {
  screen: Screen;
  detailId?: string;
  detailType?: string;
};

const SCREEN_HASH_PATHS: Record<Screen, string> = {
  inicio: "inicio",
  servicos: "servicos",
  historico: "historico",
  detalhes: "detalhes",
  detalhesHistorico: "detalhes-historico",
  receber: "receber",
  reciboPersonalizado: "recibo-personalizado",
  voucher: "voucher",
  assinatura: "assinatura",
  finalizar: "finalizar",
  gastos: "gastos",
  fotoReceber: "foto-receber",
  previewFotoReceber: "preview-foto-receber",
  fotoGasto: "foto-gasto",
  previewFotoGasto: "preview-foto-gasto",
  colisoesInicio: "colisoes",
  colisoes: "registro-colisao",
  fotoColisao: "foto-colisao",
  previewFotoColisao: "preview-foto-colisao",
  solicitarManutencao: "manutencao",
  fotoSolicitacaoManutencao: "foto-solicitacao-manutencao",
  previewFotoSolicitacaoManutencao: "preview-foto-solicitacao-manutencao",
  canceladoLocal: "cancelado-local",
  fotoManutencao: "foto-manutencao",
  previewFotoManutencao: "preview-foto-manutencao"
};

const SCREEN_HASH_ALIASES: Record<string, Screen> = {
  inicio: "inicio",
  home: "inicio",
  servicos: "servicos",
  services: "servicos",
  historico: "historico",
  history: "historico",
  detalhes: "detalhes",
  detalhe: "detalhes",
  details: "detalhes",
  "detalhes-historico": "detalhesHistorico",
  "historico-detalhes": "detalhesHistorico",
  "history-details": "detalhesHistorico",
  receber: "receber",
  receive: "receber",
  "recibo-personalizado": "reciboPersonalizado",
  recibopersonalizado: "reciboPersonalizado",
  personalreceipt: "reciboPersonalizado",
  voucher: "voucher",
  assinatura: "assinatura",
  signature: "assinatura",
  finalizar: "finalizar",
  finish: "finalizar",
  gastos: "gastos",
  expenses: "gastos",
  "foto-receber": "fotoReceber",
  fotoreceber: "fotoReceber",
  "preview-foto-receber": "previewFotoReceber",
  previewfotoreceber: "previewFotoReceber",
  "foto-gasto": "fotoGasto",
  fotogasto: "fotoGasto",
  "preview-foto-gasto": "previewFotoGasto",
  previewfotogasto: "previewFotoGasto",
  colisoes: "colisoesInicio",
  collisions: "colisoesInicio",
  "registro-colisao": "colisoes",
  registrocolisao: "colisoes",
  "foto-colisao": "fotoColisao",
  fotocolisao: "fotoColisao",
  "preview-foto-colisao": "previewFotoColisao",
  previewfotocolisao: "previewFotoColisao",
  manutencao: "solicitarManutencao",
  "solicitar-manutencao": "solicitarManutencao",
  maintenance: "solicitarManutencao",
  "foto-solicitacao-manutencao": "fotoSolicitacaoManutencao",
  fotosolicitacaomanutencao: "fotoSolicitacaoManutencao",
  "preview-foto-solicitacao-manutencao": "previewFotoSolicitacaoManutencao",
  previewfotosolicitacaomanutencao: "previewFotoSolicitacaoManutencao",
  "cancelado-local": "canceladoLocal",
  canceladolocal: "canceladoLocal",
  "foto-manutencao": "fotoManutencao",
  fotomanutencao: "fotoManutencao",
  "preview-foto-manutencao": "previewFotoManutencao",
  previewfotomanutencao: "previewFotoManutencao"
};

const HASH_ROUTE_DETAIL_SCREENS = new Set<Screen>([
  "detalhes",
  "detalhesHistorico",
  "receber",
  "voucher",
  "assinatura",
  "finalizar",
  "canceladoLocal",
  "fotoReceber",
  "fotoManutencao"
]);

const HASH_ROUTE_RESTORE_SCREEN: Partial<Record<Screen, Screen>> = {
  previewFotoReceber: "receber",
  previewFotoGasto: "gastos",
  previewFotoColisao: "colisoes",
  previewFotoSolicitacaoManutencao: "solicitarManutencao",
  previewFotoManutencao: "finalizar"
};

const HASH_ROUTE_FALLBACK_SCREEN: Partial<Record<Screen, Screen>> = {
  detalhes: "servicos",
  detalhesHistorico: "historico",
  receber: "detalhes",
  voucher: "detalhes",
  assinatura: "voucher",
  finalizar: "detalhes",
  canceladoLocal: "detalhes",
  fotoReceber: "receber",
  fotoManutencao: "finalizar"
};

function normalizeHashDetailType(value: string | null) {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "SERVICO" || normalized === "TROCA" || normalized === "MANUTENCAO") return normalized;
  return undefined;
}

export function isHashRoutingEnabled() {
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

export function screenNeedsHashDetail(screen: Screen) {
  return HASH_ROUTE_DETAIL_SCREENS.has(screen);
}

export function getHashRouteRestoreScreen(screen: Screen) {
  return HASH_ROUTE_RESTORE_SCREEN[screen] ?? screen;
}

export function getHashRouteFallbackScreen(screen: Screen) {
  return HASH_ROUTE_FALLBACK_SCREEN[screen] ?? "inicio";
}

export function parseHashRoute(hash: string): HashRoute | null {
  const raw = hash.replace(/^#\/?/, "").trim();
  if (!raw) return null;

  const [pathPart, queryString = ""] = raw.split("?");
  const normalizedPath = decodeURIComponent(pathPart).trim().toLowerCase();
  const screen = SCREEN_HASH_ALIASES[normalizedPath];
  if (!screen) return null;

  const params = new URLSearchParams(queryString);
  const detailId = params.get("serviceId")?.trim() || params.get("detailId")?.trim() || undefined;
  const detailType = normalizeHashDetailType(params.get("type"));

  return { screen, detailId, detailType };
}

export function buildHashRoute(screen: Screen, detail?: { id: string; type: string } | null) {
  const params = new URLSearchParams();
  if (detail && (screenNeedsHashDetail(screen) || screen === "reciboPersonalizado")) {
    params.set("serviceId", detail.id);
    params.set("type", detail.type);
  }

  const query = params.toString();
  return `#${SCREEN_HASH_PATHS[screen]}${query ? `?${query}` : ""}`;
}

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
