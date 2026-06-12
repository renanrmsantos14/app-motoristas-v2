import { useEffect, useMemo, useRef, useState } from "react";
import betinhosLogo from "../../Logo Betinhos B.png";
import carCrashIcon from "../assets/icons/car-crash-svgrepo-com.svg";
import historyIcon from "../assets/icons/clock.svg";
import { PullToRefresh } from "../components/common/PullToRefresh";
import type { AgendaItem } from "../types";

const modules = [
  {
    id: "services",
    label: "Serviços",
    detail: "Corridas de hoje",
    action: "Abrir agora",
    icon: "services",
    tone: "primary",
    disabled: false,
  },
  {
    id: "history",
    label: "Histórico",
    detail: "Serviços finalizados",
    action: "Ver histórico",
    icon: "history",
    tone: "neutral",
    disabled: false,
  },
  {
    id: "maintenancePhoto",
    label: "Manutenção",
    detail: "Solicitar reparo",
    action: "Abrir",
    icon: "maintenance",
    tone: "neutral",
    disabled: false,
  },
  {
    id: "expenses",
    label: "Gastos",
    detail: "Registrar despesas",
    action: "Abrir",
    icon: "expenses",
    tone: "neutral",
    disabled: false,
  },
  {
    id: "collisions",
    label: "Colis\u00f5es",
    detail: "Registro de colis\u00f5es",
    action: "Abrir",
    icon: "collisions",
    tone: "neutral",
    disabled: false,
  },
];

const screenAliases: Record<string, string[]> = {
  services: ["servicos", "services", "Services", "serviços"],
  history: ["historico", "history", "History", "histórico"],
  maintenancePhoto: ["maintenancePhoto", "maintenance", "MaintenancePhoto", "manutencao", "manutenção"],
  collisions: ["collisions", "colisoes", "Collisions"],
  expenses: ["gastos", "expenses", "Expenses"],
};

const moduleHandlers: Record<string, string[]> = {
  services: [
    "onServices",
    "onService",
    "onOpenServices",
    "onOpenService",
    "onServicesClick",
    "onServiceClick",
    "onServicesPress",
    "onServicePress",
    "openServices",
    "openService",
    "handleServices",
    "handleService",
  ],
  history: [
    "onHistory",
    "onHistorico",
    "onOpenHistory",
    "onOpenHistorico",
    "onHistoryClick",
    "onHistoricoClick",
    "onHistoryPress",
    "onHistoricoPress",
    "openHistory",
    "openHistorico",
    "handleHistory",
    "handleHistorico",
  ],
  maintenancePhoto: [
    "onOpenMaintenancePhoto",
    "onOpenMaintenance",
    "onMaintenancePhotoClick",
    "onMaintenanceClick",
    "onMaintenancePress",
    "openMaintenancePhoto",
    "openMaintenance",
  ],
  collisions: ["onOpenCollisions", "onCollisionsClick", "onCollisionsPress", "openCollisions"],
  expenses: ["onOpenExpenses", "onExpensesClick", "onExpensesPress", "openExpenses"],
};

const navigationHandlers = [
  "onNavigate",
  "navigate",
  "setScreen",
  "setCurrentScreen",
  "onScreenChange",
  "onChangeScreen",
  "onNavigateTo",
  "handleNavigate",
];

const localStorageKeysToReset = ["app-motoristas-local-v1", "app-motoristas-error-log-queue-v1"];

function clearKnownLocalData() {
  localStorageKeysToReset.forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Storage can be blocked by browser policy.
    }
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Storage can be blocked by browser policy.
    }
  });
}

type InitialScreenProps = {
  onNavigate?: (screen: string) => void;
  navigate?: (screen: string) => void;
  setScreen?: (screen: string) => void;
  setCurrentScreen?: (screen: string) => void;
  onScreenChange?: (screen: string) => void;
  onChangeScreen?: (screen: string) => void;
  onNavigateTo?: (screen: string) => void;
  handleNavigate?: (screen: string) => void;
  onOpenServices?: () => void;
  onServices?: () => void;
  onService?: () => void;
  onOpenService?: () => void;
  onServicesClick?: () => void;
  onServiceClick?: () => void;
  onServicesPress?: () => void;
  onServicePress?: () => void;
  openServices?: () => void;
  openService?: () => void;
  handleServices?: () => void;
  handleService?: () => void;
  onOpenHistory?: () => void;
  onHistory?: () => void;
  onHistorico?: () => void;
  onOpenHistorico?: () => void;
  onHistoryClick?: () => void;
  onHistoricoClick?: () => void;
  onHistoryPress?: () => void;
  onHistoricoPress?: () => void;
  openHistory?: () => void;
  openHistorico?: () => void;
  handleHistory?: () => void;
  handleHistorico?: () => void;
  onOpenMaintenancePhoto?: () => void;
  onOpenMaintenance?: () => void;
  onMaintenancePhotoClick?: () => void;
  onMaintenanceClick?: () => void;
  onMaintenancePress?: () => void;
  openMaintenancePhoto?: () => void;
  openMaintenance?: () => void;
  onOpenCollisions?: () => void;
  onCollisionsClick?: () => void;
  onCollisionsPress?: () => void;
  openCollisions?: () => void;
  onOpenExpenses?: () => void;
  onExpensesClick?: () => void;
  onExpensesPress?: () => void;
  openExpenses?: () => void;
  onResetLocal?: () => void;
  onRefresh?: () => void | Promise<void>;
  driverName?: string;
  motoristaNome?: string;
  nextServiceAt?: string | Date | null;
  proximoServicoEm?: string | Date | null;
  services?: AgendaItem[];
  [key: string]: unknown;
};

type BuildInfo = {
  version?: string;
  builtAtLabel?: string;
};

function getBuildInfo() {
  return ((window as Window & { __APP_BUILD_INFO?: BuildInfo }).__APP_BUILD_INFO ?? {}) as BuildInfo;
}

function getFirstName(name?: string) {
  return name?.trim().split(/\s+/)[0] || "Renan";
}

function getServiceDate(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getServiceDateFromAgendaItem(item: AgendaItem) {
  const fieldValue = item.detail?.fields.find((field) => {
    const label = field.label.toLowerCase();
    return label.includes("data") && (label.includes("horário") || label.includes("horario"));
  })?.value;

  if (!fieldValue) return null;

  const match = fieldValue.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (!match) return null;

  const [, day, month, year, hour, minute] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
}

function getRelativeDateFromTimeLabel(item: AgendaItem, now: number) {
  if (!item.time) return null;

  const timeMatch = item.time.match(/(\d{2}):(\d{2})/);
  if (!timeMatch) return null;

  const [, hour, minute] = timeMatch;
  const label = item.time.toUpperCase();
  const date = new Date(now);

  if (label.includes("AMANH")) {
    date.setDate(date.getDate() + 1);
  }

  date.setHours(Number(hour), Number(minute), 0, 0);
  return date;
}

function resolveAgendaDate(item: AgendaItem, now: number) {
  const actualDate = getServiceDateFromAgendaItem(item);
  if (actualDate && actualDate.getTime() >= now) return actualDate;

  const relativeDate = getRelativeDateFromTimeLabel(item, now);
  if (relativeDate && relativeDate.getTime() >= now) return relativeDate;

  return null;
}

function formatTimeUntil(date: Date, now: number) {
  const diffMs = date.getTime() - now;
  if (diffMs <= 0) return "menos de 1min";

  const totalMinutes = Math.ceil(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) return `${minutes}min`;
  return `${hours}h${String(minutes).padStart(2, "0")}min`;
}

function getNextServiceItem(props: InitialScreenProps, now: number) {
  const directDate = getServiceDate(props.nextServiceAt ?? props.proximoServicoEm);
  if (directDate) return { date: directDate, item: null };

  const serviceDates = props.services
    ?.filter((service) => service.tipo !== "HEADER" && !service.canceled && service.detail)
    .map((item) => {
      const date = resolveAgendaDate(item, now);
      return { item, date };
    })
    .filter((service): service is { item: AgendaItem; date: Date } => Boolean(service.date))
    .sort((a, b) => a.date.getTime() - b.date.getTime()) ?? [];

  return serviceDates[0] ?? null;
}

function isToday(date: Date, now: number) {
  const today = new Date(now);
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function isTodayAgendaItem(item: AgendaItem, now: number) {
  const timeLabel = item.time?.toUpperCase() ?? "";
  if (timeLabel.includes("HOJE")) return true;
  if (timeLabel.includes("AMANH")) return false;

  const date = getServiceDateFromAgendaItem(item);
  return Boolean(date && isToday(date, now));
}

function getTodayAgendaCount(services: AgendaItem[] | undefined, now: number) {
  return services?.filter((service) => {
    return service.tipo !== "HEADER" && !service.canceled && service.detail && isTodayAgendaItem(service, now);
  }).length ?? 0;
}

function ModuleIcon({ name }: { name: string }) {
  if (name === "services") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.5 7.5h11l1.5 4v6a1.5 1.5 0 0 1-1.5 1.5h-1a1.5 1.5 0 0 1-1.5-1.5v-.5h-6v.5A1.5 1.5 0 0 1 7 19h-1a1.5 1.5 0 0 1-1.5-1.5v-6l2-4Z" />
        <path d="M7.5 7.5 8.4 5h7.2l.9 2.5" />
        <path d="M7 13h2.2M14.8 13H17" />
      </svg>
    );
  }

  if (name === "history") {
    return <img src={historyIcon} alt="" />;
  }

  if (name === "collisions") {
    return <img src={carCrashIcon} alt="" />;
  }

  if (name === "maintenance") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14.7 6.3a4 4 0 0 0-5.1 5.1L4.8 16.2a2 2 0 1 0 2.8 2.8l4.8-4.8a4 4 0 0 0 5.1-5.1l-2.4 2.4-2.8-2.8 2.4-2.4Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 7h12v12H6z" />
      <path d="M8 5h8v2H8z" />
      <path d="M9 11h6M9 15h3" />
    </svg>
  );
}

export function InitialScreen(props: InitialScreenProps) {
  const shellRef = useRef<HTMLElement | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const driverName = getFirstName(props.driverName ?? props.motoristaNome);
  const nextService = useMemo(() => getNextServiceItem(props, now), [now, props.nextServiceAt, props.proximoServicoEm, props.services]);
  const nextServiceDate = nextService?.date ?? null;
  const agendaCount = useMemo(() => getTodayAgendaCount(props.services, now), [now, props.services]);
  const buildInfo = useMemo(() => getBuildInfo(), []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const navigateTo = (screen: string) => {
    const module = modules.find((item) => item.id === screen);
    if (module?.disabled) return;

    for (const handlerName of moduleHandlers[screen] ?? []) {
      const handler = props[handlerName];
      if (typeof handler === "function") {
        handler();
        return;
      }
    }

    const navigator = navigationHandlers
      .map((handlerName) => props[handlerName])
      .find((handler): handler is (screen: string) => void => typeof handler === "function");

    const aliases = screenAliases[screen] ?? [screen];
    const targetScreen = screen === "maintenancePhoto" ? "solicitarManutencao" : screen === "collisions" ? "colisoesInicio" : aliases[0];
    if (navigator) {
      navigator(targetScreen);
      return;
    }

    window.dispatchEvent(
      new CustomEvent("betinhos:navigate", {
        detail: { screen: aliases[0], aliases },
      }),
    );
  };
  const resetLocalData = () => {
    setResetConfirmOpen(true);
  };

  const confirmResetLocalData = () => {
    setResetConfirmOpen(false);
    if (props.onResetLocal) {
      props.onResetLocal();
      return;
    }

    clearKnownLocalData();
    window.location.reload();
  };

  return (
    <PullToRefresh className="pull-refresh--home" scrollRef={shellRef} onRefresh={props.onRefresh ?? (() => window.location.reload())}>
    <main ref={shellRef} className="concept-shell">
      <header className="concept-topbar">
        <div>
          <span className="concept-kicker">Olá,</span>
          <h1>{driverName}</h1>
        </div>
        <img className="concept-avatar" src={betinhosLogo} alt="Betinhos" />
      </header>

      {nextServiceDate && (
        <button className="concept-next-service" type="button" onClick={() => navigateTo("services")}>
          <span className="concept-next-eyebrow">Próximo serviço em</span>
          <strong>{formatTimeUntil(nextServiceDate, now)}</strong>
          <small>{nextService?.item?.description ?? "Abrir agenda"}</small>
        </button>
      )}

      <section className="concept-module-grid" aria-label="Módulos do aplicativo">
        {modules.map((module) => (
          <button
            className={`concept-module-card concept-module-card--${module.tone}`}
            key={module.id}
            type="button"
            disabled={module.disabled}
            aria-disabled={module.disabled}
            onClick={() => navigateTo(module.id)}
          >
            <span className="concept-module-meta" aria-hidden="true">
              <ModuleIcon name={module.icon} />
            </span>
            <span className="concept-module-text">
              <strong>{module.label}</strong>
              <small>
                {module.detail}
                {module.id === "services" && agendaCount > 0 ? <span className="concept-inline-count"> • {agendaCount}</span> : null}
              </small>
            </span>
            <span className="concept-module-action">{module.action}</span>
          </button>
        ))}
      </section>

      <footer className="concept-footer">
        <span>
          Versão {buildInfo.version ?? "local"} {buildInfo.builtAtLabel ? `- Build ${buildInfo.builtAtLabel}` : ""}
        </span>
        <button type="button" onClick={resetLocalData}>
          Resetar dados locais
        </button>
      </footer>
      {resetConfirmOpen ? (
        <div className="maintenance-delete-overlay" role="dialog" aria-modal="true" aria-labelledby="reset-local-title">
          <div className="maintenance-delete-dialog">
            <div id="reset-local-title" className="maintenance-delete-title">Resetar dados locais?</div>
            <p>Rascunhos, fotos locais e sessão offline deste app serão removidos deste navegador.</p>
            <div className="maintenance-delete-actions">
              <button className="maintenance-delete-cancel" onClick={() => setResetConfirmOpen(false)} type="button">Cancelar</button>
              <button className="maintenance-delete-confirm" onClick={confirmResetLocalData} type="button">Resetar</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
    </PullToRefresh>
  );
}

export default InitialScreen;
