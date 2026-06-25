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

export type AppErrorNotice = {
  id: string;
  severity: "info" | "warning" | "error" | "critical";
  source: string;
  action: string;
  phase: string;
  message: string;
  code: string;
  userMessage: string;
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

const REDACTED = "[redacted]";
const REDACTED_EMAIL = "[redacted-email]";
const REDACTED_PHONE = "[redacted-phone]";
const REDACTED_BASE64 = "[redacted-base64]";
const REDACTED_URL = "[redacted-url]";
const SENSITIVE_KEY_PATTERN = /(base64|conteudo|content|signature|assinatura|photo|foto|image|imagem|telefone|phone|email|mail|token|secret|senha|password|authorization|sharelink|link)/i;
const SENSITIVE_URL_HOST_PATTERN = /(sharepoint|onedrive|1drv|powerautomate|logic\.azure|flow\.microsoft|blob\.core\.windows)/i;

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

function redactUrl(value: string) {
  try {
    const parsed = new URL(value);
    if (SENSITIVE_URL_HOST_PATTERN.test(parsed.hostname)) return `${parsed.origin}/${REDACTED_URL}`;
    const query = parsed.search ? "?[redacted-query]" : "";
    const hash = parsed.hash ? "#[redacted-hash]" : "";
    return `${parsed.origin}${parsed.pathname}${query}${hash}`;
  } catch {
    return REDACTED_URL;
  }
}

export function redactSensitiveLogValue(value: unknown, key = "", depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (SENSITIVE_KEY_PATTERN.test(key)) return REDACTED;
  if (depth > 8) return "[MaxDepth]";

  if (typeof value === "string") {
    return value
      .replace(/data:[^;,]+;base64,[A-Za-z0-9+/=\s]{40,}/gi, `data:${REDACTED_BASE64}`)
      .replace(/\b[A-Za-z0-9+/]{160,}={0,2}\b/g, REDACTED_BASE64)
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, REDACTED_EMAIL)
      .replace(/(^|[^\d])((?:\+?55[\s.-]?)?(?:\(?\d{2}\)?[\s.-]?)?9?\d{4}[\s.-]?\d{4})(?=$|[^\d])/g, (_match, prefix) => `${prefix}${REDACTED_PHONE}`)
      .replace(/https?:\/\/[^\s"'<>)]*/gi, (url) => redactUrl(url));
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveLogValue(item, key, depth + 1));
  }

  if (typeof value === "object") {
    const redacted: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([entryKey, entryValue]) => {
      redacted[entryKey] = redactSensitiveLogValue(entryValue, entryKey, depth + 1);
    });
    return redacted;
  }

  return value;
}

function safeStringify(value: unknown, maxLength = MAX_TEXT) {
  try {
    const seen = new WeakSet<object>();
    const redactedValue = redactSensitiveLogValue(value);
    const json = JSON.stringify(redactedValue, (_key, item) => {
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
      message: String(redactSensitiveLogValue(error.message)),
      stack: String(redactSensitiveLogValue(error.stack ?? "")),
      code: String(record.errorCode ?? record.code ?? ""),
      rawJson: safeStringify(error, MAX_TEXT)
    };
  }

  const record = (error ?? {}) as Record<string, unknown>;
  return {
    name: String(record.name ?? typeof error),
    message: String(redactSensitiveLogValue(record.message ?? error ?? "Erro desconhecido")),
    stack: String(redactSensitiveLogValue(record.stack ?? "")),
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
  return String(redactSensitiveLogValue(value) ?? "").slice(0, maxLength);
}

function buildNoticeId(source: string, message: string, action: string, phase: string) {
  return `${source}|${action}|${phase}|${message}`.slice(0, 500);
}

function buildUserFacingMessage(message: string, code: string, context: AppErrorLogContext) {
  const normalized = message.trim();
  const privilegeMatch = normalized.match(/missing (prv[\w]+) privilege .* entity '([^']+)'/i);
  if (privilegeMatch) {
    const [, privilege, entityName] = privilegeMatch;
    return `Acesso negado no Power Apps. Falta permissão ${privilege} para a entidade ${entityName}. Peça para adicionar esse privilégio na role do usuário ou do time.`;
  }

  if (/powerapps\/apps\/.+\/launch/i.test(normalized) && /403/.test(normalized)) {
    return "Acesso negado ao abrir o app publicado no Power Apps. Confirme se o usuário tem role do app e permissões das tabelas exigidas.";
  }

  if (/msdyn_tour/i.test(normalized) && /403|forbidden|acesso negado/i.test(normalized)) {
    return "Acesso negado à entidade msdyn_tour. O usuário precisa de privilégio de leitura nessa tabela para o app abrir sem erro.";
  }

  if (/falha ao carregar recurso/i.test(normalized)) {
    return normalized;
  }

  if (code) {
    return `${normalized} Código: ${code}`.trim();
  }

  if (context.source === "window.unhandledrejection") return `Falha inesperada no app: ${normalized}`;
  return normalized || "Erro inesperado no app.";
}

function dispatchErrorNotice(normalized: ReturnType<typeof normalizeError>, context: AppErrorLogContext) {
  const runtime = getWindowRuntime();
  if (!runtime) return;
  const severity = context.severity ?? "error";
  const source = context.source ?? "app";
  const action = context.action ?? "";
  const phase = context.phase ?? "";
  const notice: AppErrorNotice = {
    id: buildNoticeId(source, normalized.message, action, phase),
    severity,
    source,
    action,
    phase,
    message: normalized.message,
    code: normalized.code,
    userMessage: buildUserFacingMessage(normalized.message, normalized.code, context)
  };
  runtime.dispatchEvent(new CustomEvent<AppErrorNotice>("appmotoristas:error", { detail: notice }));
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
  dispatchErrorNotice(normalized, context);
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

function isIgnorableWindowErrorMessage(message: unknown) {
  const normalized = String(message ?? "").trim().toLowerCase();
  return normalized === "resizeobserver loop completed with undelivered notifications.";
}

export function installGlobalAppErrorLogger() {
  const runtime = getWindowRuntime();
  if (!runtime) return;
  runtime.__APP_REPORT_ERROR = reportAppError;
  if (runtime.__APP_ERROR_LOGGER_INSTALLED) return;
  runtime.__APP_ERROR_LOGGER_INSTALLED = true;

  runtime.addEventListener("error", ((event: Event) => {
    const resourceTarget = event.target as (EventTarget & {
      tagName?: string;
      src?: string;
      href?: string;
      currentSrc?: string;
    }) | null;
    if (resourceTarget && resourceTarget !== runtime) {
      const tagName = String(resourceTarget.tagName ?? "resource").toLowerCase();
      const resourceUrl = String(resourceTarget.currentSrc ?? resourceTarget.src ?? resourceTarget.href ?? "").trim();
      reportAppError(new Error(`Falha ao carregar recurso ${tagName}: ${resourceUrl || "desconhecido"}`), {
        severity: "error",
        source: "window.resourceerror",
        action: resourceUrl,
        phase: tagName,
        payload: {
          tagName,
          resourceUrl
        }
      });
      return;
    }

    const errorEvent = event as ErrorEvent;
    if (isIgnorableWindowErrorMessage(errorEvent.message)) return;
    reportAppError(errorEvent.error ?? errorEvent.message, {
      severity: "critical",
      source: "window.error",
      action: errorEvent.filename,
      phase: `${errorEvent.lineno}:${errorEvent.colno}`,
      payload: {
        filename: errorEvent.filename,
        lineno: errorEvent.lineno,
        colno: errorEvent.colno,
        message: errorEvent.message
      }
    });
  }) as EventListener, true);

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
