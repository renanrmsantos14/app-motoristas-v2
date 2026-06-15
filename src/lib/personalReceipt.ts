import type { DetailData } from "../types";

export type PersonalReceiptModel = {
  idOp: string;
  nomePagante: string;
  cliente: string;
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
  "nomePagante" | "cliente" | "valorTotal" | "dataEmissao" | "metodoPagamento"
>;

function getField(detail: DetailData, label: string) {
  return detail.fields.find((field) => field.label === label)?.value?.trim() ?? "";
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
  return date.toLocaleDateString("pt-BR");
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

function buildReceiptId(operationId: string) {
  const digits = operationId.replace(/\D+/g, "");
  if (!digits) return `PAG-${operationId}`;
  return `PAG-${digits.padStart(4, "0").slice(-4)}`;
}

function buildPeriodText(detail: DetailData, record: Record<string, unknown>) {
  const dateTime = formatDateTime(record.cr40f_dataehorriodesada);
  if (dateTime) return dateTime;
  return getField(detail, "Data e Horário de Saída") || getField(detail, "Data e Horario de Saida") || "Não informado";
}

function buildTrajetos(detail: DetailData) {
  const parts = [
    getField(detail, "Trajeto"),
    getField(detail, "Endereço de Saída") || getField(detail, "Endereco de Saida"),
    getField(detail, "Destino")
  ].filter(Boolean);

  if (!parts.length) return "Não informado";
  return parts.join("\n");
}

function buildObservations(detail: DetailData) {
  return (
    getField(detail, "Obs de Operação") ||
    getField(detail, "Obs de Operacao") ||
    getField(detail, "Perfil do Passageiro") ||
    "Sem observações."
  );
}

export function buildPersonalReceiptModel(
  detail: DetailData,
  overrides: Partial<PersonalReceiptEditableDraft> = {}
): PersonalReceiptModel {
  const record = (detail.dataverse?.record as Record<string, unknown> | undefined) ?? {};
  const passengersRaw = getField(detail, "Passageiros e Telefones de Contato");
  const nomePagante =
    firstPassengerName(passengersRaw) ||
    getField(detail, "Solicitante") ||
    getField(detail, "Cliente") ||
    "Passageiro não informado";

  const cliente = getField(detail, "Cliente") || "Não informado";
  const valorFromRecord = typeof record.cr40f_valor === "number" ? record.cr40f_valor : null;
  const valorTotal = valorFromRecord !== null
    ? valorFromRecord.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "Não informado";

  const baseModel: PersonalReceiptModel = {
    idOp: detail.id || "Não informado",
    nomePagante,
    cliente,
    idPag: buildReceiptId(detail.id || "0"),
    dataEmissao: formatDate(new Date().toISOString()) || "Não informado",
    metodoPagamento: "Não informado",
    periodo: buildPeriodText(detail, record),
    trajetos: buildTrajetos(detail),
    valorTotal,
    observacoes: buildObservations(detail)
  };

  return {
    ...baseModel,
    ...overrides
  };
}

export function buildPersonalReceiptDraft(detail: DetailData): PersonalReceiptEditableDraft {
  const model = buildPersonalReceiptModel(detail);
  return {
    nomePagante: model.nomePagante,
    cliente: model.cliente,
    valorTotal: model.valorTotal,
    dataEmissao: model.dataEmissao,
    metodoPagamento: model.metodoPagamento
  };
}
