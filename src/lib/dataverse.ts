import type { AgendaItem, DetailAction, DetailData, DetailField, MaintenancePhotoKind } from "../types";

type XrmLike = {
  Utility?: {
    getGlobalContext?: () => {
      userSettings?: { userId?: string };
      getClientUrl?: () => string;
    };
  };
  WebApi?: {
    retrieveMultipleRecords: (entitySetName: string, options?: string) => Promise<{ entities: DataverseRecord[] }>;
    retrieveRecord: (entitySetName: string, id: string, options?: string) => Promise<DataverseRecord>;
    updateRecord: (entitySetName: string, id: string, data: Record<string, unknown>) => Promise<unknown>;
    createRecord: (entitySetName: string, data: Record<string, unknown>) => Promise<{ id: string }>;
  };
};

export type DataverseRecord = Record<string, any>;

export type DriverContext = {
  id: string;
  email: string;
  fullName: string;
  funcionario: DataverseRecord | null;
};

export type RemoteStore = {
  agenda: AgendaItem[];
  history: AgendaItem[];
  driver: DriverContext | null;
};

export type FinalizePayload = {
  detail: DetailData;
  fields: Record<string, string>;
  signatureDataUrl?: string;
  photos?: Partial<Record<MaintenancePhotoKind, string>>;
};

const CATEGORY = {
  servico: 100000000,
  manutencao: 100000001,
  troca: 100000002
} as const;

const EXCHANGE_STATUS = {
  concluida: 202410001
} as const;

const EXCHANGE_TYPE = {
  troca: 100000000,
  devolucaoBase: 100000001,
  retiradaBase: 100000002
} as const;

const OPERATION_STATUS = {
  requerAnalise: 100000001,
  concluido: 202410008
} as const;

const MAINTENANCE_PAYMENT: Record<string, number> = {
  cartao: 202410000,
  "cartao de credito": 202410000,
  "pedido de compra": 202410001,
  dinheiro: 202410001,
  pix: 202410002
};

const MAINTENANCE_STATUS = {
  realizado: 202410002
} as const;

export const DATAVERSE = {
  clientes: "cr40f_clientes1s",
  veiculos: "cr40f_veiculoses",
  geral: "cr40f_reservadeveculos",
  funcionarios: "cr40f_funcionarios",
  bancoDeDados: "cr40f_bancodedadoses",
  manutencoes: "cr40f_manutencoeses",
  trocas: "cr40f_trocasdecarros",
  servicosPorPassageiro: "cr40f_servicosporpassageiros",
  posseVeiculos: "new_possedeveiculos",
  systemusers: "systemusers"
} as const;

const WEB_API_ENTITY: Record<string, string> = {
  [DATAVERSE.systemusers]: "systemuser"
};

const ENTITY_COLLECTION_ALIASES: Record<string, string> = {
  cr40f_reservadeveculoses: "cr40f_reservadeveculos",
  cr40f_reservadeveculoes: "cr40f_reservadeveculos",
  cr40f_funcionarioses: "cr40f_funcionarios",
  cr40f_funcionarioes: "cr40f_funcionarios"
};

function normalizeEntitySet(entitySetName: string) {
  return ENTITY_COLLECTION_ALIASES[entitySetName] || entitySetName;
}

const FLOW_URLS = {
  gerarVoucher: "VITE_FLOW_GERAR_VOUCHER_URL",
  salvarFotosManutencao: "VITE_FLOW_SALVAR_FOTOS_MANUTENCAO_URL"
} as const;

const GERAL_SELECT =
  "$select=cr40f_reservadeveculosid,cr40f_id,cr40f_dataehorriodesada,cr40f_trajeto,cr40f_passageirosetelefonedecontato,cr40f_endereodesada,cr40f_destino,cr40f_obsdeoperao,cr40f_perfildopassageiro,cr40f_receber,_cr40f_cliente_value,_cr40f_solicitante_value,_cr40f_veiculo_value,_cr40f_motorista_value,_cr40f_om_value,_cr40f_ot_value,cr40f_status,new_categoriadoitem,new_foiprogramado,new_datadefinalizacao,new_visualizacaodomotorista,new_rascunhovoucher,modifiedon";

const MAINTENANCE_SELECT =
  "$select=cr40f_manutencoesid,cr40f_id,cr40f_descricao,cr40f_comentariosaomotorista,cr40f_graudamanutencao,cr40f_tipodoreparo,cr40f_status,cr40f_servicorealizado,cr40f_estabelecimento,cr40f_valor,cr40f_pagamento,_cr40f_placa_carro_value,_cr40f_realizado_por_nome_value,new_comentariosdocolaborador,new_linkdanotafiscal,new_linkdafotofinal1,new_linkdafotofinal2,new_linkdafotofinal3";

const EXCHANGE_SELECT =
  "$select=cr40f_trocasdecarroid,cr40f_id,cr40f_iniciodajaneladetroca,cr40f_fimdajaneladetroca,_cr40f_motorista1_value,_cr40f_motorista2_value,_cr40f_veiculo1antesdatroca_value,_cr40f_veiculo2antesdatroca_value,cr40f_observacao,cr40f_statusdatroca,new_tipodetroca,new_concluidomotorista1,new_concluidomotorista2,new_observacaodomotorista1,new_observacaodomotorista2";

const DV_LOG_PREFIX = "[AppMotoristas:Dataverse]";
let lastRuntimeLogKey = "";

function dataverseLog(message: string, data?: unknown) {
  if (data === undefined) {
    console.info(DV_LOG_PREFIX, message);
    return;
  }
  console.info(DV_LOG_PREFIX, message, data);
}

function dataverseWarn(message: string, data?: unknown) {
  if (data === undefined) {
    console.warn(DV_LOG_PREFIX, message);
    return;
  }
  console.warn(DV_LOG_PREFIX, message, data);
}

function dataverseError(message: string, data?: unknown) {
  if (data === undefined) {
    console.error(DV_LOG_PREFIX, message);
    return;
  }
  console.error(DV_LOG_PREFIX, message, data);
}

function getWindowXrm(): XrmLike | null {
  const current = window as Window & { Xrm?: XrmLike };
  try {
    const parentWindow = window.parent as Window & { Xrm?: XrmLike };
    if (current.Xrm?.WebApi) {
      const clientUrl = current.Xrm.Utility?.getGlobalContext?.().getClientUrl?.() ?? "";
      const logKey = `current:${clientUrl}`;
      if (lastRuntimeLogKey !== logKey) {
        lastRuntimeLogKey = logKey;
        dataverseLog("Xrm.WebApi encontrado na janela atual.", { clientUrl });
      }
      return current.Xrm;
    }
    if (parentWindow?.Xrm?.WebApi) {
      const clientUrl = parentWindow.Xrm.Utility?.getGlobalContext?.().getClientUrl?.() ?? "";
      const logKey = `parent:${clientUrl}`;
      if (lastRuntimeLogKey !== logKey) {
        lastRuntimeLogKey = logKey;
        dataverseLog("Xrm.WebApi encontrado na janela parent.", { clientUrl });
      }
      return parentWindow.Xrm;
    }
    const logKey = `missing:${Boolean(current.Xrm)}:${Boolean(parentWindow?.Xrm)}`;
    if (lastRuntimeLogKey !== logKey) {
      lastRuntimeLogKey = logKey;
      dataverseWarn("Xrm.WebApi nao encontrado.", {
        hasWindowXrm: Boolean(current.Xrm),
        hasParentXrm: Boolean(parentWindow?.Xrm)
      });
    }
    return null;
  } catch (error) {
    dataverseWarn("Falha ao acessar window.parent.Xrm. Usando apenas window.Xrm.", error);
    if (current.Xrm?.WebApi) {
      const clientUrl = current.Xrm.Utility?.getGlobalContext?.().getClientUrl?.() ?? "";
      const logKey = `current-parent-error:${clientUrl}`;
      if (lastRuntimeLogKey !== logKey) {
        lastRuntimeLogKey = logKey;
        dataverseLog("Xrm.WebApi encontrado na janela atual apos falha no parent.", { clientUrl });
      }
      return current.Xrm;
    }
    return null;
  }
}

export function hasDataverseRuntime() {
  const hasRuntime = Boolean(getWindowXrm()?.WebApi);
  dataverseLog(hasRuntime ? "Runtime Xrm.WebApi detectado." : "Runtime Xrm.WebApi nao encontrado. Modo local/fallback.");
  return hasRuntime;
}

function getWebApi() {
  const api = getWindowXrm()?.WebApi;
  if (!api) throw new Error("Dataverse runtime indisponivel. Abra o app como web resource em Model-driven/Power Apps.");
  return api;
}

function cleanGuid(value = "") {
  return value.replace(/[{}]/g, "").toLowerCase();
}

function cleanODataGuid(value: unknown) {
  return cleanGuid(String(value ?? ""));
}

function escapeODataText(value: string) {
  return value.replace(/'/g, "''");
}

function encodeOptions(value: string) {
  return value.startsWith("?") ? value : `?${value}`;
}

function singularizeDataverseCollection(name: string) {
  if (!name) return name;
  const normalized = normalizeEntitySet(name);
  if (normalized !== name) return normalized;
  if (name === "cr40f_trocasdecarros") return "cr40f_trocasdecarro";
  if (name === "cr40f_trocasdecarroes") return "cr40f_trocasdecarro";
  if (name === "cr40f_reservadeveculoses") return "cr40f_reservadeveculo";
  if (name === "cr40f_reservadeveculoes") return "cr40f_reservadeveculo";
  if (name === "cr40f_funcionarioses") return "cr40f_funcionario";
  if (name === "cr40f_funcionarioes") return "cr40f_funcionario";
  if (name === "cr40f_manutencoeses") return "cr40f_manutencao";
  if (name === "cr40f_bancodedadoses") return "cr40f_bancodado";
  if (name === "cr40f_servicosporpassageiros") return "cr40f_servicosporpassageiro";
  if (name === "cr40f_veiculoses") return "cr40f_veiculo";
  if (name === "cr40f_clientes1s") return "cr40f_cliente1";
  if (name === "new_possedeveiculos") return "new_possedeveiculo";
  if (name.endsWith("es")) {
    const candidate = name.slice(0, -2);
    return candidate.endsWith("s") ? candidate.slice(0, -1) : candidate;
  }
  if (name.endsWith("s")) return name.slice(0, -1);
  return name;
}

function normalizeEntitySetFromAlias(name: string) {
  if (!name) return name;
  if (name === "systemusers") return "systemuser";
  return ENTITY_COLLECTION_ALIASES[name] || name;
}

function getWebApiEntityName(entitySetName: string) {
  return normalizeEntitySet(singularizeDataverseCollection(entitySetName));
}

function describeDataverseError(error: unknown) {
  const record = (error ?? {}) as Record<string, unknown>;
  return {
    message: String(record.message ?? ""),
    errorCode: record.errorCode ?? record.code ?? "",
    raw: error
  };
}

export async function retrieveMultiple(entitySetName: string, options = "") {
  const startedAt = performance.now();
  const entityName = getWebApiEntityName(entitySetName);
  dataverseLog("retrieveMultiple iniciado.", { entitySetName, entityName, options });
  try {
    const result = await getWebApi().retrieveMultipleRecords(entityName, encodeOptions(options));
    dataverseLog("retrieveMultiple concluido.", {
      entitySetName,
      entityName,
      count: result.entities.length,
      durationMs: Math.round(performance.now() - startedAt)
    });
    return result;
  } catch (error) {
    dataverseError("retrieveMultiple falhou.", {
      entitySetName,
      entityName,
      options,
      durationMs: Math.round(performance.now() - startedAt),
      error: describeDataverseError(error)
    });
    throw error;
  }
}

export async function retrieveOne(entitySetName: string, id: string, options = "") {
  const cleanId = cleanGuid(id);
  const startedAt = performance.now();
  const entityName = getWebApiEntityName(entitySetName);
  dataverseLog("retrieveRecord iniciado.", { entitySetName, entityName, id: cleanId, options });
  try {
    const result = await getWebApi().retrieveRecord(entityName, cleanId, encodeOptions(options));
    dataverseLog("retrieveRecord concluido.", {
      entitySetName,
      entityName,
      id: cleanId,
      durationMs: Math.round(performance.now() - startedAt)
    });
    return result;
  } catch (error) {
    dataverseError("retrieveRecord falhou.", {
      entitySetName,
      entityName,
      id: cleanId,
      options,
      durationMs: Math.round(performance.now() - startedAt),
      error: describeDataverseError(error)
    });
    throw error;
  }
}

export async function updateOne(entitySetName: string, id: string, data: Record<string, unknown>) {
  const cleanId = cleanGuid(id);
  const startedAt = performance.now();
  const entityName = getWebApiEntityName(entitySetName);
  dataverseLog("updateRecord iniciado.", { entitySetName, entityName, id: cleanId, fields: Object.keys(data) });
  try {
    const result = await getWebApi().updateRecord(entityName, cleanId, data);
    dataverseLog("updateRecord concluido.", {
      entitySetName,
      entityName,
      id: cleanId,
      durationMs: Math.round(performance.now() - startedAt)
    });
    return result;
  } catch (error) {
    dataverseError("updateRecord falhou.", {
      entitySetName,
      entityName,
      id: cleanId,
      fields: Object.keys(data),
      durationMs: Math.round(performance.now() - startedAt),
      error: describeDataverseError(error)
    });
    throw error;
  }
}

export async function createOne(entitySetName: string, data: Record<string, unknown>) {
  const startedAt = performance.now();
  const entityName = getWebApiEntityName(entitySetName);
  dataverseLog("createRecord iniciado.", { entitySetName, entityName, fields: Object.keys(data) });
  try {
    const result = await getWebApi().createRecord(entityName, data);
    dataverseLog("createRecord concluido.", {
      entitySetName,
      entityName,
      id: result.id,
      durationMs: Math.round(performance.now() - startedAt)
    });
    return result;
  } catch (error) {
    dataverseError("createRecord falhou.", {
      entitySetName,
      entityName,
      fields: Object.keys(data),
      durationMs: Math.round(performance.now() - startedAt),
      error: describeDataverseError(error)
    });
    throw error;
  }
}

async function getCurrentUserEmail() {
  const xrm = getWindowXrm();
  const userId = cleanGuid(xrm?.Utility?.getGlobalContext?.().userSettings?.userId ?? "");
  dataverseLog("Usuario atual detectado.", { userId });
  if (!userId) return "";
  const systemUser = await retrieveOne(DATAVERSE.systemusers, userId, "$select=internalemailaddress,fullname");
  const email = String(systemUser.internalemailaddress ?? "");
  dataverseLog("Email Microsoft do usuario carregado.", { email, fullName: systemUser.fullname ?? "" });
  return email;
}

export async function getDriverContext(): Promise<DriverContext> {
  const email = await getCurrentUserEmail();
  if (!email) throw new Error("Email Microsoft do usuario atual nao foi encontrado no Dataverse.");

  const result = await retrieveMultiple(
    DATAVERSE.funcionarios,
    `$select=cr40f_funcionariosid,cr40f_nomecompleto,cr40f_emailmicrosoft&$filter=cr40f_emailmicrosoft eq '${escapeODataText(email)}'&$top=1`
  );
  const funcionario = result.entities[0] ?? null;
  if (!funcionario) throw new Error("Motorista nao encontrado em Funcionarios pelo Email Microsoft.");

  dataverseLog("Motorista Dataverse resolvido.", {
    id: funcionario.cr40f_funcionariosid,
    email,
    fullName: funcionario.cr40f_nomecompleto
  });

  return {
    id: String(funcionario.cr40f_funcionariosid ?? ""),
    email,
    fullName: String(funcionario.cr40f_nomecompleto ?? ""),
    funcionario
  };
}

function toDate(value: unknown) {
  const date = value ? new Date(String(value)) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function formatAgendaTime(date: Date | null) {
  if (!date) return "";
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const sameDay = date.toDateString() === today.toDateString();
  const nextDay = date.toDateString() === tomorrow.toDateString();
  const prefix = sameDay ? "HOJE" : nextDay ? "AMANHA" : date.toLocaleDateString("pt-BR");
  return `${prefix} ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

function getLookupName(record: DataverseRecord, baseName: string) {
  return String(record[`_${baseName}_value@OData.Community.Display.V1.FormattedValue`] ?? record[`${baseName}@OData.Community.Display.V1.FormattedValue`] ?? "");
}

function getFormatted(record: DataverseRecord, logicalName: string) {
  return String(record[`${logicalName}@OData.Community.Display.V1.FormattedValue`] ?? record[logicalName] ?? "");
}

function getRecordId(record: DataverseRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = cleanODataGuid(record[key]);
    if (value) return value;
  }
  return "";
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isMaintenanceDoneStatus(record: DataverseRecord) {
  const statusLabel = normalizeText(getFormatted(record, "cr40f_status"));
  return statusLabel === "realizado" || statusLabel === "realizada";
}

function parseCurrencyNumber(value: string) {
  return Number(
    String(value ?? "")
      .replace("R$", "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim() || "0"
  );
}

function formatFlowInteger(value: string) {
  const number = Number(String(value ?? "").replace(/\D/g, ""));
  return Number.isFinite(number) ? String(Math.trunc(number)) : "0";
}

function formatFlowDecimal(value: string) {
  const number = parseCurrencyNumber(value);
  return Number.isFinite(number) ? number.toFixed(2) : "0.00";
}

function dataUrlToBase64(value = "") {
  const comma = value.indexOf(",");
  return comma >= 0 ? value.slice(comma + 1) : value;
}

function getFlowText(result: unknown, ...keys: string[]) {
  const record = (result ?? {}) as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return "";
}

function assertFlowSuccess(result: unknown, flowName: string) {
  const record = (result ?? {}) as Record<string, unknown>;
  const rawStatus = String(record.status ?? record.Status ?? record.resultado ?? record.Resultado ?? "").trim();
  if (!rawStatus) return;
  const status = normalizeText(rawStatus);
  if (status === "sucesso" || status === "success" || status === "ok") return;
  const message = String(record.message ?? record.mensagem ?? record.error ?? record.erro ?? `${flowName} retornou status ${rawStatus}`);
  throw new Error(message);
}

function bind(entitySetName: string, id: string) {
  return `/${entitySetName}(${cleanGuid(id)})`;
}

function getGeralId(record: DataverseRecord) {
  return getRecordId(record, "cr40f_reservadeveculosid", "cr40f_reservadeveiculosid");
}

function getMaintenanceIdFromGeral(record: DataverseRecord) {
  return cleanODataGuid(record._cr40f_om_value);
}

function getExchangeIdFromGeral(record: DataverseRecord) {
  return cleanODataGuid(record._cr40f_ot_value);
}

function getLookupId(record: DataverseRecord, logicalName: string) {
  return cleanODataGuid(record[`_${logicalName}_value`]);
}

function cleanPhoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeWhatsAppPhone(value: string) {
  const digits = cleanPhoneDigits(value);
  if (!digits) return "";
  if (digits.startsWith("00") && digits.length > 10) return digits.slice(2);
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.length === 10 && digits[2] !== "9") return `55${digits.slice(0, 2)}9${digits.slice(2)}`;
  return digits.length >= 10 ? digits : "";
}

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] ?? "";
}

function buildPassengerMessage(passengerName: string, driverName: string, serviceDate: Date | null) {
  const passenger = firstName(passengerName);
  const driver = firstName(driverName);
  const when = serviceDate
    ? serviceDate.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "";
  return [
    `Ola ${passenger || ","}`,
    "",
    driver
      ? `Sou o ${driver} da Betinhos e serei o responsavel pelo seu transporte${when ? ` em ${when}` : ""}.`
      : `Fui designado pela Betinhos como responsavel pelo seu atendimento${when ? ` em ${when}` : ""}.`,
    "Caso precise de suporte adicional, nossa central esta a disposicao:",
    "Telefone: +55 (12) 99723-6961",
    "Email: junior@betinhos.com.br",
    "",
    "Ate breve."
  ].join("\n");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function buildPassengersHtml(geralId: string, serviceDate: Date | null, driverName: string) {
  if (!geralId) return "";
  const rows = await retrieveMultiple(
    DATAVERSE.servicosPorPassageiro,
    [
      "$select=cr40f_servicosporpassageiroid,cr40f_ordemdeselecao,_cr40f_bancodedados_value,_cr40f_geral_value,new_enderecodesaidacolunaservicosporpassageiro",
      `$filter=_cr40f_geral_value eq ${cleanGuid(geralId)}`,
      "$orderby=cr40f_ordemdeselecao asc",
      "$top=20"
    ].join("&")
  );
  if (!rows.entities.length) return "";

  const passengers = await Promise.all(
    rows.entities.map(async (row) => {
      const passengerId = cleanODataGuid(row._cr40f_bancodedados_value);
      if (!passengerId) return null;
      const passenger = await retrieveOne(
        DATAVERSE.bancoDeDados,
        passengerId,
        "$select=cr40f_bancodedadosid,cr40f_nomedopassageiro,cr40f_telefone,cr40f_idioma"
      );
      const name = String(passenger.cr40f_nomedopassageiro ?? getLookupName(row, "cr40f_bancodedados") ?? "");
      const phoneRaw = String(passenger.cr40f_telefone ?? "");
      const phone = normalizeWhatsAppPhone(phoneRaw);
      const message = buildPassengerMessage(name, driverName, serviceDate);
      const phoneText = escapeHtml(phoneRaw || "Sem telefone");
      const phoneHtml = phone
        ? `<a href="https://wa.me/${phone}?text=${encodeURIComponent(message)}">${phoneText}</a>`
        : `<span style="color:#8a8a8a">${phoneText}</span>`;
      return `<span>${escapeHtml(name)}${name && phoneRaw ? " - " : ""}${phoneHtml}</span>`;
    })
  );

  return passengers.filter(Boolean).join("<br>");
}

function buildFields(record: DataverseRecord, passengerHtml = ""): DetailField[] {
  const date = toDate(record.cr40f_dataehorriodesada);
  return [
    { label: "Data e Horario de Saida", value: date ? date.toLocaleString("pt-BR") : "" },
    { label: "Cliente", value: getLookupName(record, "cr40f_cliente") || getFormatted(record, "cr40f_cliente") },
    { label: "Receber", value: getFormatted(record, "cr40f_receber") },
    { label: "Trajeto", value: String(record.cr40f_trajeto ?? "") },
    { label: "Passageiros e Telefones de Contato", value: passengerHtml || String(record.cr40f_passageirosetelefonedecontato ?? ""), html: true },
    { label: "Endereco de Saida", value: String(record.cr40f_endereodesada ?? "") },
    { label: "Destino", value: String(record.cr40f_destino ?? "") },
    { label: "Obs de Operacao", value: String(record.cr40f_obsdeoperao ?? "") },
    { label: "Perfil do Passageiro", value: String(record.cr40f_perfildopassageiro ?? "") },
    { label: "Solicitante", value: getLookupName(record, "cr40f_solicitante") },
    { label: "Veiculo", value: getLookupName(record, "cr40f_veiculo") }
  ].filter((field) => field.value);
}

function serviceActions(record: DataverseRecord): DetailAction[] {
  const cliente = getLookupName(record, "cr40f_cliente");
  return /tenn?aris/i.test(cliente) ? ["cancel", "voucher"] : ["cancel", "finalizar"];
}

function mapGeralService(record: DataverseRecord, passengerHtml = ""): AgendaItem {
  const date = toDate(record.cr40f_dataehorriodesada);
  const id = getGeralId(record);
  const trajectory = String(record.cr40f_trajeto ?? record.cr40f_id ?? "Servico");
  const minutesUntilStart = date ? (date.getTime() - Date.now()) / 60000 : Number.POSITIVE_INFINITY;
  const viewedAt = toDate(record.new_visualizacaodomotorista);
  const modifiedAt = toDate(record.modifiedon);
  const wasEditedAfterView = viewedAt && modifiedAt ? (modifiedAt.getTime() - viewedAt.getTime()) / 1000 > 10 : !viewedAt;
  const isReceber = normalizeText(getFormatted(record, "cr40f_receber")) === "sim";
  const detail: DetailData = {
    type: "SERVICO",
    id,
    title: "Detalhes do Servico",
    actions: serviceActions(record),
    fields: buildFields(record, passengerHtml),
    dataverse: { entitySetName: DATAVERSE.geral, id, record }
  };

  return {
    id: `srv-${id}`,
    tipo: "SERVICO",
    label: "Servico",
    time: formatAgendaTime(date),
    description: trajectory,
    priority: isReceber ? 10 : minutesUntilStart >= 0 && minutesUntilStart <= 30 && wasEditedAfterView ? 1 : wasEditedAfterView ? 3 : 0,
    searchText: `${id} ${trajectory}`.toLowerCase(),
    detail
  };
}

async function mapGeralServiceWithPassengers(record: DataverseRecord, driver: DriverContext) {
  const serviceId = getGeralId(record);
  let passengerHtml = "";
  try {
    passengerHtml = await buildPassengersHtml(serviceId, toDate(record.cr40f_dataehorriodesada), driver.fullName);
  } catch (error) {
    dataverseWarn("Falha ao enriquecer passageiros. Usando Pax - VIEW do Geral.", { serviceId, error });
  }
  return mapGeralService(record, passengerHtml);
}

function buildMaintenanceFields(geral: DataverseRecord, maintenance: DataverseRecord): DetailField[] {
  const date = toDate(geral.cr40f_dataehorriodesada);
  return [
    { label: "Data e Horario de Saida", value: date ? date.toLocaleString("pt-BR") : "" },
    { label: "ID Manutencao", value: String(maintenance.cr40f_id ?? "") },
    { label: "Veiculo", value: getLookupName(maintenance, "cr40f_placa_carro") || getLookupName(geral, "cr40f_veiculo") },
    { label: "Descricao", value: String(maintenance.cr40f_descricao ?? "") },
    { label: "Grau da Manutencao", value: getFormatted(maintenance, "cr40f_graudamanutencao") },
    { label: "Tipo do Reparo", value: getFormatted(maintenance, "cr40f_tipodoreparo") },
    { label: "Comentarios ao Motorista", value: String(maintenance.cr40f_comentariosaomotorista ?? "") },
    { label: "Obs de Operacao", value: String(geral.cr40f_obsdeoperao ?? "") },
    { label: "Link Nota Fiscal", value: String(maintenance.new_linkdanotafiscal ?? "") },
    { label: "Link Foto 1", value: String(maintenance.new_linkdafotofinal1 ?? "") },
    { label: "Link Foto 2", value: String(maintenance.new_linkdafotofinal2 ?? "") },
    { label: "Link Foto 3", value: String(maintenance.new_linkdafotofinal3 ?? "") }
  ].filter((field) => field.value);
}

function mapMaintenance(geral: DataverseRecord, maintenance: DataverseRecord): AgendaItem {
  const date = toDate(geral.cr40f_dataehorriodesada);
  const geralId = getGeralId(geral);
  const maintenanceId = getRecordId(maintenance, "cr40f_manutencoesid");
  const description = String(maintenance.cr40f_descricao ?? geral.cr40f_trajeto ?? "Manutencao");
  const detail: DetailData = {
    type: "MANUTENCAO",
    id: maintenanceId || geralId,
    title: "Detalhes da Manutencao",
    actions: ["cancel", "finalizar"],
    fields: buildMaintenanceFields(geral, maintenance),
    dataverse: {
      entitySetName: DATAVERSE.manutencoes,
      id: maintenanceId,
      record: { ...maintenance, __geralId: geralId, __geral: geral }
    }
  };

  return {
    id: `mnt-${maintenanceId || geralId}`,
    tipo: "MANUTENCAO",
    label: "Manutencao",
    time: formatAgendaTime(date),
    description,
    priority: 0,
    searchText: `${maintenanceId} ${geralId} ${description} ${getLookupName(maintenance, "cr40f_placa_carro")}`.toLowerCase(),
    detail
  };
}

function buildExchangeFields(exchange: DataverseRecord, geral?: DataverseRecord): DetailField[] {
  const start = toDate(exchange.cr40f_iniciodajaneladetroca);
  const end = toDate(exchange.cr40f_fimdajaneladetroca);
  return [
    { label: "Inicio da Janela", value: start ? start.toLocaleString("pt-BR") : "" },
    { label: "Fim da Janela", value: end ? end.toLocaleString("pt-BR") : "" },
    { label: "Motorista 1", value: getLookupName(exchange, "cr40f_motorista1") },
    { label: "Motorista 2", value: getLookupName(exchange, "cr40f_motorista2") },
    { label: "Veiculo 1 Antes da Troca", value: getLookupName(exchange, "cr40f_veiculo1antesdatroca") },
    { label: "Veiculo 2 Antes da Troca", value: getLookupName(exchange, "cr40f_veiculo2antesdatroca") },
    { label: "Tipo de Troca", value: getFormatted(exchange, "new_tipodetroca") },
    { label: "Observacao", value: String(exchange.cr40f_observacao ?? "") },
    { label: "Obs de Operacao", value: String(geral?.cr40f_obsdeoperao ?? "") }
  ].filter((field) => field.value);
}

function mapExchange(exchange: DataverseRecord, geral: DataverseRecord | undefined): AgendaItem {
  const start = toDate(exchange.cr40f_iniciodajaneladetroca);
  const exchangeId = getRecordId(exchange, "cr40f_trocasdecarroid");
  const geralId = geral ? getGeralId(geral) : "";
  const description =
    `${getLookupName(exchange, "cr40f_veiculo1antesdatroca")} <> ${getLookupName(exchange, "cr40f_veiculo2antesdatroca")}`.trim() ||
    String(exchange.cr40f_id ?? "Troca de Carro");
  const detail: DetailData = {
    type: "TROCA",
    id: exchangeId,
    title: "Detalhes da Troca",
    actions: ["cancel", "finalizar"],
    fields: buildExchangeFields(exchange, geral),
    dataverse: {
      entitySetName: DATAVERSE.trocas,
      id: exchangeId,
      record: { ...exchange, __geralId: geralId, __geral: geral }
    }
  };

  return {
    id: `trc-${exchangeId}`,
    tipo: "TROCA",
    label: "Troca de Carro",
    time: formatAgendaTime(start),
    description,
    priority: 0,
    searchText: `${exchangeId} ${description} ${getLookupName(exchange, "cr40f_motorista1")} ${getLookupName(exchange, "cr40f_motorista2")}`.toLowerCase(),
    detail
  };
}

function asHistoryItem(item: AgendaItem): AgendaItem {
  if (!item.detail) return item;
  return {
    ...item,
    id: `hist-${item.id}`,
    priority: 0,
    detail: {
      ...item.detail,
      actions: []
    }
  };
}

function getItemDateMs(item: AgendaItem) {
  const record = item.detail?.dataverse?.record as DataverseRecord | undefined;
  if (!record) return 0;
  if (item.tipo === "TROCA") return toDate(record.cr40f_iniciodajaneladetroca)?.getTime() ?? 0;
  const geral = (record.__geral as DataverseRecord | undefined) ?? record;
  return toDate(geral.cr40f_dataehorriodesada)?.getTime() ?? 0;
}

function addDateHeaders(items: AgendaItem[]) {
  const result: AgendaItem[] = [];
  let lastKey = "";
  for (const item of items) {
    const date = item.time?.split(" ")[0] ?? "";
    if (date && date !== lastKey) {
      lastKey = date;
      result.push({ id: `h-${date}-${result.length}`, tipo: "HEADER", tituloData: date === "HOJE" ? "Servicos de HOJE" : date === "AMANHA" ? "Servicos de AMANHA" : date, seta: "v" });
    }
    result.push(item);
  }
  return result;
}

function addHistoryDateHeaders(items: AgendaItem[]) {
  const result: AgendaItem[] = [];
  let lastKey = "";
  for (const item of items) {
    const date = item.time?.split(" ")[0] ?? "";
    if (date && date !== lastKey) {
      lastKey = date;
      const title = date === "HOJE" ? "Servicos de HOJE" : date === "AMANHA" ? "Servicos de AMANHA" : `Servicos de ${date}`;
      result.push({ id: `hh-${date}-${result.length}`, tipo: "HEADER", tituloData: title, seta: "v" });
    }
    result.push(item);
  }
  return result;
}

export async function loadRemoteStore(): Promise<RemoteStore> {
  dataverseLog("Carga remota iniciada.");
  const driver = await getDriverContext();
  const now = new Date();
  const start = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const end = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const historyStart = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const historyEnd = new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString();
  dataverseLog("Janela da agenda calculada.", { start, end, driverId: driver.id });

  const geralSelect =
    "$select=cr40f_reservadeveculosid,cr40f_id,cr40f_dataehorriodesada,cr40f_trajeto,cr40f_passageirosetelefonedecontato,cr40f_endereodesada,cr40f_destino,cr40f_obsdeoperao,cr40f_perfildopassageiro,cr40f_receber,_cr40f_cliente_value,_cr40f_solicitante_value,_cr40f_veiculo_value,_cr40f_motorista_value,_cr40f_om_value,_cr40f_ot_value,cr40f_status,new_categoriadoitem,new_foiprogramado,new_datadefinalizacao,new_visualizacaodomotorista,new_rascunhovoucher,modifiedon";

  const servicesResult = await retrieveMultiple(
    DATAVERSE.geral,
    [
      geralSelect,
      `$filter=cr40f_dataehorriodesada ge ${start} and cr40f_dataehorriodesada le ${end} and _cr40f_motorista_value eq ${driver.id} and new_foiprogramado eq true and new_categoriadoitem eq ${CATEGORY.servico} and new_datadefinalizacao eq null and cr40f_status ne ${OPERATION_STATUS.concluido} and cr40f_status ne ${OPERATION_STATUS.requerAnalise} and _cr40f_om_value eq null and _cr40f_ot_value eq null`,
      "$orderby=cr40f_dataehorriodesada asc",
      "$top=80"
    ].join("&")
  );

  const maintenanceGeralResult = await retrieveMultiple(
    DATAVERSE.geral,
    [
      geralSelect,
      `$filter=cr40f_dataehorriodesada ge ${start} and cr40f_dataehorriodesada le ${end} and _cr40f_motorista_value eq ${driver.id} and new_foiprogramado eq true and new_categoriadoitem eq ${CATEGORY.manutencao} and new_datadefinalizacao eq null and cr40f_status ne ${OPERATION_STATUS.concluido} and _cr40f_om_value ne null and _cr40f_ot_value eq null`,
      "$orderby=cr40f_dataehorriodesada asc",
      "$top=80"
    ].join("&")
  );

  const maintenanceRows = await Promise.all(
    maintenanceGeralResult.entities.map(async (geral) => {
      const maintenanceId = getMaintenanceIdFromGeral(geral);
      if (!maintenanceId) return null;
      const maintenance = await retrieveOne(
        DATAVERSE.manutencoes,
        maintenanceId,
        MAINTENANCE_SELECT
      );
      if (isMaintenanceDoneStatus(maintenance)) return null;
      return mapMaintenance(geral, maintenance);
    })
  );

  const programmedExchangeGeralResult = await retrieveMultiple(
    DATAVERSE.geral,
    [
      geralSelect,
      `$filter=new_foiprogramado eq true and new_categoriadoitem eq ${CATEGORY.troca} and new_datadefinalizacao eq null and _cr40f_ot_value ne null`,
      "$top=120"
    ].join("&")
  );

  const exchangeGeralById = new Map(
    programmedExchangeGeralResult.entities.map((geral) => [getExchangeIdFromGeral(geral), geral] as const).filter(([id]) => Boolean(id))
  );

  const exchangeResult = await retrieveMultiple(
    DATAVERSE.trocas,
    [
      EXCHANGE_SELECT,
      `$filter=cr40f_iniciodajaneladetroca le ${end} and cr40f_fimdajaneladetroca ge ${start} and (_cr40f_motorista1_value eq ${driver.id} or _cr40f_motorista2_value eq ${driver.id}) and cr40f_statusdatroca ne ${EXCHANGE_STATUS.concluida}`,
      "$orderby=cr40f_iniciodajaneladetroca asc",
      "$top=80"
    ].join("&")
  );

  const exchangeItems = exchangeResult.entities
    .filter((exchange) => {
      const isDriver1 = cleanODataGuid(exchange._cr40f_motorista1_value) === cleanGuid(driver.id);
      const isDriver2 = cleanODataGuid(exchange._cr40f_motorista2_value) === cleanGuid(driver.id);
      if (isDriver1 && exchange.new_concluidomotorista1 === true) return false;
      if (isDriver2 && exchange.new_concluidomotorista2 === true) return false;
      return exchangeGeralById.has(getRecordId(exchange, "cr40f_trocasdecarroid"));
    })
    .map((exchange) => mapExchange(exchange, exchangeGeralById.get(getRecordId(exchange, "cr40f_trocasdecarroid"))));

  const serviceItems = await Promise.all(servicesResult.entities.map((record) => mapGeralServiceWithPassengers(record, driver)));

  const items = [
    ...serviceItems,
    ...maintenanceRows.filter((item): item is AgendaItem => Boolean(item)),
    ...exchangeItems
  ].sort((a, b) => getItemDateMs(a) - getItemDateMs(b));

  const agenda = addDateHeaders(items);
  const historyServiceResult = await retrieveMultiple(
    DATAVERSE.geral,
    [
      geralSelect,
      `$filter=cr40f_dataehorriodesada ge ${historyStart} and cr40f_dataehorriodesada lt ${historyEnd} and _cr40f_motorista_value eq ${driver.id} and cr40f_status eq ${OPERATION_STATUS.concluido} and new_categoriadoitem eq ${CATEGORY.servico} and _cr40f_om_value eq null and _cr40f_ot_value eq null`,
      "$orderby=cr40f_dataehorriodesada desc",
      "$top=80"
    ].join("&")
  );

  const historyMaintenanceGeralResult = await retrieveMultiple(
    DATAVERSE.geral,
    [
      geralSelect,
      `$filter=cr40f_dataehorriodesada ge ${historyStart} and cr40f_dataehorriodesada lt ${historyEnd} and _cr40f_motorista_value eq ${driver.id} and cr40f_status eq ${OPERATION_STATUS.concluido} and new_categoriadoitem eq ${CATEGORY.manutencao} and _cr40f_om_value ne null and _cr40f_ot_value eq null`,
      "$orderby=cr40f_dataehorriodesada desc",
      "$top=80"
    ].join("&")
  );

  const historyMaintenanceRows = await Promise.all(
    historyMaintenanceGeralResult.entities.map(async (geral) => {
      const maintenanceId = getMaintenanceIdFromGeral(geral);
      if (!maintenanceId) return null;
      const maintenance = await retrieveOne(
        DATAVERSE.manutencoes,
        maintenanceId,
        MAINTENANCE_SELECT
      );
      if (!isMaintenanceDoneStatus(maintenance)) return null;
      return mapMaintenance(geral, maintenance);
    })
  );

  const historyExchangeGeralResult = await retrieveMultiple(
    DATAVERSE.geral,
    [
      geralSelect,
      `$filter=new_categoriadoitem eq ${CATEGORY.troca} and _cr40f_ot_value ne null`,
      "$top=120"
    ].join("&")
  );
  const historyExchangeGeralById = new Map(
    historyExchangeGeralResult.entities.map((geral) => [getExchangeIdFromGeral(geral), geral] as const).filter(([id]) => Boolean(id))
  );
  const historyExchangeResult = await retrieveMultiple(
    DATAVERSE.trocas,
    [
      EXCHANGE_SELECT,
      `$filter=cr40f_iniciodajaneladetroca le ${historyEnd} and cr40f_fimdajaneladetroca ge ${historyStart} and (_cr40f_motorista1_value eq ${driver.id} or _cr40f_motorista2_value eq ${driver.id}) and cr40f_statusdatroca eq ${EXCHANGE_STATUS.concluida}`,
      "$orderby=cr40f_iniciodajaneladetroca desc",
      "$top=80"
    ].join("&")
  );

  const historyServiceItems = await Promise.all(historyServiceResult.entities.map((record) => mapGeralServiceWithPassengers(record, driver)));

  const historyItems = [
    ...historyServiceItems,
    ...historyMaintenanceRows.filter((item): item is AgendaItem => Boolean(item)),
    ...historyExchangeResult.entities
      .filter((exchange) => historyExchangeGeralById.has(getRecordId(exchange, "cr40f_trocasdecarroid")))
      .map((exchange) => mapExchange(exchange, historyExchangeGeralById.get(getRecordId(exchange, "cr40f_trocasdecarroid"))))
  ].sort((a, b) => getItemDateMs(b) - getItemDateMs(a)).map(asHistoryItem);
  const history = addHistoryDateHeaders(historyItems);

  dataverseLog("Carga remota concluida.", {
    servicos: servicesResult.entities.length,
    manutencoes: maintenanceRows.filter(Boolean).length,
    trocas: exchangeItems.length,
    agendaComHeaders: agenda.length,
    historico: historyItems.length,
    historicoComHeaders: history.length
  });
  return { agenda, history, driver };
}

export async function loadRemoteDetailByParams(servicoId: string, tipo = ""): Promise<DetailData | null> {
  const id = cleanGuid(servicoId);
  const normalizedType = tipo.trim().toUpperCase();
  if (!id) return null;

  const driver = await getDriverContext();
  dataverseLog("Busca direta por parametro iniciada.", { id, tipo: normalizedType || "AUTO" });

  if (!normalizedType || normalizedType === "SERVICO") {
    try {
      const geral = await retrieveOne(DATAVERSE.geral, id, GERAL_SELECT);
      if (getGeralId(geral)) return (await mapGeralServiceWithPassengers(geral, driver)).detail ?? null;
    } catch (error) {
      dataverseWarn("Busca direta como SERVICO falhou.", { id, error });
    }
  }

  if (!normalizedType || normalizedType === "MANUTENCAO") {
    try {
      const maintenance = await retrieveOne(DATAVERSE.manutencoes, id, MAINTENANCE_SELECT);
      const linkedGeral = await retrieveMultiple(
        DATAVERSE.geral,
        [
          GERAL_SELECT,
          `$filter=_cr40f_om_value eq ${id}`,
          "$top=1"
        ].join("&")
      );
      const geral = linkedGeral.entities[0];
      if (geral) return mapMaintenance(geral, maintenance).detail ?? null;
    } catch (error) {
      dataverseWarn("Busca direta como MANUTENCAO falhou.", { id, error });
    }
  }

  if (!normalizedType || normalizedType === "TROCA") {
    try {
      const exchange = await retrieveOne(DATAVERSE.trocas, id, EXCHANGE_SELECT);
      const linkedGeral = await retrieveMultiple(
        DATAVERSE.geral,
        [
          GERAL_SELECT,
          `$filter=_cr40f_ot_value eq ${id}`,
          "$top=1"
        ].join("&")
      );
      return mapExchange(exchange, linkedGeral.entities[0]).detail ?? null;
    } catch (error) {
      dataverseWarn("Busca direta como TROCA falhou.", { id, error });
    }
  }

  dataverseWarn("Busca direta por parametro nao encontrou registro.", { id, tipo: normalizedType || "AUTO" });
  return null;
}

async function runHttpFlow(envKey: string, payload: Record<string, unknown>) {
  const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  const url = viteEnv[envKey] ?? "";
  if (!url) throw new Error(`URL do Flow nao configurada: ${envKey}. Use trigger HTTP/custom API para webresource React.`);
  const startedAt = performance.now();
  dataverseLog("Flow HTTP iniciado.", { envKey, payloadFields: Object.keys(payload) });
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const responseText = await response.text();
  if (!response.ok) {
    dataverseError("Flow HTTP falhou.", {
      envKey,
      status: response.status,
      statusText: response.statusText,
      durationMs: Math.round(performance.now() - startedAt),
      responseText
    });
    throw new Error(`Flow falhou: HTTP ${response.status}`);
  }
  dataverseLog("Flow HTTP concluido.", {
    envKey,
    status: response.status,
    durationMs: Math.round(performance.now() - startedAt),
    hasBody: Boolean(responseText)
  });
  if (!responseText) return {};
  try {
    return JSON.parse(responseText);
  } catch {
    dataverseWarn("Flow HTTP retornou corpo nao JSON.", {
      envKey,
      responseText
    });
    return { responseText };
  }
}

export async function saveVoucherRemote(payload: FinalizePayload) {
  const dv = payload.detail.dataverse;
  if (!dv?.id) throw new Error("Servico sem referencia Dataverse.");
  const record = dv.record ?? {};
  dataverseLog("Finalizacao por voucher iniciada.", { detailId: payload.detail.id, dataverseId: dv.id });
  const flowResult = await runHttpFlow(FLOW_URLS.gerarVoucher, {
    text: record.cr40f_reservadeveculosid ?? dv.id,
    text_1: dataUrlToBase64(payload.signatureDataUrl ?? ""),
    text_2: payload.fields.Desvio ?? "Nao",
    text_3: formatFlowInteger(payload.fields["Km Inicial"] ?? "0"),
    text_4: formatFlowInteger(payload.fields["Km Final"] ?? "0"),
    text_5: payload.fields["Horario Inicial"] ?? payload.fields["HorÃ¡rio Inicial"] ?? "",
    text_6: payload.fields["Espera Inicio"] ?? payload.fields["Espera InÃ­cio"] ?? "",
    text_7: payload.fields["Espera Final"] ?? "",
    text_8: formatFlowDecimal(payload.fields.Pedagio ?? payload.fields["PedÃ¡gio"] ?? "0"),
    text_9: formatFlowDecimal(payload.fields.Estacionamento ?? "0"),
    text_10: formatFlowDecimal(payload.fields.Combustivel ?? payload.fields["CombustÃ­vel"] ?? "0"),
    text_11: formatFlowDecimal(payload.fields.Hospedagem ?? "0"),
    text_12: formatFlowDecimal(payload.fields.Outros ?? "0"),
    text_13: payload.fields["Observacao Voucher"] ?? payload.fields["ObservaÃ§Ã£o Voucher"] ?? "",
    text_14: payload.fields["Horario Final"] ?? payload.fields["HorÃ¡rio Final"] ?? "",
    text_15: new Date().toISOString()
  });
  assertFlowSuccess(flowResult, "FlowGerarVoucher");
  await updateOne(DATAVERSE.geral, dv.id, {
    new_rascunhovoucher: null,
    cr40f_status: OPERATION_STATUS.concluido,
    new_datadefinalizacao: new Date().toISOString()
  });
  return flowResult;
}

export async function saveVoucherDraftRemote(detail: DetailData, fields: Record<string, string>) {
  const dv = detail.dataverse;
  if (!dv?.id || detail.type !== "SERVICO") return;
  if (Object.keys(fields).length === 0) {
    dataverseLog("Limpando rascunho voucher.", { detailId: detail.id, dataverseId: dv.id });
    await updateOne(DATAVERSE.geral, dv.id, { new_rascunhovoucher: null });
    return;
  }
  const [horaSaida = "", minSaida = ""] = String(fields["Horario Inicial"] ?? "").split(":");
  const [esperaIniHora = "", esperaIniMin = ""] = String(fields["Espera Inicio"] ?? "").split(":");
  const [esperaFimHora = "", esperaFimMin = ""] = String(fields["Espera Final"] ?? "").split(":");
  const draft = {
    km_inicial: fields["Km Inicial"] ?? "",
    km_final: fields["Km Final"] ?? "",
    hora_saida: horaSaida,
    min_saida: minSaida,
    espera_ini_hora: esperaIniHora,
    espera_ini_min: esperaIniMin,
    espera_fim_hora: esperaFimHora,
    espera_fim_min: esperaFimMin,
    desvio: fields.Desvio ?? "Nao",
    obs: fields["Observacao Voucher"] ?? "",
    pedagio: fields.Pedagio ?? "",
    estacionamento: fields.Estacionamento ?? "",
    combustivel: fields.Combustivel ?? "",
    hospedagem: fields.Hospedagem ?? "",
    outros: fields.Outros ?? ""
  };
  dataverseLog("Salvando rascunho voucher.", { detailId: detail.id, dataverseId: dv.id });
  await updateOne(DATAVERSE.geral, dv.id, {
    new_rascunhovoucher: JSON.stringify(draft)
  });
}

export async function finalizeServiceRemote(payload: FinalizePayload) {
  const dv = payload.detail.dataverse;
  if (!dv?.id) throw new Error("Servico sem referencia Dataverse.");
  dataverseLog("Finalizacao simples de servico iniciada.", { detailId: payload.detail.id, dataverseId: dv.id });
  await updateOne(DATAVERSE.geral, dv.id, {
    new_observacaofinal: payload.fields["Observacao Final"] ?? payload.fields["ObservaÃ§Ã£o Final"] ?? "",
    cr40f_status: OPERATION_STATUS.concluido,
    new_datadefinalizacao: new Date().toISOString()
  });
}

export async function cancelServiceRemote(detail: DetailData, reason: string) {
  const dv = detail.dataverse;
  if (!dv?.id) throw new Error("Servico sem referencia Dataverse.");
  const record = dv.record ?? {};
  const geralId = detail.type === "SERVICO" ? dv.id : cleanODataGuid(record.__geralId);
  if (!geralId) throw new Error("Registro Geral vinculado nao encontrado para cancelamento.");
  dataverseLog("Cancelamento/finalizacao local remota iniciado.", {
    detailId: detail.id,
    dataverseId: dv.id,
    geralId,
    hasReason: Boolean(reason)
  });
  await updateOne(DATAVERSE.geral, geralId, {
    new_observacaofinal: `Obs do Motorista: ${reason || "Cancelado no local."}`,
    cr40f_status: OPERATION_STATUS.requerAnalise,
    new_datadefinalizacao: new Date().toISOString()
  });
}

export async function markDetailViewedRemote(detail: DetailData) {
  const dv = detail.dataverse;
  if (!dv?.id) return;
  const record = dv.record ?? {};
  const geralId = detail.type === "SERVICO" ? dv.id : cleanODataGuid(record.__geralId);
  if (!geralId) return;
  dataverseLog("Marcando visualizacao do motorista.", { detailId: detail.id, type: detail.type, geralId });
  await updateOne(DATAVERSE.geral, geralId, {
    new_visualizacaodomotorista: new Date().toISOString()
  });
}

async function closeOpenPossessionByDriver(driverId: string) {
  if (!driverId) return;
  const result = await retrieveMultiple(
    DATAVERSE.posseVeiculos,
    `$select=new_possedeveiculoid&$filter=_new_motorista_value eq ${cleanGuid(driverId)} and new_fimdaposse eq null&$top=1`
  );
  const possession = result.entities[0];
  if (!possession?.new_possedeveiculoid) return;
  await updateOne(DATAVERSE.posseVeiculos, possession.new_possedeveiculoid, {
    new_fimdaposse: new Date().toISOString()
  });
}

async function closeOpenBasePossession(vehicleId: string) {
  if (!vehicleId) return;
  const result = await retrieveMultiple(
    DATAVERSE.posseVeiculos,
    `$select=new_possedeveiculoid&$filter=_new_veiculo_value eq ${cleanGuid(vehicleId)} and _new_motorista_value eq null and new_fimdaposse eq null&$top=1`
  );
  const possession = result.entities[0];
  if (!possession?.new_possedeveiculoid) return;
  await updateOne(DATAVERSE.posseVeiculos, possession.new_possedeveiculoid, {
    new_fimdaposse: new Date().toISOString()
  });
}

async function createPossession(vehicleId: string, driverId: string | null, exchangeId: string) {
  if (!vehicleId) return;
  const driverFilter = driverId ? `_new_motorista_value eq ${cleanGuid(driverId)}` : "_new_motorista_value eq null";
  const duplicate = await retrieveMultiple(
    DATAVERSE.posseVeiculos,
    `$select=new_possedeveiculoid&$filter=_new_veiculo_value eq ${cleanGuid(vehicleId)} and ${driverFilter} and _new_trocadecarrorelacionada_value eq ${cleanGuid(exchangeId)}&$top=1`
  );
  if (duplicate.entities[0]?.new_possedeveiculoid) {
    await updateOne(DATAVERSE.posseVeiculos, duplicate.entities[0].new_possedeveiculoid, {
      new_fimdaposse: null
    });
    return;
  }
  const data: Record<string, unknown> = {
    new_iniciodaposse: new Date().toISOString(),
    new_fimdaposse: null,
    "new_Veiculo@odata.bind": bind(DATAVERSE.veiculos, vehicleId),
    "new_TrocadeCarroRelacionada@odata.bind": bind(DATAVERSE.trocas, exchangeId)
  };
  if (driverId) data["new_Motorista@odata.bind"] = bind(DATAVERSE.funcionarios, driverId);
  await createOne(DATAVERSE.posseVeiculos, data);
}

async function applyExchangePossessionRemote(exchange: DataverseRecord, exchangeId: string) {
  const driver1Id = getLookupId(exchange, "cr40f_motorista1");
  const driver2Id = getLookupId(exchange, "cr40f_motorista2");
  const vehicle1Id = getLookupId(exchange, "cr40f_veiculo1antesdatroca");
  const vehicle2Id = getLookupId(exchange, "cr40f_veiculo2antesdatroca");
  const exchangeTypeValue = Number(exchange.new_tipodetroca);
  const exchangeType = normalizeText(getFormatted(exchange, "new_tipodetroca"));

  dataverseLog("Aplicando posse da troca concluida.", {
    exchangeId,
    exchangeTypeValue,
    exchangeType,
    driver1Id,
    driver2Id,
    vehicle1Id,
    vehicle2Id
  });

  if (exchangeTypeValue === EXCHANGE_TYPE.retiradaBase || exchangeType.includes("retirada")) {
    await closeOpenBasePossession(vehicle2Id);
    await createPossession(vehicle2Id, driver1Id, exchangeId);
    return;
  }

  if (exchangeTypeValue === EXCHANGE_TYPE.devolucaoBase || exchangeType.includes("devolucao") || exchangeType.includes("devolu")) {
    await closeOpenPossessionByDriver(driver1Id);
    await createPossession(vehicle1Id, null, exchangeId);
    return;
  }

  await closeOpenPossessionByDriver(driver1Id);
  await closeOpenPossessionByDriver(driver2Id);
  await createPossession(vehicle2Id, driver1Id, exchangeId);
  await createPossession(vehicle1Id, driver2Id, exchangeId);
}

export async function finalizeMaintenanceRemote(payload: FinalizePayload) {
  const dv = payload.detail.dataverse;
  if (!dv?.id) throw new Error("Manutencao sem referencia Dataverse.");
  const record = dv.record ?? {};
  const geralId = cleanODataGuid(record.__geralId);
  const paymentKey = normalizeText(payload.fields["Forma de Pagamento"] ?? "");
  const paymentValue = MAINTENANCE_PAYMENT[paymentKey];
  dataverseLog("Finalizacao de manutencao iniciada.", {
    detailId: payload.detail.id,
    dataverseId: dv.id,
    photoKinds: Object.keys(payload.photos ?? {})
  });
  const maintenancePatch: Record<string, unknown> = {
    cr40f_datamanutencao: new Date().toISOString(),
    cr40f_estabelecimento: payload.fields.Estabelecimento,
    cr40f_valor: parseCurrencyNumber(payload.fields.Valor ?? "0"),
    new_comentariosdocolaborador: payload.fields["Comentarios do Motorista"] ?? "",
    cr40f_servicorealizado: payload.fields["Servico Realizado"] ?? ""
  };
  if (paymentValue !== undefined) maintenancePatch.cr40f_pagamento = paymentValue;
  const motoristaId = cleanODataGuid((record.__geral as DataverseRecord | undefined)?._cr40f_motorista_value);
  if (motoristaId) maintenancePatch["cr40f_Realizado_por_nome@odata.bind"] = bind(DATAVERSE.funcionarios, motoristaId);

  await updateOne(DATAVERSE.manutencoes, dv.id, maintenancePatch);
  const flowResult = await runHttpFlow(FLOW_URLS.salvarFotosManutencao, {
    text: geralId || dv.id,
    text_1: dataUrlToBase64(payload.photos?.NOTAFISCAL ?? ""),
    text_2: dataUrlToBase64(payload.photos?.FOTO1 ?? ""),
    text_3: dataUrlToBase64(payload.photos?.FOTO2 ?? ""),
    text_4: dataUrlToBase64(payload.photos?.FOTO3 ?? "")
  });
  assertFlowSuccess(flowResult, "FlowSalvarFotosManutencao");
  const photoPatch: Record<string, unknown> = {};
  const notaFiscal = getFlowText(flowResult, "new_linkdanotafiscal", "linkNotaFiscal", "notaFiscal", "text_1");
  const foto1 = getFlowText(flowResult, "new_linkdafotofinal1", "linkFoto1", "foto1", "text_2");
  const foto2 = getFlowText(flowResult, "new_linkdafotofinal2", "linkFoto2", "foto2", "text_3");
  const foto3 = getFlowText(flowResult, "new_linkdafotofinal3", "linkFoto3", "foto3", "text_4");
  photoPatch.cr40f_status = MAINTENANCE_STATUS.realizado;
  if (notaFiscal) photoPatch.new_linkdanotafiscal = notaFiscal;
  if (foto1) photoPatch.new_linkdafotofinal1 = foto1;
  if (foto2) photoPatch.new_linkdafotofinal2 = foto2;
  if (foto3) photoPatch.new_linkdafotofinal3 = foto3;
  await updateOne(DATAVERSE.manutencoes, dv.id, photoPatch);
  if (geralId) {
    await updateOne(DATAVERSE.geral, geralId, {
      new_observacaofinal: payload.fields["Comentarios do Motorista"] ?? payload.fields["Observacoes"] ?? "",
      cr40f_status: OPERATION_STATUS.concluido,
      new_datadefinalizacao: new Date().toISOString()
    });
  }
}

export async function finalizeExchangeRemote(payload: FinalizePayload) {
  const dv = payload.detail.dataverse;
  if (!dv?.id) throw new Error("Troca sem referencia Dataverse.");
  const driver = await getDriverContext();
  const record = dv.record ?? {};
  const isDriver1 = cleanODataGuid(record._cr40f_motorista1_value) === cleanGuid(driver.id);
  const isDriver2 = cleanODataGuid(record._cr40f_motorista2_value) === cleanGuid(driver.id);
  if (!isDriver1 && !isDriver2) throw new Error("Motorista atual nao pertence a esta troca.");

  const observation = payload.fields.Observacoes ?? payload.fields["Observacao da Troca"] ?? "Sem observacao.";
  const exchangePatch: Record<string, unknown> = {};
  if (isDriver1) {
    exchangePatch.new_concluidomotorista1 = true;
    exchangePatch.new_observacaodomotorista1 = observation;
  }
  if (isDriver2) {
    exchangePatch.new_concluidomotorista2 = true;
    exchangePatch.new_observacaodomotorista2 = observation;
  }

  const driver1Done = isDriver1 ? true : record.new_concluidomotorista1 === true;
  const driver2Done = isDriver2 ? true : record.new_concluidomotorista2 === true;
  if (driver1Done && driver2Done) exchangePatch.cr40f_statusdatroca = EXCHANGE_STATUS.concluida;

  dataverseLog("Finalizacao de troca iniciada.", {
    detailId: payload.detail.id,
    dataverseId: dv.id,
    isDriver1,
    isDriver2,
    closesExchange: driver1Done && driver2Done
  });

  await updateOne(DATAVERSE.trocas, dv.id, exchangePatch);

  const geralId = cleanODataGuid(record.__geralId);
  if (geralId && driver1Done && driver2Done) {
    await applyExchangePossessionRemote(record, dv.id);
    await updateOne(DATAVERSE.geral, geralId, {
      new_observacaofinal: observation,
      cr40f_status: OPERATION_STATUS.concluido,
      new_datadefinalizacao: new Date().toISOString()
    });
  }
}



