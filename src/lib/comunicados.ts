import { createOne, DATAVERSE, deleteOne, retrieveMultiple, updateOne } from "./dataverse.ts";

export const COMUNICADO_TIPO = { informativo: 100000000, ciencia: 100000001 } as const;
export const COMUNICADO_ESCOPO = { todos: 100000000, selecionados: 100000001 } as const;
export const COMUNICADO_ESTADO = { rascunho: 100000000, disparado: 100000001 } as const;
export const COMUNICADO_PUSH = { pendente: 100000000, enviado: 100000001, falhou: 100000002 } as const;

export type ComunicadoTipo = (typeof COMUNICADO_TIPO)[keyof typeof COMUNICADO_TIPO];
export type ComunicadoEscopo = (typeof COMUNICADO_ESCOPO)[keyof typeof COMUNICADO_ESCOPO];

export type Comunicado = {
  id: string;
  titulo: string;
  corpo: string;
  tipo: ComunicadoTipo;
  escopo: ComunicadoEscopo;
  alvoIds: string[];
  estado: number;
  disparadoEm: string | null;
};

export type ComunicadoDestinatario = {
  id: string;
  comunicadoId: string;
  motoristaId: string;
  titulo: string;
  corpo: string;
  tipo: ComunicadoTipo;
  enviadoEm: string;
  abertoEm: string | null;
  lidoEm: string | null;
  cienteEm: string | null;
  nomeAssinante: string;
  observacao: string;
  assinaturaJson: string;
  pushStatus: number;
  pushErro: string;
};

export type SignaturePoint = [number, number];
export type SignatureStrokes = SignaturePoint[][];

const LOCAL_DRIVER_ID = "11111111-1111-4111-8111-111111111111";
export const isMockComunicados = () => ["localhost", "127.0.0.1"].includes(window.location?.hostname ?? "");

// Arquivo canônico: a Tela Gestão de Comunicados copia este módulo via scripts/sync-shared.cjs.
// A Gestão serve o mock na mesma origem e chama configureComunicadosMock("/api/mock").
let mockApiBase = "";
export function configureComunicadosMock(base: string) {
  mockApiBase = base.replace(/\/$/, "");
}

// Sem servidor indicado (configureComunicadosMock ou ?mockApiPort=), o mock roda em memória no navegador.
// Mesmo contrato de scripts/mock-api.cjs da Gestão; ?mockApiPort= compartilha os dados com a Gestão.
type MockDriver = { id: string; nome: string; email: string; userId: string; problema: string };
const MOCK_DRIVERS: MockDriver[] = [
  { id: LOCAL_DRIVER_ID, nome: "Renan", email: "renan@betinhos.mock", userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", problema: "" },
  { id: "22222222-2222-4222-8222-222222222222", nome: "Motorista de teste", email: "motorista@betinhos.mock", userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", problema: "" }
];
let localMock: { comunicados: Comunicado[]; recipients: ComunicadoDestinatario[] } | null = null;

function mockId() {
  return globalThis.crypto?.randomUUID?.() ?? "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}

function mockRecipient(item: Comunicado, motoristaId: string, enviadoEm: string): ComunicadoDestinatario {
  return {
    id: mockId(), comunicadoId: item.id, motoristaId, titulo: item.titulo, corpo: item.corpo, tipo: item.tipo, enviadoEm,
    abertoEm: null, lidoEm: null, cienteEm: null, nomeAssinante: "", observacao: "", assinaturaJson: "", pushStatus: COMUNICADO_PUSH.enviado, pushErro: ""
  };
}

function getLocalMock() {
  if (localMock) return localMock;
  const seededAt = new Date().toISOString();
  const seeds: Pick<Comunicado, "id" | "titulo" | "corpo" | "tipo">[] = [
    { id: "33333333-3333-4333-8333-333333333333", titulo: "[Mock] Aviso operacional", corpo: "Este aviso serve para testar a leitura no aplicativo.", tipo: COMUNICADO_TIPO.informativo },
    { id: "44444444-4444-4444-8444-444444444444", titulo: "[Mock] Ciência obrigatória", corpo: "Este comunicado serve para testar observação e assinatura.", tipo: COMUNICADO_TIPO.ciencia }
  ];
  const comunicados: Comunicado[] = seeds.map((item) => ({ ...item, escopo: COMUNICADO_ESCOPO.todos, alvoIds: [], estado: COMUNICADO_ESTADO.disparado, disparadoEm: seededAt }));
  localMock = { comunicados, recipients: comunicados.flatMap((item) => MOCK_DRIVERS.map((driver) => mockRecipient(item, driver.id, seededAt))) };
  return localMock;
}

function localMockRequest(path: string, data: unknown, method: string): unknown {
  const store = getLocalMock();
  const url = new URL(path, "http://mock.local");
  const parts = url.pathname.split("/").filter(Boolean);
  const now = new Date().toISOString();
  const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
  if (method === "GET" && parts[0] === "drivers") return clone(MOCK_DRIVERS);
  if (method === "GET" && parts[0] === "comunicados") return clone(store.comunicados.slice().reverse());
  if (method === "GET" && parts[0] === "recipients") {
    const driverId = url.searchParams.get("driverId");
    const comunicadoId = url.searchParams.get("comunicadoId");
    return clone(store.recipients.filter((row) => (!driverId || row.motoristaId === driverId) && (!comunicadoId || row.comunicadoId === comunicadoId)).reverse());
  }
  if (parts[0] === "comunicados" && parts.length === 1 && method === "POST") {
    const draft = data as Comunicado;
    const existing = store.comunicados.find((item) => item.id === draft.id);
    if (existing?.estado === COMUNICADO_ESTADO.disparado) throw new Error("Comunicado disparado não pode ser editado.");
    const item: Comunicado = { ...clone(draft), id: existing?.id || mockId(), estado: COMUNICADO_ESTADO.rascunho, disparadoEm: null };
    if (existing) Object.assign(existing, item); else store.comunicados.push(item);
    return clone(item);
  }
  if (parts[0] === "comunicados" && parts.length === 2 && method === "DELETE") {
    store.comunicados = store.comunicados.filter((item) => !(item.id === parts[1] && item.estado === COMUNICADO_ESTADO.rascunho));
    return {};
  }
  if (parts[0] === "comunicados" && parts[2] === "dispatch") {
    const item = store.comunicados.find((row) => row.id === parts[1]);
    if (!item) throw new Error("Comunicado não encontrado.");
    if (item.estado === COMUNICADO_ESTADO.disparado) throw new Error("Comunicado já disparado.");
    const targets = item.escopo === COMUNICADO_ESCOPO.todos ? MOCK_DRIVERS : MOCK_DRIVERS.filter((driver) => item.alvoIds.includes(driver.id));
    if (!targets.length) throw new Error("Nenhum motorista selecionado.");
    item.estado = COMUNICADO_ESTADO.disparado;
    item.disparadoEm = now;
    store.recipients.push(...targets.map((driver) => mockRecipient(item, driver.id, now)));
    return clone(item);
  }
  if (parts[0] === "recipients" && parts.length === 3) {
    const row = store.recipients.find((item) => item.id === parts[1]);
    if (!row) throw new Error("Destinatário não encontrado.");
    if (parts[2] === "open") {
      row.abertoEm ||= now;
      if (row.tipo === COMUNICADO_TIPO.informativo) row.lidoEm ||= now;
    } else if (parts[2] === "sign") {
      if (row.tipo !== COMUNICADO_TIPO.ciencia) throw new Error("Este comunicado não exige assinatura.");
      const { strokes, observacao } = (data ?? {}) as { strokes?: SignatureStrokes; observacao?: string };
      row.abertoEm ||= now;
      row.cienteEm ||= now;
      row.nomeAssinante = MOCK_DRIVERS.find((driver) => driver.id === row.motoristaId)?.nome || "Motorista";
      row.observacao = String(observacao || "");
      row.assinaturaJson = JSON.stringify(strokes || []);
    } else if (parts[2] === "retry") {
      row.pushStatus = COMUNICADO_PUSH.enviado;
      row.pushErro = "";
    } else throw new Error("Ação desconhecida.");
    return clone(row);
  }
  throw new Error("Rota mock desconhecida.");
}

async function mockRequest<T>(path: string, data?: unknown, method = data === undefined ? "GET" : "POST"): Promise<T> {
  const port = new URLSearchParams(window.location.search).get("mockApiPort");
  if (!mockApiBase && !port) return localMockRequest(path, data, method) as T;
  const base = mockApiBase || `http://127.0.0.1:${port}/api/mock`;
  const response = await fetch(`${base}${path}`, method === "GET" ? undefined : {
    method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data ?? {})
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Mock HTTP ${response.status}`);
  return result as T;
}

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function cleanGuid(value: string) {
  return value.replace(/[{}]/g, "").toLowerCase();
}

export function parseTargetIds(value: unknown): string[] {
  try {
    const parsed: unknown = JSON.parse(String(value || "[]"));
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.map((id) => cleanGuid(String(id))).filter((id) => GUID_PATTERN.test(id)))];
  } catch {
    return [];
  }
}

export function validateDraft(draft: Pick<Comunicado, "titulo" | "corpo" | "escopo" | "alvoIds">) {
  if (!draft.titulo.trim() || draft.titulo.trim().length > 150) return "Informe um título de até 150 caracteres.";
  if (!draft.corpo.trim() || draft.corpo.trim().length > 4000) return "Informe uma mensagem de até 4.000 caracteres.";
  if (draft.escopo === COMUNICADO_ESCOPO.selecionados && draft.alvoIds.length === 0) return "Selecione pelo menos um motorista.";
  if (draft.alvoIds.some((id) => !GUID_PATTERN.test(cleanGuid(id)))) return "Há um motorista inválido na seleção.";
  return "";
}

export function isComunicadoPending(item: ComunicadoDestinatario) {
  return item.tipo === COMUNICADO_TIPO.informativo ? !item.lidoEm : !item.cienteEm;
}

export const COMUNICADO_RESULTADO = {
  todos: "todos",
  naoAberto: "naoAberto",
  visualizado: "visualizado",
  concluido: "concluido",
  pushFalhou: "pushFalhou"
} as const;
export type ComunicadoResultadoFiltro = (typeof COMUNICADO_RESULTADO)[keyof typeof COMUNICADO_RESULTADO];

export function getRecipientStatusLabel(row: ComunicadoDestinatario) {
  if (row.cienteEm) return "Ciência assinada";
  if (row.lidoEm) return "Ciência registrada";
  if (row.abertoEm) return "Visualizado";
  return "Não aberto";
}

export function matchesRecipientFilter(row: ComunicadoDestinatario, filter: ComunicadoResultadoFiltro) {
  if (filter === COMUNICADO_RESULTADO.naoAberto) return !row.abertoEm && !row.lidoEm && !row.cienteEm;
  if (filter === COMUNICADO_RESULTADO.visualizado) return Boolean(row.abertoEm) && isComunicadoPending(row);
  if (filter === COMUNICADO_RESULTADO.concluido) return !isComunicadoPending(row);
  if (filter === COMUNICADO_RESULTADO.pushFalhou) return row.pushStatus === COMUNICADO_PUSH.falhou;
  return true;
}

// Espelha a regra do plugin: reenvio após falha ou lembrete enquanto o motorista não concluiu.
export function canResendPush(row: ComunicadoDestinatario) {
  if (row.pushStatus === COMUNICADO_PUSH.falhou) return true;
  return row.pushStatus === COMUNICADO_PUSH.enviado && isComunicadoPending(row);
}

export function duplicateComunicado(item: Comunicado): Comunicado {
  const suffix = " (cópia)";
  return {
    ...item,
    id: "",
    titulo: `${item.titulo.slice(0, 150 - suffix.length)}${suffix}`,
    alvoIds: [...item.alvoIds],
    estado: COMUNICADO_ESTADO.rascunho,
    disparadoEm: null
  };
}

const csvCell = (value: string) => /[";\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

export function buildResultadosCsv(rows: ComunicadoDestinatario[], driverNames: Map<string, string>, formatDate: (value: string | null) => string) {
  const header = ["Motorista", "Status", "Enviado em", "Aberto em", "Lido em", "Ciência em", "Assinante", "Observação", "Push", "Erro do push"];
  const pushLabel = (status: number) => status === COMUNICADO_PUSH.enviado ? "Enviado" : status === COMUNICADO_PUSH.falhou ? "Falhou" : "Pendente";
  const lines = rows.map((row) => [
    driverNames.get(row.motoristaId) || row.nomeAssinante || row.motoristaId,
    getRecipientStatusLabel(row),
    formatDate(row.enviadoEm || null),
    formatDate(row.abertoEm),
    formatDate(row.lidoEm),
    formatDate(row.cienteEm),
    row.nomeAssinante,
    row.observacao,
    pushLabel(row.pushStatus),
    row.pushErro
  ].map((value) => csvCell(String(value ?? ""))).join(";"));
  return `﻿${[header.join(";"), ...lines].join("\r\n")}`;
}

export function validateSignature(strokes: SignatureStrokes) {
  if (!Array.isArray(strokes) || strokes.length === 0) return false;
  const points = strokes.flat();
  if (points.length < 2 || points.length > 4000) return false;
  return points.every((point) => Array.isArray(point) && point.length === 2 && point.every((value) => Number.isFinite(value) && value >= 0 && value <= 1));
}

export function mapComunicado(row: Record<string, unknown>): Comunicado {
  return {
    id: String(row.new_comunicadomotoristaid ?? ""),
    titulo: String(row.new_titulo ?? ""),
    corpo: String(row.new_corpo ?? ""),
    tipo: Number(row.new_tipo) as ComunicadoTipo,
    escopo: Number(row.new_escopo) as ComunicadoEscopo,
    alvoIds: parseTargetIds(row.new_alvosjson),
    estado: Number(row.new_estado),
    disparadoEm: row.new_disparadoem ? String(row.new_disparadoem) : null
  };
}

export function mapDestinatario(row: Record<string, unknown>): ComunicadoDestinatario {
  return {
    id: String(row.new_comunicadodestinatarioid ?? ""),
    comunicadoId: String(row._new_comunicado_value ?? ""),
    motoristaId: String(row._new_motorista_value ?? ""),
    titulo: String(row.new_titulo ?? ""),
    corpo: String(row.new_corpo ?? ""),
    tipo: Number(row.new_tipo) as ComunicadoTipo,
    enviadoEm: String(row.new_enviadoem ?? ""),
    abertoEm: row.new_abertoem ? String(row.new_abertoem) : null,
    lidoEm: row.new_lidoem ? String(row.new_lidoem) : null,
    cienteEm: row.new_cienteem ? String(row.new_cienteem) : null,
    nomeAssinante: String(row.new_nomeassinante ?? ""),
    observacao: String(row.new_observacao ?? ""),
    assinaturaJson: String(row.new_assinaturajson ?? ""),
    pushStatus: Number(row.new_pushstatus ?? COMUNICADO_PUSH.pendente),
    pushErro: String(row.new_pusherro ?? "")
  };
}

export async function allRows(entitySet: string, options: string) {
  const rows: Record<string, unknown>[] = [];
  let query = options;
  for (let page = 0; query && page < 100; page += 1) {
    const result = await retrieveMultiple(entitySet, query);
    rows.push(...result.entities);
    if (result.nextLink && !result.nextLink.includes("?")) throw new Error("URL de paginação inválida.");
    query = result.nextLink ? result.nextLink.slice(result.nextLink.indexOf("?") + 1) : "";
  }
  if (query) throw new Error("A lista de comunicados ultrapassou o limite de paginação.");
  return rows;
}

export type MotoristaElegivel = { id: string; nome: string; email: string; userId: string; problema: string };

function hasDriverLinkType(row: Record<string, unknown>) {
  return row.cr40f_tipodevinculo != null && [0, 1].includes(Number(row.cr40f_tipodevinculo));
}

export async function loadMotoristasElegiveis(): Promise<MotoristaElegivel[]> {
  if (isMockComunicados()) return mockRequest<MotoristaElegivel[]>("/drivers");
  const [employees, users] = await Promise.all([
    allRows(DATAVERSE.funcionarios, "$select=cr40f_funcionariosid,cr40f_nomecompleto,cr40f_emailmicrosoft,cr40f_tipodevinculo&$filter=cr40f_status eq 0 and statecode eq 0"),
    allRows(DATAVERSE.systemusers, "$select=systemuserid,internalemailaddress,isdisabled&$filter=isdisabled eq false")
  ]);
  const usersByEmail = new Map<string, string[]>();
  const employeesByEmail = new Map<string, number>();
  for (const user of users) {
    const email = String(user.internalemailaddress ?? "").trim().toLowerCase();
    if (!email) continue;
    usersByEmail.set(email, [...(usersByEmail.get(email) ?? []), String(user.systemuserid ?? "")]);
  }
  for (const row of employees) {
    if (!hasDriverLinkType(row)) continue;
    const email = String(row.cr40f_emailmicrosoft ?? "").trim().toLowerCase();
    if (email) employeesByEmail.set(email, (employeesByEmail.get(email) ?? 0) + 1);
  }
  return employees
    .map((row) => {
      const email = String(row.cr40f_emailmicrosoft ?? "").trim().toLowerCase();
      const matches = usersByEmail.get(email) ?? [];
      return {
        id: String(row.cr40f_funcionariosid ?? ""),
        nome: String(row.cr40f_nomecompleto ?? ""),
        email,
        userId: matches.length === 1 ? matches[0] : "",
        problema: !hasDriverLinkType(row) ? "Tipo de vínculo não definido" : !email ? "Sem e-mail Microsoft" : (employeesByEmail.get(email) ?? 0) > 1 ? "E-mail usado por mais de um motorista" : matches.length === 0 ? "Sem usuário ativo" : matches.length > 1 ? "Usuário duplicado" : ""
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

const DESTINATARIO_SELECT = "$select=new_comunicadodestinatarioid,_new_comunicado_value,_new_motorista_value,new_titulo,new_corpo,new_tipo,new_enviadoem,new_abertoem,new_lidoem,new_cienteem,new_nomeassinante,new_observacao,new_assinaturajson,new_pushstatus,new_pusherro";

export async function loadDriverComunicados() {
  if (isMockComunicados()) return mockRequest<ComunicadoDestinatario[]>(`/recipients?driverId=${LOCAL_DRIVER_ID}`);
  const rows = await allRows(DATAVERSE.comunicadoDestinatarios, `${DESTINATARIO_SELECT}&$orderby=new_enviadoem desc`);
  return rows.map(mapDestinatario);
}

export async function loadGestaoComunicados() {
  if (isMockComunicados()) return mockRequest<Comunicado[]>("/comunicados");
  const rows = await allRows(DATAVERSE.comunicados, "$select=new_comunicadomotoristaid,new_titulo,new_corpo,new_tipo,new_escopo,new_alvosjson,new_estado,new_disparadoem&$orderby=createdon desc");
  return rows.map(mapComunicado);
}

export async function loadGestaoDestinatarios(comunicadoId: string) {
  if (isMockComunicados()) return mockRequest<ComunicadoDestinatario[]>(`/recipients?comunicadoId=${cleanGuid(comunicadoId)}`);
  const rows = await allRows(DATAVERSE.comunicadoDestinatarios, `${DESTINATARIO_SELECT}&$filter=_new_comunicado_value eq ${cleanGuid(comunicadoId)}&$orderby=new_enviadoem desc`);
  return rows.map(mapDestinatario);
}

export async function saveDraft(draft: Comunicado) {
  const error = validateDraft(draft);
  if (error) throw new Error(error);
  if (draft.estado === COMUNICADO_ESTADO.disparado) throw new Error("Comunicado já disparado não pode ser editado.");
  if (isMockComunicados()) return (await mockRequest<Comunicado>("/comunicados", draft)).id;
  const payload = {
    new_name: draft.titulo.trim(),
    new_titulo: draft.titulo.trim(),
    new_corpo: draft.corpo.trim(),
    new_tipo: draft.tipo,
    new_escopo: draft.escopo,
    new_alvosjson: JSON.stringify(draft.escopo === COMUNICADO_ESCOPO.todos ? [] : draft.alvoIds.map(cleanGuid)),
    new_estado: COMUNICADO_ESTADO.rascunho
  };
  if (draft.id) {
    await updateOne(DATAVERSE.comunicados, draft.id, payload);
    return draft.id;
  }
  return (await createOne(DATAVERSE.comunicados, payload)).id;
}

export async function deleteDraft(item: Comunicado) {
  if (item.estado !== COMUNICADO_ESTADO.rascunho) throw new Error("Somente rascunhos podem ser excluídos.");
  if (isMockComunicados()) { await mockRequest(`/comunicados/${cleanGuid(item.id)}`, {}, "DELETE"); return; }
  await deleteOne(DATAVERSE.comunicados, item.id);
}

type XrmApi = { WebApi?: { online?: { execute?: (request: Record<string, unknown>) => Promise<Response> } } };

export async function executeComunicadoAction(operationName: string, parameters: Record<string, string>) {
  if (isMockComunicados()) {
    if (operationName === "new_DispararComunicadoMotorista") { await mockRequest(`/comunicados/${parameters.new_ComunicadoId}/dispatch`, {}); return; }
    const action = operationName === "new_AbrirComunicadoMotorista" ? "open" : operationName === "new_RegistrarCienciaComunicado" ? "sign" : "retry";
    await mockRequest(`/recipients/${parameters.new_DestinatarioId}/${action}`, action === "sign" ? {
      strokes: JSON.parse(parameters.new_AssinaturaJson), observacao: parameters.new_Observacao
    } : {});
    return;
  }
  let xrm: XrmApi | undefined;
  try { xrm = (window.parent as Window & { Xrm?: XrmApi }).Xrm; } catch { /* Parent may be cross-origin. */ }
  xrm ??= (window as Window & { Xrm?: XrmApi }).Xrm;
  const execute = xrm?.WebApi?.online?.execute;
  if (!execute) throw new Error("Abra o web resource no Power Apps para registrar esta ação.");
  const parameterTypes = Object.fromEntries(Object.keys(parameters).map((key) => [key, {
    typeName: key.endsWith("Id") ? "Edm.Guid" : "Edm.String",
    structuralProperty: 1
  }]));
  const response = await execute({
    ...parameters,
    getMetadata: () => ({ boundParameter: null, operationType: 0, operationName, parameterTypes })
  });
  if (!response.ok) {
    // Guarda a resposta técnica no erro; o logger aplica a ocultação de dados sensíveis.
    const responseBody = await response.text().catch(() => "Resposta indisponível.");
    let responseDetail: unknown = responseBody.slice(0, 4000);
    try { responseDetail = JSON.parse(responseBody); } catch { /* Response may be plain text. */ }
    throw Object.assign(new Error(`Falha ao registrar ação (${response.status}).`), {
      code: response.status,
      operationName,
      statusText: response.statusText,
      requestId: response.headers.get("x-ms-service-request-id") ?? response.headers.get("REQ_ID") ?? "",
      responseBody: responseDetail
    });
  }
}

export const abrirComunicado = (id: string) => executeComunicadoAction("new_AbrirComunicadoMotorista", { new_DestinatarioId: cleanGuid(id) });
export const assinarComunicado = (id: string, strokes: SignatureStrokes, observacao: string) => {
  if (!validateSignature(strokes)) throw new Error("Desenhe sua assinatura antes de confirmar.");
  if (observacao.length > 1000) throw new Error("A observação deve ter até 1.000 caracteres.");
  const assinaturaJson = JSON.stringify(strokes);
  if (assinaturaJson.length > 100000) throw new Error("A assinatura ficou grande demais. Limpe e assine novamente.");
  return executeComunicadoAction("new_RegistrarCienciaComunicado", {
    new_DestinatarioId: cleanGuid(id),
    new_AssinaturaJson: assinaturaJson,
    new_Observacao: observacao.trim()
  });
};

export const dispararComunicado = (id: string) => executeComunicadoAction("new_DispararComunicadoMotorista", { new_ComunicadoId: cleanGuid(id) });
export const reenviarPush = (id: string) => executeComunicadoAction("new_ReenviarPushComunicado", { new_DestinatarioId: cleanGuid(id) });
