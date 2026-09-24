import assert from "node:assert/strict";
import test from "node:test";
import {
  COMUNICADO_ESCOPO,
  COMUNICADO_TIPO,
  isComunicadoPending,
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
