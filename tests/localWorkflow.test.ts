import assert from "node:assert/strict";
import test from "node:test";
import { agendaMock, historyMock } from "../src/data/mockData.ts";
import {
  cancelDetailLocally,
  buildWhatsAppUrl,
  detailsToClipboardText,
  clearMaintenancePhotos,
  finalizeDetailLocally,
  findDetailByParams,
  saveMaintenancePhoto,
  saveSignatureLocally,
  validateMaintenanceFields,
  validateVoucherFields
} from "../src/lib/localWorkflow.ts";

test("finalizar move item ativo para histórico com assinatura e fotos locais", () => {
  const detail = agendaMock.find((item) => item.detail?.id === "10241")?.detail;
  assert.ok(detail);

  const withSignature = saveSignatureLocally(
    { agenda: agendaMock, history: historyMock, signatures: {}, photos: {} },
    detail.id,
    "data:image/png;base64,assinatura"
  );
  const withPhoto = saveMaintenancePhoto(withSignature, detail.id, "FOTO1", "data:image/jpeg;base64,foto");
  const result = finalizeDetailLocally(withPhoto, detail, { "Observação Final": "OK local" });

  assert.equal(result.agenda.some((item) => item.detail?.id === detail.id), false);
  assert.equal(result.history[0].detail?.id, detail.id);
  assert.equal(result.history[0].detail?.actions.length, 0);
  assert.equal(result.history[0].detail?.fields.some((field) => field.label === "Assinatura"), true);
  assert.equal(result.history[0].detail?.fields.some((field) => field.label === "Fotos"), true);
});

test("cancelar no local move item para histórico cancelado com motivo", () => {
  const detail = agendaMock.find((item) => item.detail?.id === "10244")?.detail;
  assert.ok(detail);

  const result = cancelDetailLocally(
    { agenda: agendaMock, history: historyMock, signatures: {}, photos: {} },
    detail,
    "Passageiro dispensou no local"
  );

  assert.equal(result.agenda.some((item) => item.detail?.id === detail.id), false);
  assert.equal(result.history[0].canceled, true);
  assert.equal(result.history[0].detail?.fields.some((field) => field.value === "Passageiro dispensou no local"), true);
});

test("fotos da manutenção podem ser salvas e limpas localmente", () => {
  const initial = { agenda: agendaMock, history: historyMock, signatures: {}, photos: {} };
  const saved = saveMaintenancePhoto(initial, "76", "NOTAFISCAL", "data:image/jpeg;base64,nf");
  assert.equal(saved.photos["76"].NOTAFISCAL, "data:image/jpeg;base64,nf");

  const cleared = clearMaintenancePhotos(saved, "76");
  assert.deepEqual(cleared.photos["76"], {});
});

test("voucher exige horário inicial", () => {
  assert.deepEqual(validateVoucherFields({
    "Horário Inicial": "Não informado"
  }), [
    "Horário inicial é obrigatório."
  ]);

  assert.deepEqual(validateVoucherFields({
    "Horário Inicial": "14:30"
  }), []);
});

test("manutenção exige campos principais antes de finalizar", () => {
  assert.deepEqual(validateMaintenanceFields({
    "Serviço Realizado": "",
    "Forma de Pagamento": "Não informado",
    "Estabelecimento": "Não informado",
    "Valor": "R$ 0,00"
  }), ["Preencha corretamente: Manutenção Realizada, Forma de Pagamento, Estabelecimento e Valor."]);
});

test("deep link local encontra detalhe por servicoId e tipo", () => {
  const detail = findDetailByParams(agendaMock, "10241", "SERVICO");
  assert.equal(detail?.id, "10241");
  assert.equal(detail?.type, "SERVICO");
});

test("texto de cópia limpa html dos detalhes", () => {
  const detail = agendaMock.find((item) => item.detail?.id === "10241")?.detail;
  assert.ok(detail);

  const text = detailsToClipboardText(detail);
  assert.equal(text.includes("<br"), false);
  assert.equal(text.includes("Passageiros e Telefones de Contato:"), true);
  assert.equal(text.includes("Ana Paula Martins\n+55"), true);
});

test("buildWhatsAppUrl remove caracteres e codifica mensagem", () => {
  const url = buildWhatsAppUrl("+55 (12) 99723-6961", "Olá Júnior");
  assert.equal(url, "https://wa.me/5512997236961?text=Ol%C3%A1%20J%C3%BAnior");
});
