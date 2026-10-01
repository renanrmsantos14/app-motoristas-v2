import assert from "node:assert/strict";
import test from "node:test";
import {
  buildResultadosCsv,
  canResendPush,
  COMUNICADO_ESCOPO,
  COMUNICADO_ESTADO,
  COMUNICADO_PUSH,
  COMUNICADO_RESULTADO,
  COMUNICADO_TIPO,
  duplicateComunicado,
  executeComunicadoAction,
  getRecipientStatusLabel,
  matchesRecipientFilter,
  isComunicadoPending,
  loadMotoristasElegiveis,
  mapDestinatario,
  parseTargetIds,
  validateDraft,
  validateSignature
} from "../src/lib/comunicados.ts";

const driverId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

test("rascunho selecionado exige motorista e limites de texto", () => {
  const valid = { titulo: "Aviso operacional", corpo: "Leia as orientacoes", escopo: COMUNICADO_ESCOPO.selecionados, alvoIds: [driverId] };
  assert.equal(validateDraft(valid), "");
  assert.match(validateDraft({ ...valid, alvoIds: [] }), /Selecione/);
  assert.match(validateDraft({ ...valid, titulo: " ".repeat(151) }), /título/);
  assert.match(validateDraft({ ...valid, corpo: "x".repeat(4001) }), /4\.000/);
  assert.match(validateDraft({ ...valid, alvoIds: ["invalido"] }), /inválido/);
});

test("lista de destinatarios deduplica e descarta IDs invalidos", () => {
  assert.deepEqual(parseTargetIds(JSON.stringify([driverId, `{${driverId}}`, "invalido"])), [driverId]);
  assert.deepEqual(parseTargetIds("texto inválido"), []);
});

test("informativo deixa de ficar pendente ao ser lido; ciencia exige assinatura", () => {
  const row = mapDestinatario({
    new_comunicadodestinatarioid: driverId,
    new_tipo: COMUNICADO_TIPO.informativo,
    new_enviadoem: "2026-09-24T12:00:00Z"
  });
  assert.equal(isComunicadoPending(row), true);
  assert.equal(isComunicadoPending({ ...row, lidoEm: "2026-09-24T12:05:00Z" }), false);
  assert.equal(isComunicadoPending({ ...row, tipo: COMUNICADO_TIPO.ciencia, lidoEm: "2026-09-24T12:05:00Z" }), true);
  assert.equal(isComunicadoPending({ ...row, tipo: COMUNICADO_TIPO.ciencia, cienteEm: "2026-09-24T12:10:00Z" }), false);
});

test("assinatura requer traco completo e coordenadas normalizadas", () => {
  assert.equal(validateSignature([[[0.1, 0.2], [0.4, 0.5]]]), true);
  assert.equal(validateSignature([[[0.1, 0.2]]]), false);
  assert.equal(validateSignature([[[0.1, 0.2], [1.1, 0.5]]]), false);
  assert.equal(validateSignature([Array.from({ length: 4001 }, () => [0.1, 0.2] as [number, number])]), false);
});

test("gestão exclui motorista sem usuário único e e-mail duplicado", async () => {
  const previousWindow = (globalThis as any).window;
  const windowMock: any = {
    location: { hostname: "org.crm2.dynamics.com" },
    Xrm: { WebApi: { retrieveMultipleRecords: async (entity: string) => ({
      entities: entity === "cr40f_funcionarios" ? [
        { cr40f_funcionariosid: driverId, cr40f_nomecompleto: "Apto", cr40f_emailmicrosoft: "apto@empresa.test", cr40f_tipodevinculo: 0 },
        { cr40f_funcionariosid: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", cr40f_nomecompleto: "Sem acesso", cr40f_emailmicrosoft: "ausente@empresa.test", cr40f_tipodevinculo: 1 },
        { cr40f_funcionariosid: "cccccccc-cccc-cccc-cccc-cccccccccccc", cr40f_nomecompleto: "Duplicado A", cr40f_emailmicrosoft: "duplicado@empresa.test", cr40f_tipodevinculo: 0 },
        { cr40f_funcionariosid: "dddddddd-dddd-dddd-dddd-dddddddddddd", cr40f_nomecompleto: "Duplicado B", cr40f_emailmicrosoft: "duplicado@empresa.test", cr40f_tipodevinculo: 1 },
        { cr40f_funcionariosid: "11111111-1111-1111-1111-111111111111", cr40f_nomecompleto: "Vínculo ausente", cr40f_emailmicrosoft: "semvinculo@empresa.test", cr40f_tipodevinculo: null }
      ] : [
        { systemuserid: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", internalemailaddress: "apto@empresa.test" },
        { systemuserid: "ffffffff-ffff-ffff-ffff-ffffffffffff", internalemailaddress: "duplicado@empresa.test" }
      ]
    }) } }
  };
  windowMock.parent = windowMock;
  (globalThis as any).window = windowMock;
  try {
    const drivers = await loadMotoristasElegiveis();
    assert.equal(drivers.filter((driver) => !driver.problema).length, 1);
    assert.equal(drivers.find((driver) => driver.nome === "Sem acesso")?.problema, "Sem usuário ativo");
    assert.equal(drivers.find((driver) => driver.nome === "Duplicado A")?.problema, "E-mail usado por mais de um motorista");
    assert.equal(drivers.find((driver) => driver.nome === "Vínculo ausente")?.problema, "Tipo de vínculo não definido");
  } finally {
    (globalThis as any).window = previousWindow;
  }
});

test("falha da Custom API não confirma a ação local", async () => {
  const previousWindow = (globalThis as any).window;
  const windowMock: any = { Xrm: { WebApi: { online: { execute: async () => new Response(JSON.stringify({ error: { code: "Unavailable", message: "Serviço indisponível" } }), { status: 503, headers: { "x-ms-service-request-id": "request-123" } }) } } } };
  windowMock.parent = windowMock;
  (globalThis as any).window = windowMock;
  try {
    await assert.rejects(executeComunicadoAction("new_AbrirComunicadoMotorista", { new_DestinatarioId: driverId }), (error: any) => {
      assert.equal(error.code, 503);
      assert.equal(error.requestId, "request-123");
      assert.equal(error.operationName, "new_AbrirComunicadoMotorista");
      assert.equal(error.responseBody.error.message, "Serviço indisponível");
      return true;
    });
  } finally {
    (globalThis as any).window = previousWindow;
  }
});

test("lembrete só vale para push falho ou destinatário ainda pendente", () => {
  const row = mapDestinatario({ new_comunicadodestinatarioid: driverId, new_tipo: COMUNICADO_TIPO.ciencia, new_pushstatus: COMUNICADO_PUSH.enviado });
  assert.equal(canResendPush(row), true);
  assert.equal(canResendPush({ ...row, cienteEm: "2026-09-24T12:10:00Z" }), false);
  assert.equal(canResendPush({ ...row, pushStatus: COMUNICADO_PUSH.pendente }), false);
  assert.equal(canResendPush({ ...row, cienteEm: "2026-09-24T12:10:00Z", pushStatus: COMUNICADO_PUSH.falhou }), true);
});

test("filtros de resultado separam não aberto, visualizado, concluído e push falho", () => {
  const base = mapDestinatario({ new_comunicadodestinatarioid: driverId, new_tipo: COMUNICADO_TIPO.ciencia, new_pushstatus: COMUNICADO_PUSH.enviado });
  const aberto = { ...base, abertoEm: "2026-09-24T12:05:00Z" };
  const assinado = { ...aberto, cienteEm: "2026-09-24T12:10:00Z" };
  const falhou = { ...base, pushStatus: COMUNICADO_PUSH.falhou };
  assert.deepEqual([base, aberto, assinado, falhou].map((row) => matchesRecipientFilter(row, COMUNICADO_RESULTADO.naoAberto)), [true, false, false, true]);
  assert.deepEqual([base, aberto, assinado].map((row) => matchesRecipientFilter(row, COMUNICADO_RESULTADO.visualizado)), [false, true, false]);
  assert.deepEqual([base, aberto, assinado].map((row) => matchesRecipientFilter(row, COMUNICADO_RESULTADO.concluido)), [false, false, true]);
  assert.deepEqual([base, falhou].map((row) => matchesRecipientFilter(row, COMUNICADO_RESULTADO.pushFalhou)), [false, true]);
  assert.equal(getRecipientStatusLabel(assinado), "Ciência assinada");
  assert.equal(getRecipientStatusLabel({ ...base, tipo: COMUNICADO_TIPO.informativo, lidoEm: "2026-09-24T12:05:00Z" }), "Ciência registrada");
});

test("duplicar gera rascunho novo sem herdar disparo", () => {
  const copy = duplicateComunicado({ id: driverId, titulo: "x".repeat(150), corpo: "Corpo", tipo: COMUNICADO_TIPO.ciencia, escopo: COMUNICADO_ESCOPO.selecionados, alvoIds: [driverId], estado: COMUNICADO_ESTADO.disparado, disparadoEm: "2026-09-24T12:00:00Z" });
  assert.equal(copy.id, "");
  assert.equal(copy.estado, COMUNICADO_ESTADO.rascunho);
  assert.equal(copy.disparadoEm, null);
  assert.equal(copy.titulo.length, 150);
  assert.ok(copy.titulo.endsWith(" (cópia)"));
  assert.equal(validateDraft(copy), "");
});

test("CSV de resultados usa BOM, ponto e vírgula e escapa campos", () => {
  const row = { ...mapDestinatario({ new_comunicadodestinatarioid: driverId, _new_motorista_value: driverId, new_tipo: COMUNICADO_TIPO.ciencia, new_pushstatus: COMUNICADO_PUSH.falhou }), observacao: 'Disse "ok"; seguiu' };
  const csv = buildResultadosCsv([row], new Map([[driverId, "Motorista A"]]), (value) => value ?? "");
  assert.ok(csv.startsWith("\uFEFFMotorista;Status;"));
  const line = csv.split("\r\n")[1];
  assert.ok(line.startsWith("Motorista A;Não aberto;"));
  assert.ok(line.includes('"Disse ""ok""; seguiu"'));
  assert.ok(line.includes(";Falhou;"));
});
