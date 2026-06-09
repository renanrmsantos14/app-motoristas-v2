import assert from "node:assert/strict";
import test from "node:test";
import {
  buildExpenseCreatePayload,
  parseCurrencyInput,
  validateExpenseDraft,
  type ExpenseDraft
} from "../src/lib/expenses.ts";

function baseDraft(overrides: Partial<ExpenseDraft> = {}): ExpenseDraft {
  return {
    categoria: "Almoço",
    veiculoId: "",
    cidade: "São Paulo",
    valor: "R$ 50,00",
    dataGasto: "2026-06-09",
    formaPagamento: "Cartão",
    descricao: "",
    kmInformado: "",
    litros: "",
    observacao: "",
    notaFiscalDataUrl: "",
    notaFiscalFileName: "",
    ...overrides
  };
}

test("parseCurrencyInput converte entrada BRL para numero", () => {
  assert.equal(parseCurrencyInput("R$ 123,45"), 123.45);
  assert.equal(parseCurrencyInput("123.456,78"), 123456.78);
  assert.equal(parseCurrencyInput("89.90"), 89.9);
});

test("validateExpenseDraft exige campos base depois da categoria", () => {
  const draft = baseDraft({
    categoria: "",
    cidade: "",
    valor: "0",
    dataGasto: "",
    formaPagamento: ""
  });

  assert.deepEqual(validateExpenseDraft(draft), {
    categoria: "Selecione a categoria.",
    cidade: "Informe a cidade.",
    valor: "Informe um valor maior que zero.",
    dataGasto: "Informe a data do gasto.",
    formaPagamento: "Selecione a forma de pagamento."
  });
});

test("buildExpenseCreatePayload monta payload Dataverse minimo seguro", () => {
  const payload = buildExpenseCreatePayload({
    draft: baseDraft({
      categoria: "Abastecimento",
      veiculoId: "vehicle-1",
      valor: "R$ 238,70",
      descricao: "Abastecimento no retorno da agenda",
      kmInformado: "58230",
      litros: "42,5",
      observacao: "Posto Shell"
    }),
    motoristaId: "driver-1",
    veiculoId: "vehicle-1"
  });

  assert.equal(payload.cr40f_nome, "Abastecimento - 09/06/2026");
  assert.equal(payload.cr40f_cidade, "São Paulo");
  assert.equal(payload.cr40f_valorbruto, 238.7);
  assert.equal(payload.cr40f_valorliquido, 238.7);
  assert.equal(payload.cr40f_datagasto, "2026-06-09T12:00:00.000Z");
  assert.equal(payload.cr40f_kminformado, 58230);
  assert.match(String(payload.cr40f_observacao), /Forma de pagamento: Cartão/);
  assert.match(String(payload.cr40f_observacao), /Litros: 42,5 L/);
  assert.equal(payload["cr40f_Motorista@odata.bind"], "/cr40f_funcionarioses(driver-1)");
  assert.equal(payload["cr40f_Veiculo@odata.bind"], "/cr40f_veiculoses(vehicle-1)");
});

test("validateExpenseDraft exige veiculo KM e litros apenas para abastecimento", () => {
  assert.deepEqual(validateExpenseDraft(baseDraft({ categoria: "Abastecimento" })), {
    veiculoId: "Selecione o veículo.",
    kmInformado: "Informe o KM.",
    litros: "Informe os litros."
  });

  assert.deepEqual(validateExpenseDraft(baseDraft({ categoria: "Almoço" })), {});
});

test("validateExpenseDraft exige descrição em outros e gasto a pedido do cliente", () => {
  assert.deepEqual(validateExpenseDraft(baseDraft({ categoria: "Outros", descricao: "" })), {
    descricao: "Descreva o gasto."
  });
  assert.deepEqual(validateExpenseDraft(baseDraft({ categoria: "Gastos a pedido do cliente", descricao: "" })), {
    descricao: "Descreva o gasto."
  });
});
