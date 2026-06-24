import type { DetailData } from "../types";
import { formatReceiptCurrencyByLanguage, formatReceiptDateByLanguage, getDefaultReceiptPaymentMethod, getReceiptDisplayPaymentMethod, normalizeReceiptLanguage, RECEIPT_LANGUAGE, type ReceiptLanguage } from "./receiptLanguage.ts";

export type PersonalReceiptModel = {
  idOp: string;
  nomePagante: string;
  cliente: string;
  idioma: ReceiptLanguage;
  idPag: string;
  dataEmissao: string;
  metodoPagamento: string;
  periodo: string;
  trajetos: string;
  valorTotal: string;
  observacoes: string;
};

export type PersonalReceiptEditableDraft = Pick<
  PersonalReceiptModel,
  "nomePagante" | "cliente" | "idioma" | "valorTotal" | "dataEmissao" | "metodoPagamento" | "observacoes"
>;

type BuildPersonalReceiptModelOptions = {
  receiptIdentifier?: string;
};

function getDefaultPaymentMethod(language: ReceiptLanguage = RECEIPT_LANGUAGE.portuguese) {
  return getDefaultReceiptPaymentMethod(language);
}

function getField(detail: DetailData | undefined, label: string) {
  return detail?.fields?.find((field) => field.label === label)?.value?.trim() ?? "";
}

function stripHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/span>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#039;/gi, "'")
    .replace(/&quot;/gi, "\"")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function firstPassengerName(rawValue: string) {
  const firstLine = stripHtml(rawValue).split("\n").map((line) => line.trim()).find(Boolean) ?? "";
  return firstLine.split(" - ")[0]?.trim() ?? "";
}

function formatDate(value: unknown) {
  const date = value ? new Date(String(value)) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(RECEIPT_LANGUAGE.portuguese);
}

function getTodayDisplayDate() {
  return formatDate(new Date().toISOString());
}

function formatDateTime(value: unknown) {
  const date = value ? new Date(String(value)) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getPendingReceiptIdentifier() {
  return "A definir";
}

function buildPeriodText(detail: DetailData | undefined, record: Record<string, unknown>) {
  const dateTime = formatDateTime(record.cr40f_dataehorriodesada);
  if (dateTime) return dateTime;
  return getField(detail, "Data e Horário de Saída");
}

function buildTrajetos(detail: DetailData | undefined) {
  const parts = [
    getField(detail, "Trajeto"),
    getField(detail, "Endereço de Saída") || getField(detail, "Endereco de Saida"),
    getField(detail, "Destino")
  ].filter(Boolean);

  if (!parts.length) return "";
  return parts.join("\n");
}

function buildObservations() {
  return "-";
}

function getFallbackOperationId() {
  return `OP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
}

function toYmdDateString(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const brMatch = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(trimmed);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}

function toDisplayDateString(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return trimmed;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (isoMatch) {
    const [year, month, day] = isoMatch.slice(1);
    return `${day}/${month}/${year}`;
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return trimmed;
  return date.toLocaleDateString("pt-BR");
}

function parseReceiptTotalInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const cleaned = trimmed
    .replace("R$", "")
    .replace(/\s/g, "")
    .trim();

  if (!cleaned) return null;
  if (cleaned.includes(",")) return Number(cleaned.replace(/\./g, "").replace(",", "."));
  return Number(cleaned.replace(/,/g, ""));
}

function formatReceiptTotalByLanguage(value: string, language: ReceiptLanguage) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const amount = parseReceiptTotalInput(trimmed);
  if (amount !== null && Number.isFinite(amount)) {
    return formatReceiptCurrencyByLanguage(amount, language);
  }
  if (/^R\$\s*/i.test(trimmed)) return trimmed.replace(/^R\$\s*/i, "R$ ");
  return `R$ ${trimmed}`;
}

export function buildPersonalReceiptModel(
  detail: DetailData | undefined,
  overrides: Partial<PersonalReceiptEditableDraft> = {},
  options: BuildPersonalReceiptModelOptions = {}
): PersonalReceiptModel {
  const hasDetail = Boolean(detail);
  const record = (detail?.dataverse?.record as Record<string, unknown> | undefined) ?? {};
  const operationId = detail?.id?.trim() || getFallbackOperationId();
  const passengersRaw = getField(detail, "Passageiros e Telefones de Contato");
  const nomePagante =
    hasDetail
      ? firstPassengerName(passengersRaw) ||
        getField(detail, "Solicitante") ||
        getField(detail, "Cliente") ||
        ""
      : "";

  const cliente = hasDetail ? getField(detail, "Cliente") : "";
  const idioma = normalizeReceiptLanguage(overrides.idioma);
  const valorFromRecord = typeof record.cr40f_valor === "number" ? record.cr40f_valor : null;
  const valorTotal = hasDetail
    ? (valorFromRecord !== null
      ? formatReceiptCurrencyByLanguage(valorFromRecord, idioma)
      : "")
    : "";

  const baseModel: PersonalReceiptModel = {
    idOp: operationId,
    nomePagante,
    cliente,
    idioma,
    idPag: options.receiptIdentifier?.trim() || getPendingReceiptIdentifier(),
    dataEmissao: formatReceiptDateByLanguage(getTodayDisplayDate(), idioma),
    metodoPagamento: getDefaultPaymentMethod(idioma),
    periodo: hasDetail ? buildPeriodText(detail, record) : "",
    trajetos: hasDetail ? buildTrajetos(detail) : "",
    valorTotal,
    observacoes: buildObservations()
  };

  return {
    ...baseModel,
    ...overrides,
    idioma,
    dataEmissao: formatReceiptDateByLanguage(getTodayDisplayDate(), idioma),
    metodoPagamento: getReceiptDisplayPaymentMethod(overrides.metodoPagamento ?? baseModel.metodoPagamento, idioma),
    valorTotal: overrides.valorTotal !== undefined ? formatReceiptTotalByLanguage(overrides.valorTotal, idioma) : baseModel.valorTotal
  };
}

export function buildPersonalReceiptDraft(detail?: DetailData): PersonalReceiptEditableDraft {
  if (!detail) {
    return {
      nomePagante: "",
      cliente: "",
      idioma: RECEIPT_LANGUAGE.portuguese,
      valorTotal: "",
      dataEmissao: toYmdDateString(getTodayDisplayDate()),
      metodoPagamento: getDefaultPaymentMethod(RECEIPT_LANGUAGE.portuguese),
      observacoes: "-"
    };
  }

  const model = buildPersonalReceiptModel(detail);
  const record = (detail.dataverse?.record as Record<string, unknown> | undefined) ?? {};
  const rawValor = typeof record.cr40f_valor === "number" && Number.isFinite(record.cr40f_valor)
    ? record.cr40f_valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : model.valorTotal.replace(/^R\$\s*/i, "");
  return {
    nomePagante: model.nomePagante,
    cliente: model.cliente,
    idioma: model.idioma,
    valorTotal: rawValor,
    dataEmissao: toYmdDateString(getTodayDisplayDate()),
    metodoPagamento: getDefaultPaymentMethod(model.idioma),
    observacoes: model.observacoes || "-"
  };
}
