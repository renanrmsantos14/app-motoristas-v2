import type { AgendaItem, DetailAction, DetailData, DetailField, MaintenancePhotoKind } from "../types";

import type { CollisionLookupNavigationNames, CollisionPhotoKind } from "./collisions";
import type { ExpenseLookupNavigationNames, ExpenseReferenceData } from "./expenses";

import { getFieldValue } from "./fieldLookup.ts";

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
type AppResourceFlowEnv = Record<string, string | undefined>;
type WindowWithFlowEnv = Window & {
  __APP_FLOW_ENV?: AppResourceFlowEnv;
  __APP_REPORT_ERROR?: (error: unknown, context?: Record<string, unknown>) => void;
};

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
  onProgress?: (message: string) => void;
};

export type MaintenanceRequestPayload = {
  descricao: string;
  kmAtual: number;
  veiculoId: string;
  motoristaId: string;
  gravidade: number;
  agendarPara?: string;
  comentario?: string;
  photos?: string[];
  onProgress?: (message: string) => void;
};

export type MaintenanceRequestVehicleOption = {
  id: string;
  label: string;
  isCurrent: boolean;
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

const COLLISION_DATAVERSE_ATTACHMENT_TYPE: Record<CollisionPhotoKind, number> = {
  cena: 100000000,
  danoBetinhos: 100000001,
  danoTerceiro: 100000002,
  documentoTerceiro: 100000003,
  extra: 100000004,
  video: 100000004
};

function getCollisionAttachmentLabel(kind: CollisionPhotoKind) {
  if (kind === "cena") return "Local";
  if (kind === "danoBetinhos") return "Veiculos";
  if (kind === "danoTerceiro") return "CNH da pessoa";
  if (kind === "documentoTerceiro") return "Documento do veiculo da pessoa";
  if (kind === "video") return "Video";
  return "Extra";
}

export const DATAVERSE = {
  clientes: "cr40f_clientes1s",
  veiculos: "cr40f_veiculoses",
  geral: "cr40f_reservadeveculoses",
  funcionarios: "cr40f_funcionarioses",
  bancoDeDados: "cr40f_bancodedadoses",
  manutencoes: "cr40f_manutencoeses",
  despesasOperacionais: "cr40f_despesaoperacionals",
  anexosDespesasOperacionais: "cr40f_anexodespesaoperacionals",
  categoriasDespesasOperacionais: "cr40f_categoriadespesaoperacionals",
  formasPagamentoDespesas: "cr40f_formapagamentodespesas",
  colisoes: "cr40f_colisaos",
  anexosColisoes: "cr40f_anexocolisaos",
  trocas: "cr40f_trocasdecarros",
  servicosPorPassageiro: "cr40f_servicosporpassageiros",
  posseVeiculos: "new_possedeveiculos",
  fotosManutencao: "new_fotomanutencao",
  systemusers: "systemusers"
} as const;

const ENTITY_COLLECTION_ALIASES: Record<string, string> = {
  cr40f_reservadeveculoes: "cr40f_reservadeveculoses",
  cr40f_funcionarioes: "cr40f_funcionarioses"
};
const ENTITY_SET_TO_ENTITY_NAME: Record<string, string> = {
  [DATAVERSE.clientes]: "cr40f_clientes1",
  [DATAVERSE.veiculos]: "cr40f_veiculos",
  [DATAVERSE.geral]: "cr40f_reservadeveculos",
  [DATAVERSE.funcionarios]: "cr40f_funcionarios",
  [DATAVERSE.bancoDeDados]: "cr40f_bancodedados",
  [DATAVERSE.manutencoes]: "cr40f_manutencoes",
  [DATAVERSE.despesasOperacionais]: "cr40f_despesaoperacional",
  [DATAVERSE.anexosDespesasOperacionais]: "cr40f_anexodespesaoperacional",
  [DATAVERSE.categoriasDespesasOperacionais]: "cr40f_categoriadespesaoperacional",
  [DATAVERSE.formasPagamentoDespesas]: "cr40f_formapagamentodespesa",
  [DATAVERSE.colisoes]: "cr40f_colisao",
  [DATAVERSE.anexosColisoes]: "cr40f_anexocolisao",
  [DATAVERSE.trocas]: "cr40f_trocasdecarro",
  [DATAVERSE.servicosPorPassageiro]: "cr40f_servicosporpassageiro",
  [DATAVERSE.posseVeiculos]: "new_possedeveiculo",
  [DATAVERSE.fotosManutencao]: "new_fotomanutencao",
  [DATAVERSE.systemusers]: "systemuser",
  environmentvariabledefinitions: "environmentvariabledefinition",
  environmentvariablevalues: "environmentvariablevalue"
};

const FLOW_URLS = {
  gerarVoucher: "VITE_FLOW_GERAR_VOUCHER_URL",
  salvarFotosManutencao: "VITE_FLOW_SALVAR_FOTOS_MANUTENCAO_URL"
} as const;

const DEV_DATAVERSE_URL = "https://org23b93544.crm2.dynamics.com/";

const FLOW_DATAVERSE_ENVIRONMENT_VARIABLES: Record<string, string | undefined> = {
  [FLOW_URLS.gerarVoucher]: "new_FlowURLFlowGerarVoucherAppMotoristasv2",
  [FLOW_URLS.salvarFotosManutencao]: "new_FlowURLFlowSalvarArquivosOnedrive"
};

const GERAL_SELECT =
  "$select=cr40f_reservadeveculosid,cr40f_id,cr40f_dataehorriodesada,cr40f_trajeto,cr40f_passageirosetelefonedecontato,cr40f_endereodesada,cr40f_destino,cr40f_obsdeoperao,cr40f_perfildopassageiro,cr40f_receber,_cr40f_cliente_value,_cr40f_solicitante_value,_cr40f_veiculo_value,_cr40f_motorista_value,_cr40f_om_value,_cr40f_ot_value,cr40f_status,new_categoriadoitem,new_foiprogramado,new_datadefinalizacao,new_visualizacaodomotorista,new_rascunhovoucher,modifiedon";

const MAINTENANCE_SELECT =
  "$select=cr40f_manutencoesid,cr40f_id,cr40f_descricao,cr40f_comentariosaomotorista,cr40f_graudamanutencao,cr40f_tipodoreparo,cr40f_status,cr40f_servicorealizado,cr40f_estabelecimento,cr40f_valor,cr40f_pagamento,_cr40f_placa_carro_value,_cr40f_realizado_por_nome_value,new_comentariosdocolaborador,cr40f_foto01,cr40f_linkdaevidencia,cr40f_foto03,new_linkdanotafiscal,new_linkdafotofinal1,new_linkdafotofinal2,new_linkdafotofinal3";

const MAINTENANCE_REQUEST_PHOTO_FIELDS = ["cr40f_foto01", "cr40f_linkdaevidencia", "cr40f_foto03"] as const;

const EXCHANGE_SELECT =
  "$select=cr40f_trocasdecarroid,cr40f_id,cr40f_iniciodajaneladetroca,cr40f_fimdajaneladetroca,_cr40f_motorista1_value,_cr40f_motorista2_value,_cr40f_veiculo1antesdatroca_value,_cr40f_veiculo2antesdatroca_value,cr40f_observacao,cr40f_statusdatroca,new_tipodetroca,new_concluidomotorista1,new_concluidomotorista2,new_observacaodomotorista1,new_observacaodomotorista2";

const DV_LOG_PREFIX = "[AppMotoristas:Dataverse]";
let lastRuntimeLogKey = "";
const flowUrlCache = new Map<string, string>();

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
    (window as WindowWithFlowEnv).__APP_REPORT_ERROR?.(new Error(message), {
      severity: "error",
      source: "dataverse",
      action: message
    });
    return;
  }
  console.error(DV_LOG_PREFIX, message, data);
  (window as WindowWithFlowEnv).__APP_REPORT_ERROR?.(data, {
    severity: "error",
    source: "dataverse",
    action: message,
    payload: data
  });
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

function getWebApiEntityName(entitySetName: string) {
  const normalizedCollection = ENTITY_COLLECTION_ALIASES[entitySetName] ?? entitySetName;
  return ENTITY_SET_TO_ENTITY_NAME[normalizedCollection] || normalizedCollection;
}

function getBusinessId(record: DataverseRecord, fallback = "") {
  return String(record.cr40f_id ?? fallback ?? "").trim();
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
    `$select=cr40f_funcionariosid,cr40f_nomecompleto,cr40f_emailmicrosoft,_cr40f_veiculoatual_value&$filter=cr40f_emailmicrosoft eq '${escapeODataText(email)}'&$top=1`
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

export function getDriverCurrentVehicleId(driver: DriverContext | null) {
  return cleanODataGuid(driver?.funcionario?._cr40f_veiculoatual_value);
}

function getVehicleLabel(record: DataverseRecord) {
  const placa = String(record.cr40f_placa ?? "").trim();
  const modelo = [record.cr40f_marca, record.cr40f_modelo].map((value) => String(value ?? "").trim()).filter(Boolean).join(" ");
  return [placa, modelo].filter(Boolean).join(" - ") || cleanODataGuid(record.cr40f_veiculosid);
}

export async function loadMaintenanceRequestVehiclesRemote(driver: DriverContext) {
  const currentVehicleId = getDriverCurrentVehicleId(driver);
  const result = await retrieveMultiple(
    DATAVERSE.veiculos,
    "$select=cr40f_veiculosid,cr40f_placa,cr40f_marca,cr40f_modelo,_cr40f_motoristaatual_value&$orderby=cr40f_placa asc&$top=200"
  );
  return result.entities
    .map((record): MaintenanceRequestVehicleOption => {
      const id = cleanODataGuid(record.cr40f_veiculosid);
      return {
        id,
        label: getVehicleLabel(record),
        isCurrent: Boolean(currentVehicleId && id === currentVehicleId)
      };
    })
    .filter((vehicle) => Boolean(vehicle.id && vehicle.label));
}

function getBooleanValue(record: DataverseRecord, logicalName: string) {
  const value = record[logicalName];
  return value === true || value === 1 || value === "true";
}

const EXPENSE_CATEGORY_ACTIVE_QUERY =
  "$select=cr40f_categoriadespesaoperacionalid,cr40f_nome,cr40f_ordem,cr40f_exigeveiculo,cr40f_exigereserva,cr40f_exigekm,cr40f_exigelitros,cr40f_ativa&$filter=cr40f_ativa eq true&$orderby=cr40f_ordem asc,cr40f_nome asc";
const EXPENSE_CATEGORY_ALL_QUERY =
  "$select=cr40f_categoriadespesaoperacionalid,cr40f_nome,cr40f_ordem,cr40f_exigeveiculo,cr40f_exigereserva,cr40f_exigekm,cr40f_exigelitros,cr40f_ativa&$orderby=cr40f_ordem asc,cr40f_nome asc";
const EXPENSE_CATEGORY_MINIMAL_QUERY =
  "$select=cr40f_categoriadespesaoperacionalid,cr40f_nome&$orderby=cr40f_nome asc";
const EXPENSE_PAYMENT_ACTIVE_QUERY =
  "$select=cr40f_formapagamentodespesaid,cr40f_nome,cr40f_ordem,cr40f_tipo,cr40f_ativa&$filter=cr40f_ativa eq true&$orderby=cr40f_ordem asc,cr40f_nome asc";
const EXPENSE_PAYMENT_ALL_QUERY =
  "$select=cr40f_formapagamentodespesaid,cr40f_nome,cr40f_ordem,cr40f_tipo,cr40f_ativa&$orderby=cr40f_ordem asc,cr40f_nome asc";
const EXPENSE_PAYMENT_MINIMAL_QUERY =
  "$select=cr40f_formapagamentodespesaid,cr40f_nome&$orderby=cr40f_nome asc";

async function retrieveExpenseReferenceRecords(entitySetName: string, label: string, activeQuery: string, allQuery: string, minimalQuery: string) {
  let activeError: unknown = null;
  try {
    const activeResult = await retrieveMultiple(entitySetName, activeQuery);
    if (activeResult.entities.length) return activeResult;
    dataverseWarn(`Referencia de despesa sem registros ativos: ${label}. Tentando consulta sem filtro de ativo.`);
  } catch (error) {
    activeError = error;
    dataverseWarn(`Consulta ativa de referencia de despesa falhou: ${label}. Tentando consulta sem filtro de ativo.`, describeDataverseError(error));
  }

  try {
    const allResult = await retrieveMultiple(entitySetName, allQuery);
    if (allResult.entities.length) return allResult;
    dataverseWarn(`Referencia de despesa vazia: ${label}. Tentando consulta minima.`);
  } catch (error) {
    dataverseWarn(`Consulta completa de referencia de despesa falhou: ${label}. Tentando consulta minima.`, describeDataverseError(error));
  }

  try {
    return await retrieveMultiple(entitySetName, minimalQuery);
  } catch (error) {
    throw activeError ?? error;
  }
}

export async function loadExpenseReferenceDataRemote(): Promise<ExpenseReferenceData> {
  const [categoryResult, paymentResult] = await Promise.all([
    retrieveExpenseReferenceRecords(
      DATAVERSE.categoriasDespesasOperacionais,
      "categorias",
      EXPENSE_CATEGORY_ACTIVE_QUERY,
      EXPENSE_CATEGORY_ALL_QUERY,
      EXPENSE_CATEGORY_MINIMAL_QUERY
    ),
    retrieveExpenseReferenceRecords(
      DATAVERSE.formasPagamentoDespesas,
      "formas de pagamento",
      EXPENSE_PAYMENT_ACTIVE_QUERY,
      EXPENSE_PAYMENT_ALL_QUERY,
      EXPENSE_PAYMENT_MINIMAL_QUERY
    )
  ]);

  return {
    categories: categoryResult.entities
      .map((record) => ({
        id: cleanODataGuid(record.cr40f_categoriadespesaoperacionalid),
        name: String(record.cr40f_nome ?? "").trim(),
        order: Number(record.cr40f_ordem ?? 9999),
        exigeVeiculo: getBooleanValue(record, "cr40f_exigeveiculo"),
        exigeReserva: getBooleanValue(record, "cr40f_exigereserva"),
        exigeKm: getBooleanValue(record, "cr40f_exigekm"),
        exigeLitros: getBooleanValue(record, "cr40f_exigelitros")
      }))
      .filter((category) => Boolean(category.id && category.name)),
    paymentMethods: paymentResult.entities
      .map((record) => ({
        id: cleanODataGuid(record.cr40f_formapagamentodespesaid),
        name: String(record.cr40f_nome ?? "").trim(),
        order: Number(record.cr40f_ordem ?? 9999),
        tipo: String(record.cr40f_tipo ?? "").trim()
      }))
      .filter((method) => Boolean(method.id && method.name))
  };
}

export function buildMaintenanceRequestRecord(payload: MaintenanceRequestPayload) {
  const descricao = payload.descricao.trim();
  const kmAtual = Number(payload.kmAtual);
  const veiculoId = cleanGuid(payload.veiculoId);
  const motoristaId = cleanGuid(payload.motoristaId);
  const gravidade = Number(payload.gravidade);
  const agendarPara = payload.agendarPara?.trim();
  const comentario = payload.comentario?.trim();

  if (!descricao) throw new Error("Descricao da manutencao e obrigatoria.");
  if (!Number.isFinite(kmAtual) || kmAtual <= 0) throw new Error("Km atual deve ser maior que zero.");
  if (!veiculoId) throw new Error("Veiculo atual nao encontrado para solicitar manutencao.");
  if (!motoristaId) throw new Error("Motorista logado nao encontrado para solicitar manutencao.");
  if (!Number.isFinite(gravidade) || gravidade <= 0) throw new Error("Gravidade da manutencao e obrigatoria.");

  const data: Record<string, unknown> = {
    cr40f_descricao: descricao,
    cr40f_kmatual: Math.trunc(kmAtual),
    cr40f_graudamanutencao: Math.trunc(gravidade),
    "cr40f_Placa_Carro@odata.bind": bind(DATAVERSE.veiculos, veiculoId),
    "cr40f_Solicitado_por@odata.bind": bind(DATAVERSE.funcionarios, motoristaId)
  };

  if (agendarPara) data.cr40f_agendarpara = new Date(agendarPara).toISOString();
  if (comentario) data.cr40f_comentariosaomotorista = comentario;

  return data;
}

export async function createMaintenanceRequestRemote(payload: MaintenanceRequestPayload) {
  dataverseLog("Solicitacao de manutencao iniciada.", {
    kmAtual: payload.kmAtual,
    hasAgendarPara: Boolean(payload.agendarPara),
    photoCount: payload.photos?.length ?? 0
  });
  const result = await createOne(DATAVERSE.manutencoes, buildMaintenanceRequestRecord(payload));
  const photos = payload.photos?.filter(Boolean) ?? [];
  if (!photos.length) return result;

  payload.onProgress?.("Preparando pasta das fotos.");
  const maintenance = await retrieveOne(DATAVERSE.manutencoes, result.id, MAINTENANCE_SELECT);
  const photoFolderPath = `${await buildMaintenancePhotoFolder(maintenance)}/Solicitação`;

  payload.onProgress?.(`Enviando ${photos.length} arquivo(s) em paralelo.`);
  let completedRequestUploads = 0;
  const uploadResults = await Promise.allSettled(photos.map(async (photoDataUrl, index) => {
    const fileName = `foto-solicitacao-${index + 1}`;
    payload.onProgress?.(`Uploads paralelos: enviando arquivo ${index + 1}/${photos.length}.`);
    const link = await uploadMaintenancePhoto(photoFolderPath, photoDataUrl, fileName, {
      manutencaoId: maintenance.cr40f_id ?? "",
      manutencaoGuid: result.id,
      tipoFoto: "SOLICITACAO",
      indice: index + 1
    });
    completedRequestUploads += 1;
    payload.onProgress?.(`Uploads paralelos concluídos (${completedRequestUploads}/${photos.length}).`);
    return { fileName, link, order: index + 1 };
  }));
  const uploadedRequestLinks = uploadResults.flatMap((uploadResult) => uploadResult.status === "fulfilled" ? [uploadResult.value] : []);
  const failedUploads = uploadResults.length - uploadedRequestLinks.length;

  if (uploadedRequestLinks.length) {
    await Promise.all(uploadedRequestLinks.map((item) =>
      createMaintenancePhotoLinkRecord({
        maintenanceId: result.id,
        maintenanceBusinessId: String(maintenance.cr40f_id ?? ""),
        origin: "PRE_MANUTENCAO",
        photoType: "SOLICITACAO",
        link: item.link,
        path: photoFolderPath,
        fileName: item.fileName,
        order: item.order
      })
    ));
  }

  const firstThreeLinks = uploadedRequestLinks
    .map((item) => item.link)
    .filter(Boolean)
    .slice(0, 3);
  const photoPatch: Record<string, unknown> = {};
  MAINTENANCE_REQUEST_PHOTO_FIELDS.forEach((field, index) => {
    if (firstThreeLinks[index]) photoPatch[field] = firstThreeLinks[index];
  });
  if (Object.keys(photoPatch).length) {
    payload.onProgress?.("Gravando links das fotos no Dataverse.");
    await updateOne(DATAVERSE.manutencoes, result.id, photoPatch);
    const verified = await retrieveOne(
      DATAVERSE.manutencoes,
      result.id,
      `$select=${MAINTENANCE_REQUEST_PHOTO_FIELDS.join(",")}`
    );
    const missingFields = MAINTENANCE_REQUEST_PHOTO_FIELDS
      .slice(0, firstThreeLinks.length)
      .filter((field, index) => String(verified[field] ?? "") !== firstThreeLinks[index]);
    if (missingFields.length) {
      dataverseError("Links das fotos de solicitacao nao foram confirmados no Dataverse.", {
        maintenanceId: result.id,
        missingFields,
        expectedFields: Object.keys(photoPatch)
      });
      throw new Error("Fotos salvas no OneDrive, mas os links nao foram confirmados na manutencao.");
    }
  }
  if (failedUploads) {
    throw new Error(`Solicitação criada, mas ${failedUploads} de ${photos.length} foto(s) falharam no upload.`);
  }

  return result;
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
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = date.toDateString() === today.toDateString();
  const nextDay = date.toDateString() === tomorrow.toDateString();
  const previousDay = date.toDateString() === yesterday.toDateString();
  const prefix = sameDay ? "HOJE" : previousDay ? "ONTEM" : nextDay ? "AMANHÃ" : date.toLocaleDateString("pt-BR");
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

function formatFlowDecimal(value: string) {
  const number = parseCurrencyNumber(value);
  return Number.isFinite(number) ? number.toFixed(2) : "0.00";
}

function dataUrlToBase64(value = "") {
  const marker = ";base64,";
  const markerIndex = value.toLowerCase().indexOf(marker);
  const raw = markerIndex >= 0
    ? value.slice(markerIndex + marker.length)
    : value.slice(value.lastIndexOf(",") + 1);
  return raw.replace(/\s/g, "");
}

function assertValidBase64Payload(base64: string, context: Record<string, unknown>) {
  if (!base64 || base64.includes("data:") || base64.includes(",")) {
    dataverseError("Conteudo base64 invalido antes de chamar Flow.", {
      ...context,
      base64Chars: base64.length,
      startsWith: base64.slice(0, 48),
      endsWith: base64.slice(-48)
    });
    throw new Error("Arquivo invalido para envio: base64 veio com prefixo ou vazio.");
  }
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 !== 0) {
    dataverseError("Conteudo base64 malformado antes de chamar Flow.", {
      ...context,
      base64Chars: base64.length,
      startsWith: base64.slice(0, 24),
      endsWith: base64.slice(-24)
    });
    throw new Error("Arquivo invalido para envio: base64 malformado.");
  }
}

function getDataUrlMimeType(value = "") {
  const match = /^data:([^;,]+)[;,]/i.exec(value);
  return match?.[1]?.trim().toLowerCase() || "application/octet-stream";
}

function getFileExtensionFromMimeType(mimeType: string) {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "jpg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/heic") return "heic";
  if (normalized === "image/heif") return "heif";
  if (normalized === "video/mp4") return "mp4";
  if (normalized === "video/webm") return "webm";
  if (normalized === "video/quicktime") return "mov";
  const subtype = normalized.split("/")[1] ?? "";
  return subtype.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
}

function sanitizePathSegment(value: unknown, fallback: string) {
  const sanitized = String(value ?? "")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\.+$/g, "");
  return sanitized || fallback;
}

function shouldUseDevFolderPrefix() {
  const clientUrl = getWindowXrm()?.Utility?.getGlobalContext?.().getClientUrl?.() ?? "";
  return clientUrl.replace(/\/+$/, "").toLowerCase() === DEV_DATAVERSE_URL.replace(/\/+$/, "").toLowerCase();
}

function getFlowLink(result: unknown) {
  const record = (result ?? {}) as Record<string, unknown>;
  const direct = getFlowText(
    record,
    "shareLink",
    "link",
    "webUrl",
    "url",
    "fileLink",
    "sharedLink"
  );
  if (direct) return direct;
  const nestedLink = (record.link ?? record.shareLink ?? {}) as Record<string, unknown>;
  const nestedDirect = getFlowText(nestedLink, "webUrl", "url", "href");
  if (nestedDirect) return nestedDirect;
  const bodyRecord = parseFlowRecord(record.body ?? record.Body ?? record.responseText);
  if (bodyRecord) return getFlowLink(bodyRecord);
  return "";
}

function parseFlowRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "object") return value as Record<string, unknown>;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function describeFlowResultForLog(result: unknown) {
  const record = (result ?? {}) as Record<string, unknown>;
  return {
    keys: Object.keys(record),
    status: record.status ?? record.Status ?? record.resultado ?? record.Resultado ?? "",
    message: record.message ?? record.mensagem ?? record.error ?? record.erro ?? "",
    hasShareLink: Boolean(getFlowText(record, "shareLink")),
    hasLink: Boolean(getFlowText(record, "link")),
    hasWebUrl: Boolean(getFlowText(record, "webUrl")),
    hasUrl: Boolean(getFlowText(record, "url")),
    hasFileLink: Boolean(getFlowText(record, "fileLink")),
    hasSharedLink: Boolean(getFlowText(record, "sharedLink")),
    hasBody: Boolean(record.body ?? record.Body),
    bodyKeys: Object.keys(parseFlowRecord(record.body ?? record.Body ?? record.responseText) ?? {})
  };
}

function requireFlowLink(result: unknown, context: Record<string, unknown>) {
  const link = getFlowLink(result);
  if (link) return link;
  dataverseError("FlowSalvarArquivosOnedrive nao retornou link compartilhavel.", {
    ...context,
    expectedKeys: ["shareLink", "link", "webUrl", "url", "fileLink", "sharedLink"],
    flowResult: describeFlowResultForLog(result)
  });
  throw new Error("Foto salva no OneDrive, mas o Flow nao retornou link compartilhavel. Envio interrompido.");
}

async function buildMaintenancePhotoFolder(record: DataverseRecord) {
  const geral = (record.__geral as DataverseRecord | undefined) ?? {};
  const vehicleId = cleanODataGuid(record._cr40f_placa_carro_value) || cleanODataGuid(geral._cr40f_veiculo_value);
  let vehicleLabel = "Sem modelo - Sem placa";
  if (vehicleId) {
    const vehicle = await retrieveOne(DATAVERSE.veiculos, vehicleId, "$select=cr40f_modelo,cr40f_placa");
    vehicleLabel = `${String(vehicle.cr40f_modelo ?? "Sem modelo").trim() || "Sem modelo"} - ${
      String(vehicle.cr40f_placa ?? "Sem placa").trim() || "Sem placa"
    }`;
  }
  const maintenanceBusinessId = sanitizePathSegment(record.cr40f_id, "Sem ID");
  const devPrefix = shouldUseDevFolderPrefix() ? "DEV/" : "";
  return `Manutenções/${devPrefix}${sanitizePathSegment(vehicleLabel, "Sem modelo - Sem placa")}/${maintenanceBusinessId}`;
}

async function uploadMaintenancePhoto(
  path: string,
  photoDataUrl: string,
  fileNameBase: string,
  metadata: Record<string, unknown>
) {
  const mimeType = getDataUrlMimeType(photoDataUrl);
  const extension = getFileExtensionFromMimeType(mimeType);
  const base64 = dataUrlToBase64(photoDataUrl);
  const fileName = `${sanitizePathSegment(fileNameBase, "arquivo")}.${extension}`;
  assertValidBase64Payload(base64, { path, fileName, mimeType, metadata });
  const flowResult = await runHttpFlow(FLOW_URLS.salvarFotosManutencao, {
    caminhoCompleto: path,
    nomeArquivo: fileName,
    conteudoBase64: base64,
    mimeType,
    metadados: metadata
  });
  assertFlowSuccess(flowResult, "FlowSalvarArquivosOnedrive");
  return requireFlowLink(flowResult, {
    path,
    fileName,
    mimeType,
    metadata
  });
}

export async function uploadExpenseInvoiceRemote({
  expenseId,
  expenseName,
  motoristaId,
  dataUrl,
  fileName,
  order = 1,
  onProgress
}: {
  expenseId: string;
  expenseName: string;
  motoristaId?: string;
  dataUrl: string;
  fileName?: string;
  order?: number;
  onProgress?: (message: string) => void;
}) {
  if (!dataUrl) return "";
  const baseName = sanitizePathSegment(fileName?.replace(/\.[^.]+$/, ""), `comprovante-${order}`);
  const devPrefix = shouldUseDevFolderPrefix() ? "DEV/" : "";
  const path = `Despesas/${devPrefix}${sanitizePathSegment(expenseName, "Sem nome")}`;
  const lookupNavigationNames = await loadExpenseAttachmentLookupNavigationNamesRemote();
  onProgress?.(`Enviando comprovante ${order}.`);
  const link = await uploadMaintenancePhoto(path, dataUrl, baseName, {
    despesaGuid: expenseId,
    despesaNome: expenseName,
    tipo: "COMPROVANTE",
    indice: order
  });

  onProgress?.(`Vinculando comprovante ${order} à despesa.`);
  const record: Record<string, unknown> = {
    cr40f_nome: `Comprovante ${order} - ${expenseName}`,
    cr40f_nomearquivo: fileName || `${baseName}`,
    cr40f_urlsharepoint: link,
    cr40f_sharelink: link,
    cr40f_dataenvio: new Date().toISOString(),
    cr40f_ordem: order,
    cr40f_status: 100000001,
    cr40f_tipo: 100000000,
    [`${lookupNavigationNames.despesa}@odata.bind`]: bind(DATAVERSE.despesasOperacionais, expenseId)
  };
  if (motoristaId) record[`${lookupNavigationNames.enviadoPor}@odata.bind`] = bind(DATAVERSE.funcionarios, motoristaId);
  await createOne(DATAVERSE.anexosDespesasOperacionais, record);
  return link;
}

export async function uploadCollisionPhotoRemote({
  collisionId,
  collisionName,
  motoristaId,
  dataUrl,
  kind,
  order = 1,
  onProgress
}: {
  collisionId: string;
  collisionName: string;
  motoristaId?: string;
  dataUrl: string;
  kind: CollisionPhotoKind;
  order?: number;
  onProgress?: (message: string) => void;
}) {
  if (!dataUrl) return "";
  const devPrefix = shouldUseDevFolderPrefix() ? "DEV/" : "";
  const isVideo = getDataUrlMimeType(dataUrl).startsWith("video/");
  const extension = getFileExtensionFromMimeType(getDataUrlMimeType(dataUrl));
  const label = kind === "video" ? `Video ${order}` : kind === "extra" ? `Extra ${order}` : getCollisionAttachmentLabel(kind);
  const baseName = sanitizePathSegment(`colisao-${label}-${order}`, `colisao-${order}`);
  const path = `Colisões/${devPrefix}${sanitizePathSegment(collisionName, "Sem nome")}`;
  const lookupNavigationNames = await loadCollisionAttachmentLookupNavigationNamesRemote();

  onProgress?.(`Enviando ${isVideo ? "video" : "foto"} ${order}.`);
  const link = await uploadMaintenancePhoto(path, dataUrl, baseName, {
    colisaoGuid: collisionId,
    colisaoNome: collisionName,
    tipo: kind,
    tipoMidia: isVideo ? "video" : "foto",
    indice: order
  });

  onProgress?.(`Vinculando ${isVideo ? "video" : "foto"} ${order} à colisão.`);
  const recordName = `${label} ${order} - ${collisionName}`.slice(0, 100);
  const record: Record<string, unknown> = {
    cr40f_name: recordName,
    cr40f_nome: recordName,
    cr40f_nomearquivo: `${baseName}.${extension}`,
    cr40f_urlsharepoint: link,
    cr40f_sharelink: link,
    cr40f_dataenvio: new Date().toISOString(),
    cr40f_ordem: order,
    cr40f_status: 100000001,
    cr40f_tipo: COLLISION_DATAVERSE_ATTACHMENT_TYPE[kind],
    cr40f_tipomidia: isVideo ? 100000001 : 100000000,
    [`${lookupNavigationNames.colisao}@odata.bind`]: bind(DATAVERSE.colisoes, collisionId)
  };
  if (motoristaId) record[`${lookupNavigationNames.enviadoPor}@odata.bind`] = bind(DATAVERSE.funcionarios, motoristaId);
  await createOne(DATAVERSE.anexosColisoes, record);
  return link;
}

function formatMaintenanceRequestPhotoLinks(existingComment: string, links: string[]) {
  const validLinks = links.map((link) => link.trim()).filter(Boolean);
  if (!validLinks.length) return existingComment;
  const linkBlock = validLinks.map((link, index) => `Foto solicitação ${index + 1}: ${link}`).join("\n");
  return [existingComment.trim(), linkBlock].filter(Boolean).join("\n\n");
}

type MaintenancePhotoOrigin = "PRE_MANUTENCAO" | "POS_MANUTENCAO" | "NOTA_FISCAL";

async function createMaintenancePhotoLinkRecord({
  maintenanceId,
  maintenanceBusinessId,
  origin,
  photoType,
  link,
  path,
  fileName,
  order
}: {
  maintenanceId: string;
  maintenanceBusinessId: string;
  origin: MaintenancePhotoOrigin;
  photoType: string;
  link: string;
  path: string;
  fileName: string;
  order: number;
}) {
  if (!link.trim()) return;
  await createOne(DATAVERSE.fotosManutencao, {
    new_name: `${maintenanceBusinessId || cleanGuid(maintenanceId)} - ${origin} - ${order}`,
    new_tipofoto: photoType,
    new_origem: origin,
    new_link: link,
    new_caminho: path,
    new_nomearquivo: fileName,
    new_ordem: order,
    "new_Manutencao@odata.bind": bind(DATAVERSE.manutencoes, maintenanceId)
  });
}

function describeFlowUrl(url: string) {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    const lastPath = pathParts[pathParts.length - 1] ?? "";
    return `${parsed.hostname}/${lastPath.slice(0, 12)}${lastPath.length > 12 ? "..." : ""}`;
  } catch {
    return "URL invalida";
  }
}

function describeFlowUrlForDebug(url: string) {
  try {
    const parsed = new URL(url);
    const params = Array.from(parsed.searchParams.keys());
    const sig = parsed.searchParams.get("sig") ?? parsed.searchParams.get("code") ?? "";
    const redactedParams = params.length ? `?${params.join("=&")}=` : " sem query";
    const sigHint = sig ? ` sig/code final: ...${sig.slice(-8)}` : "";
    return `${parsed.origin}${parsed.pathname}${redactedParams}${sigHint}`;
  } catch {
    return "URL invalida";
  }
}

function hasSharedAccessQuery(url: string) {
  try {
    const params = new URL(url).searchParams;
    return Boolean(params.get("sig") || params.get("code"));
  } catch {
    return false;
  }
}

function buildHttpFlowErrorMessage(envKey: string, url: string, response: Response, responseText: string) {
  const bodyPreview = responseText.trim().replace(/\s+/g, " ").slice(0, 220);
  const bodyInfo = bodyPreview ? ` Corpo: ${bodyPreview}` : " Corpo vazio.";
  const endpointInfo = `Endpoint: ${describeFlowUrl(url)}. Variavel: ${envKey}. URL usada: ${describeFlowUrlForDebug(url)}.`;
  const sharedAccessRequired = /Shared Access/i.test(responseText);
  const queryHint = hasSharedAccessQuery(url)
    ? "A URL tem query de acesso; confira se foi copiada depois de salvar/publicar o Flow."
    : "A URL esta sem sig/code. Copie a URL completa do gatilho HTTP, incluindo tudo depois de ?.";

  if (response.status === 401 || response.status === 403) {
    if (sharedAccessRequired) {
      return `Flow exige Shared Access/SAS. HTTP ${response.status} ${response.statusText || ""}. ${endpointInfo} ${queryHint}${bodyInfo}`;
    }
    return `Flow bloqueado antes da execucao. HTTP ${response.status} ${response.statusText || ""}. ${endpointInfo} Verifique URL do gatilho HTTP, query sig/code e politica de autenticacao do Flow.${bodyInfo}`;
  }

  if (response.status === 404) {
    return `Flow nao encontrado. HTTP 404. ${endpointInfo} Provavel URL antiga, Flow recriado, ambiente errado ou caminho quebrado.${bodyInfo}`;
  }

  return `Flow falhou. HTTP ${response.status} ${response.statusText || ""}. ${endpointInfo}${bodyInfo}`;
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
  dataverseError(`${flowName} retornou falha.`, {
    flowName,
    rawStatus,
    message,
    flowResult: describeFlowResultForLog(result)
  });
  throw new Error(message);
}

function bind(entitySetName: string, id: string) {
  return `/${entitySetName}(${cleanGuid(id)})`;
}

type RelationshipMetadataRecord = {
  SchemaName?: string;
  ReferencedEntity?: string;
  ReferencingEntity?: string;
  ReferencingAttribute?: string;
  ReferencingEntityNavigationPropertyName?: string;
};

type RelationshipMetadataResult = {
  value?: RelationshipMetadataRecord[];
};

type LookupNavigationRequest = {
  referencingEntitySetName: string;
  referencedEntitySetName: string;
  referencingAttribute: string;
  label: string;
  required?: boolean;
};

type ExpenseAttachmentLookupNavigationNames = {
  despesa: string;
  enviadoPor: string;
};

type CollisionAttachmentLookupNavigationNames = {
  colisao: string;
  enviadoPor: string;
};

const lookupNavigationNameCache = new Map<string, string>();

function normalizeMetadataName(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function getClientUrl() {
  const clientUrl = getWindowXrm()?.Utility?.getGlobalContext?.().getClientUrl?.();
  if (!clientUrl) throw new Error("URL do Dataverse nao encontrada no runtime Xrm.");
  return clientUrl.replace(/\/$/, "");
}

async function fetchDataverseMetadataJson<T>(path: string): Promise<T> {
  const response = await fetch(encodeURI(`${getClientUrl()}/api/data/v9.2/${path}`), {
    headers: {
      Accept: "application/json",
      "OData-MaxVersion": "4.0",
      "OData-Version": "4.0"
    }
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`GET ${path}\n${response.status} ${response.statusText}\n${text}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

async function fetchManyToOneRelationshipMetadata(referencingEntityName: string) {
  const select = "$select=SchemaName,ReferencedEntity,ReferencingEntity,ReferencingAttribute,ReferencingEntityNavigationPropertyName";
  try {
    const metadata = await fetchDataverseMetadataJson<RelationshipMetadataResult>(
      `EntityDefinitions(LogicalName='${escapeODataText(referencingEntityName)}')/ManyToOneRelationships?${select}`
    );
    return metadata.value ?? [];
  } catch (error) {
    dataverseWarn("Consulta de relacionamentos pela EntityDefinitions falhou. Tentando RelationshipDefinitions.", describeDataverseError(error));
    const metadata = await fetchDataverseMetadataJson<RelationshipMetadataResult>(
      `RelationshipDefinitions/Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata?${select}&$filter=ReferencingEntity eq '${escapeODataText(referencingEntityName)}'`
    );
    return metadata.value ?? [];
  }
}

async function assertEntityHasAttributes(entitySetName: string, label: string, requiredAttributes: string[]) {
  try {
    await retrieveMultiple(entitySetName, `$select=${requiredAttributes.join(",")}&$top=1`);
  } catch (error) {
    throw new Error(
      `Schema de ${label} nao passou na consulta real do Dataverse. Confirme tabela, campos e relacionamentos no ambiente real. Detalhe: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export async function assertExpenseSchemaReadyRemote() {
  await Promise.all([
    assertEntityHasAttributes(DATAVERSE.despesasOperacionais, "Despesas", [
      "cr40f_nome",
      "cr40f_datagasto",
      "cr40f_valor",
      "cr40f_statusoperacional",
      "cr40f_statusfinanceiro",
      "cr40f_statusanexo",
      "cr40f_origem",
      "cr40f_observacao",
      "cr40f_estabelecimento",
      "cr40f_kminformado",
      "cr40f_litros"
    ]),
    assertEntityHasAttributes(DATAVERSE.anexosDespesasOperacionais, "Anexos de Despesas", [
      "cr40f_nome",
      "cr40f_nomearquivo",
      "cr40f_urlsharepoint",
      "cr40f_sharelink",
      "cr40f_dataenvio",
      "cr40f_ordem",
      "cr40f_status",
      "cr40f_tipo"
    ]),
    assertEntityHasAttributes(DATAVERSE.categoriasDespesasOperacionais, "Categorias de Despesas", [
      "cr40f_nome",
      "cr40f_ativa",
      "cr40f_exigeveiculo",
      "cr40f_exigereserva",
      "cr40f_exigekm",
      "cr40f_exigelitros",
      "cr40f_ordem"
    ]),
    assertEntityHasAttributes(DATAVERSE.formasPagamentoDespesas, "Formas de Pagamento", [
      "cr40f_nome",
      "cr40f_ativa",
      "cr40f_tipo",
      "cr40f_ordem"
    ])
  ]);
}

export async function assertCollisionSchemaReadyRemote() {
  await Promise.all([
    assertEntityHasAttributes(DATAVERSE.colisoes, "Colisoes", [
      "cr40f_nome",
      "cr40f_name",
      "cr40f_tipoocorrencia",
      "cr40f_datahora",
      "cr40f_local",
      "cr40f_descricao",
      "cr40f_houveterceiro",
      "cr40f_terceironome",
      "cr40f_terceirotelefone",
      "cr40f_terceiroplaca",
      "cr40f_terceiroveiculo",
      "cr40f_terceirodocumento",
      "cr40f_terceiroseguradora",
      "cr40f_terceiroobservacao",
      "cr40f_statusoperacional",
      "cr40f_statusanexo"
    ]),
    assertEntityHasAttributes(DATAVERSE.anexosColisoes, "Anexos de Colisoes", [
      "cr40f_nome",
      "cr40f_name",
      "cr40f_nomearquivo",
      "cr40f_urlsharepoint",
      "cr40f_sharelink",
      "cr40f_dataenvio",
      "cr40f_ordem",
      "cr40f_status",
      "cr40f_tipo",
      "cr40f_tipomidia"
    ])
  ]);
}

async function resolveLookupNavigationName({
  referencingEntitySetName,
  referencedEntitySetName,
  referencingAttribute,
  label
}: LookupNavigationRequest) {
  const referencingEntityName = getWebApiEntityName(referencingEntitySetName);
  const referencedEntityName = getWebApiEntityName(referencedEntitySetName);
  const cacheKey = `${referencingEntityName}:${referencedEntityName}:${referencingAttribute}`;
  const cached = lookupNavigationNameCache.get(cacheKey);
  if (cached) return cached;

  const relationships = await fetchManyToOneRelationshipMetadata(referencingEntityName);
  const match = relationships.find((relationship) =>
    normalizeMetadataName(relationship.ReferencingAttribute) === normalizeMetadataName(referencingAttribute) &&
    normalizeMetadataName(relationship.ReferencedEntity) === normalizeMetadataName(referencedEntityName)
  );
  const navigationName = String(match?.ReferencingEntityNavigationPropertyName ?? "").trim();
  if (!navigationName) {
    const candidates = relationships
      .filter((relationship) => normalizeMetadataName(relationship.ReferencingAttribute) === normalizeMetadataName(referencingAttribute))
      .map((relationship) => ({
        schemaName: relationship.SchemaName,
        referencedEntity: relationship.ReferencedEntity,
        referencingAttribute: relationship.ReferencingAttribute,
        navigationName: relationship.ReferencingEntityNavigationPropertyName
      }));
    throw new Error(`Navigation property nao encontrado para ${label} (${referencingEntityName}.${referencingAttribute}). Candidatos: ${JSON.stringify(candidates)}`);
  }

  lookupNavigationNameCache.set(cacheKey, navigationName);
  dataverseLog("Navigation property resolvido.", {
    label,
    referencingEntityName,
    referencedEntityName,
    referencingAttribute,
    navigationName,
    schemaName: match?.SchemaName
  });
  return navigationName;
}

export async function loadExpenseLookupNavigationNamesRemote(options: { includeVeiculo?: boolean; includeReserva?: boolean } = {}): Promise<ExpenseLookupNavigationNames> {
  const requests: Array<LookupNavigationRequest & { key: keyof ExpenseLookupNavigationNames }> = [
    {
      key: "motorista",
      referencingEntitySetName: DATAVERSE.despesasOperacionais,
      referencedEntitySetName: DATAVERSE.funcionarios,
      referencingAttribute: "cr40f_motorista",
      label: "Despesa.Motorista",
      required: true
    },
    {
      key: "categoria",
      referencingEntitySetName: DATAVERSE.despesasOperacionais,
      referencedEntitySetName: DATAVERSE.categoriasDespesasOperacionais,
      referencingAttribute: "cr40f_categoria",
      label: "Despesa.Categoria",
      required: true
    },
    {
      key: "formaPagamento",
      referencingEntitySetName: DATAVERSE.despesasOperacionais,
      referencedEntitySetName: DATAVERSE.formasPagamentoDespesas,
      referencingAttribute: "cr40f_formapagamento",
      label: "Despesa.FormaPagamento",
      required: true
    }
  ];

  if (options.includeVeiculo) {
    requests.push({
      key: "veiculo",
        referencingEntitySetName: DATAVERSE.despesasOperacionais,
        referencedEntitySetName: DATAVERSE.veiculos,
        referencingAttribute: "cr40f_veiculo",
      label: "Despesa.Veiculo"
    });
  }
  if (options.includeReserva) {
    requests.push({
      key: "reserva",
        referencingEntitySetName: DATAVERSE.despesasOperacionais,
        referencedEntitySetName: DATAVERSE.geral,
        referencingAttribute: "cr40f_reserva",
        label: "Despesa.Reserva"
    });
  }

  const settled = await Promise.allSettled(requests.map((request) => resolveLookupNavigationName(request)));
  const names: Partial<ExpenseLookupNavigationNames> = {};
  const failures: string[] = [];
  settled.forEach((result, index) => {
    const request = requests[index];
    if (result.status === "fulfilled") {
      names[request.key] = result.value;
      return;
    }
    failures.push(`${request.label}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
  });
  if (failures.length) {
    throw new Error(`Schema de Despesas incompleto. Rode repair-despesas-operacionais-relacionamentos.console.js. Falhas: ${failures.join(" | ")}`);
  }
  if (!names.motorista || !names.categoria || !names.formaPagamento) {
    throw new Error("Schema de Despesas incompleto. Lookups obrigatorios nao resolvidos.");
  }
  return {
    motorista: names.motorista,
    categoria: names.categoria,
    formaPagamento: names.formaPagamento,
    veiculo: names.veiculo,
    reserva: names.reserva
  };
}

export async function loadCollisionLookupNavigationNamesRemote(): Promise<CollisionLookupNavigationNames> {
  const requests: Array<LookupNavigationRequest & { key: keyof CollisionLookupNavigationNames }> = [
    {
      key: "motorista",
      referencingEntitySetName: DATAVERSE.colisoes,
      referencedEntitySetName: DATAVERSE.funcionarios,
      referencingAttribute: "cr40f_motorista",
      label: "Colisao.Motorista",
      required: true
    },
    {
      key: "veiculo",
      referencingEntitySetName: DATAVERSE.colisoes,
      referencedEntitySetName: DATAVERSE.veiculos,
      referencingAttribute: "cr40f_veiculo",
      label: "Colisao.Veiculo",
      required: true
    }
  ];

  const settled = await Promise.allSettled(requests.map((request) => resolveLookupNavigationName(request)));
  const names: Partial<CollisionLookupNavigationNames> = {};
  const failures: string[] = [];
  settled.forEach((result, index) => {
    const request = requests[index];
    if (result.status === "fulfilled") {
      names[request.key] = result.value;
      return;
    }
    failures.push(`${request.label}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
  });
  if (failures.length || !names.motorista || !names.veiculo) {
    throw new Error(`Schema de Colisoes incompleto. Falhas: ${failures.join(" | ")}`);
  }
  return { motorista: names.motorista, veiculo: names.veiculo };
}

async function loadExpenseAttachmentLookupNavigationNamesRemote(): Promise<ExpenseAttachmentLookupNavigationNames> {
  const requests: Array<LookupNavigationRequest & { key: keyof ExpenseAttachmentLookupNavigationNames }> = [
    {
      key: "despesa",
      referencingEntitySetName: DATAVERSE.anexosDespesasOperacionais,
      referencedEntitySetName: DATAVERSE.despesasOperacionais,
      referencingAttribute: "cr40f_despesa",
      label: "AnexoDespesa.Despesa"
    },
    {
      key: "enviadoPor",
      referencingEntitySetName: DATAVERSE.anexosDespesasOperacionais,
      referencedEntitySetName: DATAVERSE.funcionarios,
      referencingAttribute: "cr40f_enviadopor",
      label: "AnexoDespesa.EnviadoPor"
    }
  ];

  const settled = await Promise.allSettled(requests.map((request) => resolveLookupNavigationName(request)));
  const names: Partial<ExpenseAttachmentLookupNavigationNames> = {};
  const failures: string[] = [];
  settled.forEach((result, index) => {
    const request = requests[index];
    if (result.status === "fulfilled") {
      names[request.key] = result.value;
      return;
    }
    failures.push(`${request.label}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
  });
  if (failures.length || !names.despesa || !names.enviadoPor) {
    throw new Error(`Schema de Anexos de Despesas incompleto. Rode repair-despesas-operacionais-relacionamentos.console.js. Falhas: ${failures.join(" | ")}`);
  }
  return { despesa: names.despesa, enviadoPor: names.enviadoPor };
}

async function loadCollisionAttachmentLookupNavigationNamesRemote(): Promise<CollisionAttachmentLookupNavigationNames> {
  const requests: Array<LookupNavigationRequest & { key: keyof CollisionAttachmentLookupNavigationNames }> = [
    {
      key: "colisao",
      referencingEntitySetName: DATAVERSE.anexosColisoes,
      referencedEntitySetName: DATAVERSE.colisoes,
      referencingAttribute: "cr40f_colisao",
      label: "AnexoColisao.Colisao"
    },
    {
      key: "enviadoPor",
      referencingEntitySetName: DATAVERSE.anexosColisoes,
      referencedEntitySetName: DATAVERSE.funcionarios,
      referencingAttribute: "cr40f_enviadopor",
      label: "AnexoColisao.EnviadoPor"
    }
  ];

  const settled = await Promise.allSettled(requests.map((request) => resolveLookupNavigationName(request)));
  const names: Partial<CollisionAttachmentLookupNavigationNames> = {};
  const failures: string[] = [];
  settled.forEach((result, index) => {
    const request = requests[index];
    if (result.status === "fulfilled") {
      names[request.key] = result.value;
      return;
    }
    failures.push(`${request.label}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
  });
  if (failures.length || !names.colisao || !names.enviadoPor) {
    throw new Error(`Schema de Anexos de Colisoes incompleto. Falhas: ${failures.join(" | ")}`);
  }
  return { colisao: names.colisao, enviadoPor: names.enviadoPor };
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
        ? `<a href="https://wa.me/${phone}?text=${encodeURIComponent(message)}" target="_blank" rel="noopener noreferrer">${phoneText}</a>`
        : `<span style="color:#8a8a8a">${phoneText}</span>`;
      return `<span>${escapeHtml(name)}${name && phoneRaw ? " - " : ""}${phoneHtml}</span>`;
    })
  );

  return passengers.filter(Boolean).join("<br>");
}

function buildFields(record: DataverseRecord, passengerHtml = ""): DetailField[] {
  const date = toDate(record.cr40f_dataehorriodesada);
  return [
    { label: "Data e Horário de Saída", value: date ? date.toLocaleString("pt-BR") : "" },
    { label: "Cliente", value: getLookupName(record, "cr40f_cliente") || getFormatted(record, "cr40f_cliente") },
    { label: "Receber", value: getFormatted(record, "cr40f_receber") },
    { label: "Trajeto", value: String(record.cr40f_trajeto ?? "") },
    { label: "Passageiros e Telefones de Contato", value: passengerHtml || String(record.cr40f_passageirosetelefonedecontato ?? ""), html: true },
    { label: "Endereço de Saída", value: String(record.cr40f_endereodesada ?? "") },
    { label: "Destino", value: String(record.cr40f_destino ?? "") },
    { label: "Obs de Operação", value: String(record.cr40f_obsdeoperao ?? "") },
    { label: "Perfil do Passageiro", value: String(record.cr40f_perfildopassageiro ?? "") },
    { label: "Solicitante", value: getLookupName(record, "cr40f_solicitante") },
    { label: "Veículo", value: getLookupName(record, "cr40f_veiculo") }
  ].filter((field) => field.value);
}

function serviceActions(record: DataverseRecord): DetailAction[] {
  const cliente = getLookupName(record, "cr40f_cliente");
  return /tenn?aris/i.test(cliente) ? ["cancel", "voucher"] : ["cancel", "finalizar"];
}

function mapGeralService(record: DataverseRecord, passengerHtml = ""): AgendaItem {
  const date = toDate(record.cr40f_dataehorriodesada);
  const id = getGeralId(record);
  const businessId = getBusinessId(record, id);
  const trajectory = String(record.cr40f_trajeto ?? record.cr40f_id ?? "Serviço");
  const minutesUntilStart = date ? (date.getTime() - Date.now()) / 60000 : Number.POSITIVE_INFINITY;
  const viewedAt = toDate(record.new_visualizacaodomotorista);
  const modifiedAt = toDate(record.modifiedon);
  const wasEditedAfterView = viewedAt && modifiedAt ? (modifiedAt.getTime() - viewedAt.getTime()) / 1000 > 10 : !viewedAt;
  const isReceber = normalizeText(getFormatted(record, "cr40f_receber")) === "sim";
  const detail: DetailData = {
    type: "SERVICO",
    id: businessId,
    title: "Detalhes do Serviço",
    actions: serviceActions(record),
    fields: buildFields(record, passengerHtml),
    dataverse: { entitySetName: DATAVERSE.geral, id, record }
  };

  return {
    id: `srv-${id}`,
    tipo: "SERVICO",
    label: "Serviço",
    time: formatAgendaTime(date),
    description: trajectory,
    priority: isReceber ? 10 : minutesUntilStart >= 0 && minutesUntilStart <= 30 && wasEditedAfterView ? 1 : wasEditedAfterView ? 3 : 0,
    searchText: `${businessId} ${id} ${trajectory}`.toLowerCase(),
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
    { label: "Data e Horário de Saída", value: date ? date.toLocaleString("pt-BR") : "" },
    { label: "ID Manutenção", value: String(maintenance.cr40f_id ?? "") },
    { label: "Veículo", value: getLookupName(maintenance, "cr40f_placa_carro") || getLookupName(geral, "cr40f_veiculo") },
    { label: "Descrição", value: String(maintenance.cr40f_descricao ?? "") },
    { label: "Grau da Manutenção", value: getFormatted(maintenance, "cr40f_graudamanutencao") },
    { label: "Tipo do Reparo", value: getFormatted(maintenance, "cr40f_tipodoreparo") },
    { label: "Comentários ao Motorista", value: String(maintenance.cr40f_comentariosaomotorista ?? "") },
    { label: "Obs de Operação", value: String(geral.cr40f_obsdeoperao ?? "") },
    { label: "Link Foto Solicitação 1", value: String(maintenance.cr40f_foto01 ?? "") },
    { label: "Link Foto Solicitação 2", value: String(maintenance.cr40f_linkdaevidencia ?? "") },
    { label: "Link Foto Solicitação 3", value: String(maintenance.cr40f_foto03 ?? "") },
    { label: "Link Nota Fiscal", value: String(maintenance.new_linkdanotafiscal ?? "") },
    { label: "Link Foto Final 1", value: String(maintenance.new_linkdafotofinal1 ?? "") },
    { label: "Link Foto Final 2", value: String(maintenance.new_linkdafotofinal2 ?? "") },
    { label: "Link Foto Final 3", value: String(maintenance.new_linkdafotofinal3 ?? "") }
  ].filter((field) => field.value);
}

function mapMaintenance(geral: DataverseRecord, maintenance: DataverseRecord): AgendaItem {
  const date = toDate(geral.cr40f_dataehorriodesada);
  const geralId = getGeralId(geral);
  const maintenanceId = getRecordId(maintenance, "cr40f_manutencoesid");
  const businessId = getBusinessId(maintenance, maintenanceId || geralId);
  const description = String(maintenance.cr40f_descricao ?? geral.cr40f_trajeto ?? "Manutenção");
  const detail: DetailData = {
    type: "MANUTENCAO",
    id: businessId,
    title: "Detalhes da Manutenção",
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
    label: "Manutenção",
    time: formatAgendaTime(date),
    description,
    priority: 0,
    searchText: `${businessId} ${maintenanceId} ${geralId} ${description} ${getLookupName(maintenance, "cr40f_placa_carro")}`.toLowerCase(),
    detail
  };
}

function buildExchangeFields(exchange: DataverseRecord, geral?: DataverseRecord): DetailField[] {
  const start = toDate(exchange.cr40f_iniciodajaneladetroca);
  const end = toDate(exchange.cr40f_fimdajaneladetroca);
  return [
    { label: "Início da Janela", value: start ? start.toLocaleString("pt-BR") : "" },
    { label: "Fim da Janela", value: end ? end.toLocaleString("pt-BR") : "" },
    { label: "Motorista 1", value: getLookupName(exchange, "cr40f_motorista1") },
    { label: "Motorista 2", value: getLookupName(exchange, "cr40f_motorista2") },
    { label: "Veículo 1 Antes da Troca", value: getLookupName(exchange, "cr40f_veiculo1antesdatroca") },
    { label: "Veículo 2 Antes da Troca", value: getLookupName(exchange, "cr40f_veiculo2antesdatroca") },
    { label: "Tipo de Troca", value: getFormatted(exchange, "new_tipodetroca") },
    { label: "Observação", value: String(exchange.cr40f_observacao ?? "") },
    { label: "Obs de Operação", value: String(geral?.cr40f_obsdeoperao ?? "") }
  ].filter((field) => field.value);
}

function mapExchange(exchange: DataverseRecord, geral: DataverseRecord | undefined): AgendaItem {
  const start = toDate(exchange.cr40f_iniciodajaneladetroca);
  const exchangeId = getRecordId(exchange, "cr40f_trocasdecarroid");
  const businessId = getBusinessId(exchange, exchangeId);
  const geralId = geral ? getGeralId(geral) : "";
  const description =
    `${getLookupName(exchange, "cr40f_veiculo1antesdatroca")} <> ${getLookupName(exchange, "cr40f_veiculo2antesdatroca")}`.trim() ||
    String(exchange.cr40f_id ?? "Troca de Carro");
  const detail: DetailData = {
    type: "TROCA",
    id: businessId,
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
    searchText: `${businessId} ${exchangeId} ${description} ${getLookupName(exchange, "cr40f_motorista1")} ${getLookupName(exchange, "cr40f_motorista2")}`.toLowerCase(),
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
      result.push({ id: `h-${date}-${result.length}`, tipo: "HEADER", tituloData: date, seta: "" });
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
      result.push({ id: `hh-${date}-${result.length}`, tipo: "HEADER", tituloData: date, seta: "" });
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
      `$filter=cr40f_dataehorriodesada ge ${start} and cr40f_dataehorriodesada le ${end} and _cr40f_motorista_value eq ${driver.id} and new_foiprogramado eq true and new_categoriadoitem eq ${CATEGORY.servico} and cr40f_status ne ${OPERATION_STATUS.concluido} and cr40f_status ne ${OPERATION_STATUS.requerAnalise} and _cr40f_om_value eq null and _cr40f_ot_value eq null`,
      "$orderby=cr40f_dataehorriodesada asc",
      "$top=80"
    ].join("&")
  );

  const maintenanceGeralResult = await retrieveMultiple(
    DATAVERSE.geral,
    [
      geralSelect,
      `$filter=cr40f_dataehorriodesada ge ${start} and cr40f_dataehorriodesada le ${end} and _cr40f_motorista_value eq ${driver.id} and new_foiprogramado eq true and new_categoriadoitem eq ${CATEGORY.manutencao} and cr40f_status ne ${OPERATION_STATUS.concluido} and _cr40f_om_value ne null and _cr40f_ot_value eq null`,
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
      `$filter=new_foiprogramado eq true and new_categoriadoitem eq ${CATEGORY.troca} and _cr40f_ot_value ne null`,
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

async function getDataverseEnvironmentVariableValue(schemaName: string) {
  if (flowUrlCache.has(schemaName)) return flowUrlCache.get(schemaName) ?? "";

  const definitionResult = await retrieveMultiple(
    "environmentvariabledefinitions",
    [
      "$select=environmentvariabledefinitionid,schemaname,defaultvalue",
      `$filter=schemaname eq '${escapeODataText(schemaName)}'`,
      "$top=1"
    ].join("&")
  );
  const definition = definitionResult.entities[0];
  if (!definition?.environmentvariabledefinitionid) {
    throw new Error(`Variavel de ambiente Dataverse nao encontrada: ${schemaName}`);
  }

  const valueResult = await retrieveMultiple(
    "environmentvariablevalues",
    [
      "$select=value",
      `$filter=_environmentvariabledefinitionid_value eq ${cleanGuid(definition.environmentvariabledefinitionid)}`,
      "$top=1"
    ].join("&")
  );
  const url = String(valueResult.entities[0]?.value ?? definition.defaultvalue ?? "").trim();
  flowUrlCache.set(schemaName, url);
  return url;
}

async function resolveFlowUrl(envKey: string) {
  const dataverseSchemaName = FLOW_DATAVERSE_ENVIRONMENT_VARIABLES[envKey];
  if (dataverseSchemaName && hasDataverseRuntime()) {
    try {
      const dataverseUrl = await getDataverseEnvironmentVariableValue(dataverseSchemaName);
      if (dataverseUrl) return dataverseUrl;
      dataverseWarn("Variavel de ambiente Dataverse vazia.", { envKey, dataverseSchemaName });
    } catch (error) {
      dataverseWarn("Falha ao ler variavel de ambiente Dataverse. Usando fallback local.", {
        envKey,
        dataverseSchemaName,
        error: describeDataverseError(error)
      });
    }
  }

  const flowEnv = ((window as WindowWithFlowEnv).__APP_FLOW_ENV ?? {}) as AppResourceFlowEnv;
  return flowEnv[envKey] ?? "";
}

async function runHttpFlow(envKey: string, payload: Record<string, unknown>) {
  const url = await resolveFlowUrl(envKey);
  if (!url) throw new Error(`URL do Flow nao configurada: ${envKey}. Configure a variavel Dataverse ou window.__APP_FLOW_ENV.`);
  const startedAt = performance.now();
  dataverseLog("Flow HTTP iniciado.", { envKey, payloadFields: Object.keys(payload) });
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    dataverseError("Flow HTTP nao recebeu resposta.", {
      envKey,
      endpoint: describeFlowUrl(url),
      urlUsada: describeFlowUrlForDebug(url),
      durationMs: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.message : String(error)
    });
    throw new Error(`Flow sem resposta. Variavel: ${envKey}. Endpoint: ${describeFlowUrl(url)}. URL usada: ${describeFlowUrlForDebug(url)}. Verifique CORS, rede, URL do gatilho HTTP e se a query sig/code esta completa.`);
  }
  const responseText = await response.text();
  if (!response.ok) {
    dataverseError("Flow HTTP falhou.", {
      envKey,
      endpoint: describeFlowUrl(url),
      urlUsada: describeFlowUrlForDebug(url),
      status: response.status,
      statusText: response.statusText,
      durationMs: Math.round(performance.now() - startedAt),
      payloadResumo: summarizeFlowPayload(payload),
      responseText
    });
    throw new Error(buildHttpFlowErrorMessage(envKey, url, response, responseText));
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

function summarizeFlowPayload(payload: Record<string, unknown>) {
  const content = typeof payload.conteudoBase64 === "string" ? payload.conteudoBase64 : "";
  return {
    caminhoCompleto: payload.caminhoCompleto ?? "",
    nomeArquivo: payload.nomeArquivo ?? "",
    mimeType: payload.mimeType ?? "",
    base64Chars: content.length,
    approxBytes: content ? Math.round((content.length * 3) / 4) : 0,
    metadados: payload.metadados ?? {}
  };
}

export async function saveVoucherRemote(payload: FinalizePayload) {
  const dv = payload.detail.dataverse;
  if (!dv?.id) throw new Error("Serviço sem referência Dataverse.");
  const record = dv.record ?? {};
  dataverseLog("Finalizacao por voucher iniciada.", { detailId: payload.detail.id, dataverseId: dv.id });
  payload.onProgress?.("Preparando dados do voucher.");
  payload.onProgress?.("Enviando voucher para o Flow.");
  const flowResult = await runHttpFlow(FLOW_URLS.gerarVoucher, {
    text: record.cr40f_reservadeveculosid ?? dv.id,
    text_1: dataUrlToBase64(payload.signatureDataUrl ?? ""),
    text_2: payload.fields.Desvio === "Não" ? "Nao" : payload.fields.Desvio ?? "Nao",
    text_5: getFieldValue(payload.fields, "Horário Inicial", "Horario Inicial"),
    text_6: getFieldValue(payload.fields, "Espera Início", "Espera Inicio"),
    text_7: getFieldValue(payload.fields, "Espera Final"),
    text_8: formatFlowDecimal(getFieldValue(payload.fields, "Pedágio", "Pedagio") || "0"),
    text_9: formatFlowDecimal(getFieldValue(payload.fields, "Estacionamento") || "0"),
    text_10: formatFlowDecimal(getFieldValue(payload.fields, "Combustível", "Combustivel") || "0"),
    text_11: formatFlowDecimal(getFieldValue(payload.fields, "Hospedagem") || "0"),
    text_12: formatFlowDecimal(getFieldValue(payload.fields, "Outros") || "0"),
    text_13: getFieldValue(payload.fields, "Observação Voucher", "Observacao Voucher"),
    text_14: getFieldValue(payload.fields, "Horário Final", "Horario Final"),
    text_15: new Date().toISOString()
  });
  payload.onProgress?.("Validando retorno do Flow.");
  assertFlowSuccess(flowResult, "FlowGerarVoucher");
  payload.onProgress?.("Atualizando status no Dataverse.");
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
  const [horaSaida = "", minSaida = ""] = String(getFieldValue(fields, "Horário Inicial", "Horario Inicial")).split(":");
  const [esperaIniHora = "", esperaIniMin = ""] = String(getFieldValue(fields, "Espera Início", "Espera Inicio")).split(":");
  const [esperaFimHora = "", esperaFimMin = ""] = String(getFieldValue(fields, "Espera Final")).split(":");
  const draft = {
    hora_saida: horaSaida,
    min_saida: minSaida,
    espera_ini_hora: esperaIniHora,
    espera_ini_min: esperaIniMin,
    espera_fim_hora: esperaFimHora,
    espera_fim_min: esperaFimMin,
    desvio: getFieldValue(fields, "Desvio") || "Não",
    obs: getFieldValue(fields, "Observação Voucher", "Observacao Voucher"),
    pedagio: getFieldValue(fields, "Pedágio", "Pedagio"),
    estacionamento: getFieldValue(fields, "Estacionamento"),
    combustivel: getFieldValue(fields, "Combustível", "Combustivel"),
    hospedagem: getFieldValue(fields, "Hospedagem"),
    outros: getFieldValue(fields, "Outros")
  };
  dataverseLog("Salvando rascunho voucher.", { detailId: detail.id, dataverseId: dv.id });
  await updateOne(DATAVERSE.geral, dv.id, {
    new_rascunhovoucher: JSON.stringify(draft)
  });
}

export async function finalizeServiceRemote(payload: FinalizePayload) {
  const dv = payload.detail.dataverse;
  if (!dv?.id) throw new Error("Serviço sem referência Dataverse.");
  dataverseLog("Finalização simples de serviço iniciada.", { detailId: payload.detail.id, dataverseId: dv.id });
  payload.onProgress?.("Atualizando serviço no Dataverse.");
  await updateOne(DATAVERSE.geral, dv.id, {
    new_observacaofinal: getFieldValue(payload.fields, "Observação Final", "Observacao Final"),
    cr40f_status: OPERATION_STATUS.concluido,
    new_datadefinalizacao: new Date().toISOString()
  });
}

export async function cancelServiceRemote(detail: DetailData, reason: string) {
  const dv = detail.dataverse;
  if (!dv?.id) throw new Error("Serviço sem referência Dataverse.");
  const record = dv.record ?? {};
  const geralId = detail.type === "SERVICO" ? dv.id : cleanODataGuid(record.__geralId);
  if (!geralId) throw new Error("Registro Geral vinculado não encontrado para cancelamento.");
  dataverseLog("Cancelamento/finalização local remota iniciado.", {
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
  if (!dv?.id) throw new Error("Manutenção sem referência Dataverse.");
  const record = dv.record ?? {};
  const geralId = cleanODataGuid(record.__geralId);
  const paymentKey = normalizeText(getFieldValue(payload.fields, "Forma de Pagamento"));
  const paymentValue = MAINTENANCE_PAYMENT[paymentKey];
  dataverseLog("Finalização de manutenção iniciada.", {
    detailId: payload.detail.id,
    dataverseId: dv.id,
    photoKinds: Object.keys(payload.photos ?? {})
  });
  const maintenancePatch: Record<string, unknown> = {
    cr40f_datamanutencao: new Date().toISOString(),
    cr40f_estabelecimento: getFieldValue(payload.fields, "Estabelecimento"),
    cr40f_valor: parseCurrencyNumber(getFieldValue(payload.fields, "Valor") || "0"),
    new_comentariosdocolaborador: getFieldValue(payload.fields, "Comentários do Motorista", "Comentarios do Motorista"),
    cr40f_servicorealizado: getFieldValue(payload.fields, "Serviço Realizado", "Servico Realizado")
  };
  if (paymentValue !== undefined) maintenancePatch.cr40f_pagamento = paymentValue;
  const motoristaId = cleanODataGuid((record.__geral as DataverseRecord | undefined)?._cr40f_motorista_value);
  if (motoristaId) maintenancePatch["cr40f_Realizado_por_nome@odata.bind"] = bind(DATAVERSE.funcionarios, motoristaId);

  payload.onProgress?.("Salvando dados da manutenção.");
  await updateOne(DATAVERSE.manutencoes, dv.id, maintenancePatch);
  const photoPatch: Record<string, unknown> = {};
  const photos = payload.photos ?? {};
  const invoiceEntries = Object.entries(photos)
    .filter(([kind, dataUrl]) => kind.startsWith("NOTAFISCAL") && Boolean(dataUrl))
    .sort(([left], [right]) => {
      const leftIndex = left === "NOTAFISCAL" ? 1 : Number(left.replace("NOTAFISCAL_", ""));
      const rightIndex = right === "NOTAFISCAL" ? 1 : Number(right.replace("NOTAFISCAL_", ""));
      return leftIndex - rightIndex;
    })
    .map(([kind], index) => ({
      kind: kind as MaintenancePhotoKind,
      fileName: `nota-fiscal-${index + 1}`,
      targetField: "new_linkdanotafiscal"
    }));
  const photoEntries = [
    ...invoiceEntries,
    { kind: "FOTO1", fileName: "foto-1", targetField: "new_linkdafotofinal1" },
    { kind: "FOTO2", fileName: "foto-2", targetField: "new_linkdafotofinal2" },
    { kind: "FOTO3", fileName: "foto-3", targetField: "new_linkdafotofinal3" }
  ] as const;
  const photoFolderPath = await buildMaintenancePhotoFolder(record);

  const uploadEntries = photoEntries.filter((entry) => Boolean(photos[entry.kind]));
  if (uploadEntries.length) payload.onProgress?.(`Enviando ${uploadEntries.length} arquivo(s) em paralelo.`);
  let completedMaintenanceUploads = 0;
  const uploadResults = await Promise.allSettled(uploadEntries.map(async (entry) => ({
    targetField: entry.targetField,
    kind: entry.kind,
    fileName: entry.fileName,
    link: await uploadMaintenancePhoto(photoFolderPath, photos[entry.kind] ?? "", entry.fileName, {
      manutencaoId: record.cr40f_id ?? "",
      manutencaoGuid: dv.id,
      geralId,
      tipoFoto: entry.kind
    }).then((link) => {
      completedMaintenanceUploads += 1;
      payload.onProgress?.(`Uploads paralelos concluídos (${completedMaintenanceUploads}/${uploadEntries.length}).`);
      return link;
    })
  })));
  const uploadedLinks = uploadResults.flatMap((uploadResult) => uploadResult.status === "fulfilled" ? [uploadResult.value] : []);
  const failedUploads = uploadResults.length - uploadedLinks.length;

  const linksByField = uploadedLinks.reduce<Record<string, string[]>>((current, item) => {
    if (!item.link) return current;
    current[item.targetField] = [...(current[item.targetField] ?? []), item.link];
    return current;
  }, {});
  Object.entries(linksByField).forEach(([field, links]) => {
    photoPatch[field] = links.join("\n");
  });

  if (uploadedLinks.length) {
    await Promise.all(uploadedLinks.map((item, index) => createMaintenancePhotoLinkRecord({
      maintenanceId: dv.id,
      maintenanceBusinessId: String(record.cr40f_id ?? ""),
      origin: item.kind.startsWith("NOTAFISCAL") ? "NOTA_FISCAL" : "POS_MANUTENCAO",
      photoType: item.kind,
      link: item.link,
      path: photoFolderPath,
      fileName: item.fileName,
      order: index + 1
    })));
  }

  if (failedUploads) {
    if (Object.keys(photoPatch).length) {
      payload.onProgress?.("Gravando links enviados no Dataverse.");
      await updateOne(DATAVERSE.manutencoes, dv.id, photoPatch);
    }
    throw new Error(`Manutenção salva, mas ${failedUploads} de ${uploadEntries.length} arquivo(s) falharam no upload.`);
  }

  photoPatch.cr40f_status = MAINTENANCE_STATUS.realizado;
  payload.onProgress?.("Gravando links das fotos no Dataverse.");
  await updateOne(DATAVERSE.manutencoes, dv.id, photoPatch);
  if (geralId) {
    payload.onProgress?.("Concluindo item da agenda.");
    await updateOne(DATAVERSE.geral, geralId, {
      new_observacaofinal: getFieldValue(payload.fields, "Comentários do Motorista", "Comentarios do Motorista", "Observações", "Observacoes"),
      cr40f_status: OPERATION_STATUS.concluido,
      new_datadefinalizacao: new Date().toISOString()
    });
  }
}

export async function finalizeExchangeRemote(payload: FinalizePayload) {
  const dv = payload.detail.dataverse;
  if (!dv?.id) throw new Error("Troca sem referência Dataverse.");
  const driver = await getDriverContext();
  const record = dv.record ?? {};
  const isDriver1 = cleanODataGuid(record._cr40f_motorista1_value) === cleanGuid(driver.id);
  const isDriver2 = cleanODataGuid(record._cr40f_motorista2_value) === cleanGuid(driver.id);
  if (!isDriver1 && !isDriver2) throw new Error("Motorista atual não pertence a esta troca.");

  const observation = getFieldValue(payload.fields, "Observações", "Observacoes", "Observação da Troca", "Observacao da Troca") || "Sem observação.";
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

  dataverseLog("Finalização de troca iniciada.", {
    detailId: payload.detail.id,
    dataverseId: dv.id,
    isDriver1,
    isDriver2,
    closesExchange: driver1Done && driver2Done
  });

  payload.onProgress?.("Atualizando troca no Dataverse.");
  await updateOne(DATAVERSE.trocas, dv.id, exchangePatch);

  const geralId = cleanODataGuid(record.__geralId);
  if (geralId && driver1Done && driver2Done) {
    payload.onProgress?.("Atualizando posse dos veículos.");
    await applyExchangePossessionRemote(record, dv.id);
    payload.onProgress?.("Concluindo item da agenda.");
    await updateOne(DATAVERSE.geral, geralId, {
      new_observacaofinal: observation,
      cr40f_status: OPERATION_STATUS.concluido,
      new_datadefinalizacao: new Date().toISOString()
    });
  }
}



