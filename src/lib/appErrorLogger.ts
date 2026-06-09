type XrmLike = {
  Utility?: {
    getGlobalContext?: () => {
      userSettings?: { userId?: string; userName?: string };
      getClientUrl?: () => string;
    };
  };
  WebApi?: {
    createRecord: (entityName: string, data: Record<string, unknown>) => Promise<{ id: string }>;
    retrieveRecord?: (entityName: string, id: string, options?: string) => Promise<Record<string, unknown>>;
  };
};

type BuildInfo = {
  version?: string;
  builtAt?: string;
  builtAtLabel?: string;
};

type WindowWithRuntime = Window & {
  Xrm?: XrmLike;
  __APP_BUILD_INFO?: BuildInfo;
  __APP_ERROR_LOGGER_INSTALLED?: boolean;
  __APP_REPORT_ERROR?: (error: unknown, context?: AppErrorLogContext) => void;
};

export type AppErrorLogContext = {
  severity?: "info" | "warning" | "error" | "critical";
  source?: string;
  action?: string;
  phase?: string;
  component?: string;
  screen?: string;
  detailId?: string;
  detailType?: string;
  payload?: unknown;
};

const LOGICAL_NAME = "new_appmotoristaslog";
const QUEUE_KEY = "app-motoristas-error-log-queue-v1";
const MAX_TEXT = 20000;
const MAX_STACK = 100000;
const MAX_QUEUE_ITEMS = 50;
const SESSION_ID = createSessionId();
let flushing = false;
let originalConsoleError: typeof console.error | null = null;
let userContextPromise: Promise<RuntimeUserContext> | null = null;

type RuntimeUserContext = {
  userId: string;
  userName: string;
  userEmail: string;
  userDomainName: string;
};

function createSessionId() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getWindowRuntime(): WindowWithRuntime | null {
  if (typeof window === "undefined") return null;
  return window as WindowWithRuntime;
}

function getXrm(): XrmLike | null {
  const current = getWindowRuntime();
  if (!current) return null;
  try {
    const parentWindow = window.parent as WindowWithRuntime;
    if (current.Xrm?.WebApi) return current.Xrm;
    if (parentWindow?.Xrm?.WebApi) return parentWindow.Xrm;
  } catch {
    return current.Xrm?.WebApi ? current.Xrm : null;
  }
  return null;
}

function safeStringify(value: unknown, maxLength = MAX_TEXT) {
  try {
    const seen = new WeakSet<object>();
    const json = JSON.stringify(value, (_key, item) => {
      if (typeof item === "object" && item !== null) {
        if (seen.has(item)) return "[Circular]";
        seen.add(item);
      }
      if (typeof item === "function") return `[Function ${item.name || "anonymous"}]`;
      return item;
    });
    return String(json ?? "").slice(0, maxLength);
  } catch (error) {
    return `[unserializable:${error instanceof Error ? error.message : String(error)}]`;
  }
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    const record = error as Error & { code?: unknown; errorCode?: unknown };
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? "",
      code: String(record.errorCode ?? record.code ?? ""),
      rawJson: safeStringify(error, MAX_TEXT)
    };
  }

  const record = (error ?? {}) as Record<string, unknown>;
  return {
    name: String(record.name ?? typeof error),
    message: String(record.message ?? error ?? "Erro desconhecido"),
    stack: String(record.stack ?? ""),
    code: String(record.errorCode ?? record.code ?? ""),
    rawJson: safeStringify(error, MAX_TEXT)
  };
}

function getBuildInfo() {
  return getWindowRuntime()?.__APP_BUILD_INFO ?? {};
}

function cleanGuid(value = "") {
  return value.replace(/[{}]/g, "").toLowerCase();
}

async function getRuntimeUserContext(): Promise<RuntimeUserContext> {
  if (userContextPromise) return userContextPromise;

  userContextPromise = (async () => {
    const xrm = getXrm();
    const settings = xrm?.Utility?.getGlobalContext?.().userSettings;
    const userId = cleanGuid(settings?.userId ?? "");
    const fallbackName = String(settings?.userName ?? "");
    const fallback = {
      userId,
      userName: fallbackName,
      userEmail: "",
      userDomainName: ""
    };

    if (!xrm?.WebApi?.retrieveRecord || !userId) return fallback;

    try {
      const user = await xrm.WebApi.retrieveRecord(
        "systemuser",
        userId,
        "?$select=internalemailaddress,fullname,domainname"
      );
      return {
        userId,
        userName: String(user.fullname ?? fallbackName),
        userEmail: String(user.internalemailaddress ?? ""),
        userDomainName: String(user.domainname ?? "")
      };
    } catch {
      return fallback;
    }
  })();

  return userContextPromise;
}

function truncate(value: unknown, maxLength = MAX_TEXT) {
  return String(value ?? "").slice(0, maxLength);
}

function getConnectionType(runtime: WindowWithRuntime | null) {
  const navigatorWithConnection = runtime?.navigator as Navigator & {
    connection?: { effectiveType?: string; type?: string };
  };
  return navigatorWithConnection?.connection?.effectiveType ?? navigatorWithConnection?.connection?.type ?? "";
}

async function getBaseRecord(context: AppErrorLogContext, error: ReturnType<typeof normalizeError>) {
  const runtime = getWindowRuntime();
  const xrm = getXrm();
  const build = getBuildInfo();
  const user = await getRuntimeUserContext();
  const clientUrl = xrm?.Utility?.getGlobalContext?.().getClientUrl?.() ?? "";
  const title = `${context.severity ?? "error"} | ${context.source ?? "app"} | ${error.message || context.action || "erro"}`;

  return {
    new_name: truncate(title, 160),
    new_occurredat: new Date().toISOString(),
    new_severity: truncate(context.severity ?? "error", 30),
    new_source: truncate(context.source ?? "app", 120),
    new_action: truncate(context.action ?? "", 180),
    new_phase: truncate(context.phase ?? "", 120),
    new_component: truncate(context.component ?? "", 180),
    new_screen: truncate(context.screen ?? "", 120),
    new_detailid: truncate(context.detailId ?? "", 120),
    new_detailtype: truncate(context.detailType ?? "", 80),
    new_message: truncate(error.message, MAX_TEXT),
    new_stack: truncate(error.stack, MAX_STACK),
    new_errorname: truncate(error.name, 220),
    new_errorcode: truncate(error.code, 120),
    new_appversion: truncate(build.version ?? "", 60),
    new_builtat: truncate(build.builtAtLabel ?? build.builtAt ?? "", 80),
    new_sessionid: truncate(SESSION_ID, 120),
    new_userid: truncate(user.userId, 120),
    new_username: truncate(user.userName, 300),
    new_useremail: truncate(user.userEmail, 300),
    new_userdomainname: truncate(user.userDomainName, 300),
    new_appname: "App Motoristas",
    new_url: truncate(runtime?.location?.href ?? "", 4000),
    new_referrer: truncate(runtime?.document?.referrer ?? "", 4000),
    new_useragent: truncate(runtime?.navigator?.userAgent ?? "", 4000),
    new_language: truncate(runtime?.navigator?.language ?? "", 80),
    new_platform: truncate(runtime?.navigator?.platform ?? "", 160),
    new_timezone: truncate(Intl.DateTimeFormat().resolvedOptions().timeZone ?? "", 120),
    new_viewport: runtime ? `${runtime.innerWidth}x${runtime.innerHeight}@${runtime.devicePixelRatio || 1}` : "",
    new_visibilitystate: truncate(runtime?.document?.visibilityState ?? "", 40),
    new_connectiontype: truncate(getConnectionType(runtime), 80),
    new_clienturl: truncate(clientUrl, 500),
    new_isoffline: runtime?.navigator?.onLine === false ? "true" : "false",
    new_payloadjson: safeStringify(context.payload ?? {}, MAX_TEXT),
    new_rawjson: truncate(error.rawJson, MAX_TEXT)
  };
}

function readQueue(): Record<string, unknown>[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) as Record<string, unknown>[] : [];
  } catch {
    return [];
  }
}

function writeQueue(items: Record<string, unknown>[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-MAX_QUEUE_ITEMS)));
  } catch {
    // Sem armazenamento local. Ignora para nao derrubar o app.
  }
}

function enqueue(record: Record<string, unknown>) {
  writeQueue([...readQueue(), record]);
}

export async function flushAppErrorLogQueue() {
  if (flushing) return;
  const xrm = getXrm();
  if (!xrm?.WebApi) return;
  const items = readQueue();
  if (!items.length) return;

  flushing = true;
  const failed: Record<string, unknown>[] = [];
  for (const item of items) {
    try {
      await xrm.WebApi.createRecord(LOGICAL_NAME, item);
    } catch {
      failed.push(item);
    }
  }
  writeQueue(failed);
  flushing = false;
}

export function reportAppError(error: unknown, context: AppErrorLogContext = {}) {
  const normalized = normalizeError(error);
  void getBaseRecord(context, normalized).then((record) => {
    const xrm = getXrm();
    if (!xrm?.WebApi) {
      enqueue(record);
      return;
    }

    void xrm.WebApi.createRecord(LOGICAL_NAME, record)
      .then(() => flushAppErrorLogQueue())
      .catch(() => enqueue(record));
  }).catch(() => {
    enqueue({
      new_name: truncate(`error | logger | ${normalized.message}`, 160),
      new_occurredat: new Date().toISOString(),
      new_severity: "error",
      new_source: "logger",
      new_message: truncate(normalized.message, MAX_TEXT),
      new_stack: truncate(normalized.stack, MAX_STACK),
      new_sessionid: truncate(SESSION_ID, 120)
    });
  });
}

function errorFromConsoleArgs(args: unknown[]) {
  const firstError = args.find((item) => item instanceof Error);
  if (firstError) return firstError;
  return new Error(args.map((item) => (typeof item === "string" ? item : safeStringify(item, 2000))).join(" "));
}

export function installGlobalAppErrorLogger() {
  const runtime = getWindowRuntime();
  if (!runtime) return;
  runtime.__APP_REPORT_ERROR = reportAppError;
  if (runtime.__APP_ERROR_LOGGER_INSTALLED) return;
  runtime.__APP_ERROR_LOGGER_INSTALLED = true;

  runtime.addEventListener("error", (event) => {
    reportAppError(event.error ?? event.message, {
      severity: "critical",
      source: "window.error",
      action: event.filename,
      phase: `${event.lineno}:${event.colno}`,
      payload: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        message: event.message
      }
    });
  });

  runtime.addEventListener("unhandledrejection", (event) => {
    reportAppError(event.reason, {
      severity: "critical",
      source: "window.unhandledrejection"
    });
  });

  originalConsoleError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    originalConsoleError?.(...args);
    const text = args.map((item) => String(item)).join(" ");
    if (text.includes("[AppMotoristas:Log]") || text.includes("[AppMotoristas:Dataverse]")) return;
    reportAppError(errorFromConsoleArgs(args), {
      severity: "error",
      source: "console.error",
      payload: args
    });
  };

  runtime.addEventListener("online", () => {
    void flushAppErrorLogQueue();
  });
  void flushAppErrorLogQueue();
}
