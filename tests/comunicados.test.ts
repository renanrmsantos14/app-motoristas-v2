import assert from "node:assert/strict";
import test from "node:test";
import {
  COMUNICADO_ESCOPO,
  COMUNICADO_TIPO,
  executeComunicadoAction,
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
  const windowMock: any = { Xrm: { WebApi: { online: { execute: async () => ({ ok: false, status: 503 }) } } } };
  windowMock.parent = windowMock;
  (globalThis as any).window = windowMock;
  try {
    await assert.rejects(executeComunicadoAction("new_AbrirComunicadoMotorista", { new_DestinatarioId: driverId }), /503/);
  } finally {
    (globalThis as any).window = previousWindow;
  }
});
