import type { AgendaItem, DetailData, DetailField, MaintenancePhotoKind } from "../types";

import { getFieldValue, isBlankOrNotInformed } from "./fieldLookup.ts";
import { reportAppError } from "./appErrorLogger.ts";

export type LocalStore = {
  agenda: AgendaItem[];
  history: AgendaItem[];
  signatures: Record<string, string>;
  photos: Record<string, Partial<Record<MaintenancePhotoKind, string>>>;
};

export function upsertField(fields: DetailField[], label: string, value: string): DetailField[] {
  if (fields.some((field) => field.label === label)) {
    return fields.map((field) => (field.label === label ? { ...field, value } : field));
  }

  return [...fields, { label, value }];
}

export function withFields(detail: DetailData, updates: Record<string, string>): DetailData {
  const fields = Object.entries(updates).reduce((current, [label, value]) => upsertField(current, label, value), detail.fields);
  return { ...detail, fields, actions: [] };
}

export function saveSignatureLocally(store: LocalStore, detailId: string, dataUrl: string): LocalStore {
  return {
    ...store,
    signatures: {
      ...store.signatures,
      [detailId]: dataUrl
    }
  };
}

export function saveMaintenancePhoto(
  store: LocalStore,
  detailId: string,
  kind: MaintenancePhotoKind,
  dataUrl: string
): LocalStore {
  return {
    ...store,
    photos: {
      ...store.photos,
      [detailId]: {
        ...(store.photos[detailId] ?? {}),
        [kind]: dataUrl
      }
    }
  };
}

export function clearMaintenancePhotos(store: LocalStore, detailId: string): LocalStore {
  return {
    ...store,
    photos: {
      ...store.photos,
      [detailId]: {}
    }
  };
}

export function deleteMaintenancePhoto(store: LocalStore, detailId: string, kind: MaintenancePhotoKind): LocalStore {
  const nextPhotos = { ...(store.photos[detailId] ?? {}) };
  delete nextPhotos[kind];

  return {
    ...store,
    photos: {
      ...store.photos,
      [detailId]: nextPhotos
    }
  };
}

export function removeAgendaDetail(items: AgendaItem[], detail: DetailData): AgendaItem[] {
  return items.filter((item) => item.tipo === "HEADER" || item.detail?.id !== detail.id || item.detail?.type !== detail.type);
}

export function makeHistoryItem(store: LocalStore, detail: DetailData, fields: Record<string, string>, canceled = false): AgendaItem {
  const extraFields: Record<string, string> = {
    "Data de Finalização": new Date().toLocaleString("pt-BR"),
    ...fields
  };

  if (store.signatures[detail.id]) {
    extraFields.Assinatura = "Assinatura registrada localmente.";
  }

  const photoCount = Object.keys(store.photos[detail.id] ?? {}).length;
  if (photoCount > 0) {
    extraFields.Fotos = `${photoCount} foto(s) salva(s) localmente.`;
  }

  const finalizedDetail = withFields(detail, extraFields);
  const description = detail.fields.find((field) => field.label === "Trajeto")?.value ?? detail.title;

  return {
    id: `hist-local-${detail.type.toLowerCase()}-${detail.id}-${Date.now()}`,
    tipo: detail.type,
    label: detail.type === "SERVICO" ? "Serviço" : detail.type === "TROCA" ? "Troca de Carro" : "Manutenção",
    time: `AGORA ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
    description,
    priority: 0,
    canceled,
    searchText: `${detail.id} ${detail.title} ${detail.fields.map((field) => `${field.label} ${field.value}`).join(" ")}`,
    detail: finalizedDetail
  };
}

export function finalizeDetailLocally(store: LocalStore, detail: DetailData, fields: Record<string, string>): LocalStore {
  const historyItem = makeHistoryItem(store, detail, fields);
  return {
    ...store,
    agenda: removeAgendaDetail(store.agenda, detail),
    history: [historyItem, ...store.history]
  };
}

export function cancelDetailLocally(store: LocalStore, detail: DetailData, reason: string): LocalStore {
  const historyItem = makeHistoryItem(store, detail, { "Observação Final": reason || "Cancelado no local." }, true);
  return {
    ...store,
    agenda: removeAgendaDetail(store.agenda, detail),
    history: [historyItem, ...store.history]
  };
}

function parseLocalNumber(value: string | undefined) {
  const normalized = String(value ?? "")
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();
  return Number(normalized || "0");
}

function hasTimeValue(value: string) {
  return !isBlankOrNotInformed(value);
}

function isCurrencyFormatValid(value: string) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return true;

  const normalized = trimmed.replace(/^R\$\s*/i, "");
  return /^(\d+|\d{1,3}(\.\d{3})+)(,\d{1,2})?$/.test(normalized);
}

function isMoneyFieldValid(value: string) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return true;
  if (!isCurrencyFormatValid(trimmed)) return false;
  const parsed = parseLocalNumber(trimmed);
  return Number.isFinite(parsed) && parsed >= 0;
}

export type VoucherValidationField =
  | "startTime"
  | "waitStart"
  | "waitEnd"
  | "waitRange"
  | "toll"
  | "parking"
  | "fuel"
  | "hotel"
  | "others";

export type VoucherValidationResult = {
  messages: string[];
  fieldErrors: Partial<Record<VoucherValidationField, string>>;
};

function parseClockToMinutes(value: string) {
  const match = String(value ?? "").trim().match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function getServiceScheduledMinutes(detail?: DetailData) {
  const fieldValue =
    detail?.fields.find((field) => /data.*hor[aá]rio.*sa[ií]da/i.test(field.label))?.value ??
    detail?.fields.find((field) => /data.*hor[aá]rio/i.test(field.label))?.value ??
    "";
  const fieldMatch = String(fieldValue).match(/(\d{2}):(\d{2})/);
  if (fieldMatch) {
    return Number(fieldMatch[1]) * 60 + Number(fieldMatch[2]);
  }

  const dataverseValue = String(detail?.dataverse?.record?.cr40f_dataehorriodesada ?? "").trim();
  if (!dataverseValue) return null;
  const date = new Date(dataverseValue);
  if (Number.isNaN(date.getTime())) return null;
  return date.getHours() * 60 + date.getMinutes();
}

function resolveChronologicalMinutes(rawMinutes: number | null, referenceMinutes: number | null) {
  if (rawMinutes === null) return null;
  if (referenceMinutes === null) return rawMinutes;

  const dayOffset = Math.floor(referenceMinutes / 1440) * 1440;
  const referenceClock = ((referenceMinutes % 1440) + 1440) % 1440;
  const candidate = rawMinutes + dayOffset;
  const crossedMidnight = rawMinutes < referenceClock && referenceClock >= 18 * 60 && rawMinutes <= 6 * 60;
  return crossedMidnight ? candidate + 1440 : candidate;
}

export function getVoucherValidationResult(fields: Record<string, string>, detail?: DetailData): VoucherValidationResult {
  const messages: string[] = [];
  const fieldErrors: Partial<Record<VoucherValidationField, string>> = {};
  const startTime = getFieldValue(fields, "Horário Inicial", "Horario Inicial");
  const waitStart = getFieldValue(fields, "Espera Início", "Espera Inicio");
  const waitEnd = getFieldValue(fields, "Espera Final");
  const serviceScheduledMinutes = getServiceScheduledMinutes(detail);
  const startMinutes = resolveChronologicalMinutes(parseClockToMinutes(startTime), serviceScheduledMinutes);
  const waitStartMinutes = resolveChronologicalMinutes(parseClockToMinutes(waitStart), startMinutes);
  const waitEndMinutes = resolveChronologicalMinutes(parseClockToMinutes(waitEnd), waitStartMinutes ?? startMinutes);

  if (isBlankOrNotInformed(startTime)) {
    fieldErrors.startTime = "Horário inicial é obrigatório.";
  }

  if (hasTimeValue(waitStart) && !hasTimeValue(waitEnd)) {
    fieldErrors.waitEnd = "Preencha o horário final da espera.";
  }

  if (!hasTimeValue(waitStart) && hasTimeValue(waitEnd)) {
    fieldErrors.waitStart = "Preencha o horário inicial da espera.";
  }

  if (startMinutes !== null && waitStartMinutes !== null && waitStartMinutes > startMinutes) {
    fieldErrors.waitStart = "O início da espera não pode ser maior que o horário inicial.";
  }

  if (startMinutes !== null && waitEndMinutes !== null && waitEndMinutes > startMinutes) {
    fieldErrors.waitEnd = "O final da espera não pode ser maior que o horário inicial.";
  }

  if (waitStartMinutes !== null && waitEndMinutes !== null && waitEndMinutes <= waitStartMinutes) {
    fieldErrors.waitRange = "O horário final da espera deve ser maior que o inicial.";
  }

  const invalidExpenseLabels = [
    "Pedágio",
    "Pedagio",
    "Estacionamento",
    "Combustível",
    "Combustivel",
    "Hospedagem",
    "Outros"
  ].filter((label, index, all) => all.indexOf(label) === index && !isMoneyFieldValid(getFieldValue(fields, label)));

  if (invalidExpenseLabels.length) {
    const moneyMessage = "Preencha despesas com valores válidos.";
    if (!isMoneyFieldValid(getFieldValue(fields, "Pedágio", "Pedagio"))) fieldErrors.toll = moneyMessage;
    if (!isMoneyFieldValid(getFieldValue(fields, "Estacionamento"))) fieldErrors.parking = moneyMessage;
    if (!isMoneyFieldValid(getFieldValue(fields, "Combustível", "Combustivel"))) fieldErrors.fuel = moneyMessage;
    if (!isMoneyFieldValid(getFieldValue(fields, "Hospedagem"))) fieldErrors.hotel = moneyMessage;
    if (!isMoneyFieldValid(getFieldValue(fields, "Outros"))) fieldErrors.others = moneyMessage;
  }

  const orderedKeys: VoucherValidationField[] = ["startTime", "waitStart", "waitEnd", "waitRange", "toll", "parking", "fuel", "hotel", "others"];
  orderedKeys.forEach((key) => {
    const message = fieldErrors[key];
    if (message && !messages.includes(message)) messages.push(message);
  });

  return { messages, fieldErrors };
}

export function validateVoucherFields(fields: Record<string, string>, detail?: DetailData): string[] {
  return getVoucherValidationResult(fields, detail).messages;
}

export function validateMaintenanceFields(fields: Record<string, string>): string[] {
  const value = parseLocalNumber(fields.Valor);
  const serviceDone = getFieldValue(fields, "Serviço Realizado", "Servico Realizado");
  const paymentMethod = getFieldValue(fields, "Forma de Pagamento");
  const establishment = getFieldValue(fields, "Estabelecimento");
  const invalid =
    !serviceDone ||
    isBlankOrNotInformed(paymentMethod) ||
    isBlankOrNotInformed(establishment) ||
    value <= 0;

  return invalid ? ["Preencha corretamente: Manutenção Realizada, Forma de Pagamento, Estabelecimento e Valor."] : [];
}

export function findDetailByParams(items: AgendaItem[], servicoId: string, tipo: string): DetailData | null {
  const normalizedType = tipo.trim().toUpperCase();
  const normalizedId = servicoId.trim();
  if (!normalizedId) return null;

  return items.find((item) => {
    if (!item.detail) return false;
    const typeMatches = normalizedType ? item.detail.type === normalizedType : true;
    return typeMatches && item.detail.id === normalizedId;
  })?.detail ?? null;
}

export function detailsToClipboardText(detail: DetailData): string {
  return detail.fields
    .map((field) => {
      const value = field.value
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .trim();
      return `${field.label}: ${value}`;
    })
    .join("\n");
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

type XrmNavigationLike = {
  Navigation?: {
    openUrl?: (url: string, options?: { openInNewWindow?: boolean; height?: number; width?: number }) => void;
  };
};

function getXrmNavigation(): XrmNavigationLike | null {
  const current = window as Window & { Xrm?: XrmNavigationLike };
  try {
    const parentWindow = window.parent as Window & { Xrm?: XrmNavigationLike };
    return current.Xrm?.Navigation?.openUrl ? current.Xrm : parentWindow?.Xrm?.Navigation?.openUrl ? parentWindow.Xrm : null;
  } catch (error) {
    reportAppError(error, {
      severity: "warning",
      source: "local-workflow",
      action: "get-xrm-navigation",
      component: "localWorkflow"
    });
    return current.Xrm?.Navigation?.openUrl ? current.Xrm : null;
  }
}

export function openExternalUrl(url: string) {
  const targetUrl = String(url ?? "").trim();
  if (!targetUrl) return;

  const xrm = getXrmNavigation();
  if (xrm?.Navigation?.openUrl) {
    try {
      xrm.Navigation.openUrl(targetUrl, { openInNewWindow: true });
    } catch (error) {
      reportAppError(error, {
        severity: "error",
        source: "local-workflow",
        action: "open-external-url-xrm",
        component: "localWorkflow",
        payload: { targetUrl }
      });
      throw error;
    }
    return;
  }

  let opened: Window | null = null;
  try {
    opened = window.open(targetUrl, "_blank", "noopener,noreferrer");
  } catch (error) {
    reportAppError(error, {
      severity: "error",
      source: "local-workflow",
      action: "open-external-url-window-open",
      component: "localWorkflow",
      payload: { targetUrl }
    });
  }
  if (opened) {
    opened.opener = null;
    return;
  }

  try {
    window.location.assign(targetUrl);
  } catch (error) {
    reportAppError(error, {
      severity: "critical",
      source: "local-workflow",
      action: "open-external-url-location-assign",
      component: "localWorkflow",
      payload: { targetUrl }
    });
    throw error;
  }
}


