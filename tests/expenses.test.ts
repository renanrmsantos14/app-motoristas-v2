import assert from "node:assert/strict";
import test from "node:test";
import {
  buildExpenseCreatePayload,
  parseCurrencyInput,
  validateExpenseDraft,
  type ExpenseDraft,
  type ExpensePhoto,
  type ExpenseReferenceData
} from "../src/lib/expenses.ts";

const referenceData: ExpenseReferenceData = {
  categories: [
    {
      id: "cat-combustivel",
      name: "Combustível",
      order: 10,
      exigeVeiculo: true,
      exigeReserva: false,
      exigeKm: true,
      exigeLitros: true
    },
    {
      id: "cat-alimentacao",
      name: "Alimentação",
      order: 20,
      exigeVeiculo: false,
      exigeReserva: false,
      exigeKm: false,
      exigeLitros: false
    },
    {
      id: "cat-outros",
      name: "Outros",
      order: 999,
      exigeVeiculo: false,
      exigeReserva: false,
      exigeKm: false,
      exigeLitros: false
    }
  ],
  paymentMethods: [
    {
      id: "pay-cartao-empresa",
      name: "Cartão empresa",
      order: 10,
      tipo: "Cartão"
    },
    {
      id: "pay-pix-motorista",
      name: "Pix motorista",
      order: 20,
      tipo: "Pix"
    }
  ]
};

const photos: ExpensePhoto[] = [{ id: "photo-1", dataUrl: "data:image/jpeg;base64,abc" }];

function baseDraft(overrides: Partial<ExpenseDraft> = {}): ExpenseDraft {
  return {
    categoriaId: "cat-alimentacao",
    veiculoId: "",
    valor: "R$ 50,00",
    dataGasto: "2026-06-09",
    formaPagamentoId: "pay-cartao-empresa",
    estabelecimento: "Padaria",
    descricao: "",
    kmInformado: "",
    litros: "",
    ...overrides
  };
}

test("parseCurrencyInput converte entrada BRL para numero", () => {
  assert.equal(parseCurrencyInput("R$ 123,45"), 123.45);
  assert.equal(parseCurrencyInput("123.456,78"), 123456.78);
  assert.equal(parseCurrencyInput("89.90"), 89.9);
});

test("validateExpenseDraft exige campos base e comprovante sempre", () => {
  const draft = baseDraft({
    categoriaId: "",
    valor: "0",
    dataGasto: "",
    formaPagamentoId: ""
  });

  assert.deepEqual(validateExpenseDraft(draft, [], referenceData), {
    categoriaId: "Selecione a categoria.",
    valor: "Informe um valor maior que zero.",
    dataGasto: "Informe a data do gasto.",
    formaPagamentoId: "Selecione a forma de pagamento.",
    photos: "Adicione ao menos uma foto do comprovante."
  });
});

test("buildExpenseCreatePayload monta payload Dataverse novo sem reembolso", () => {
  const payload = buildExpenseCreatePayload({
    draft: baseDraft({
      categoriaId: "cat-combustivel",
      formaPagamentoId: "pay-pix-motorista",
      veiculoId: "vehicle-1",
      valor: "R$ 238,70",
      descricao: "Abastecimento no retorno da agenda",
      kmInformado: "58230",
      litros: "42,5"
    }),
    photos,
    referenceData,
    motoristaId: "driver-1",
    veiculoId: "vehicle-1",
    categoryEntitySet: "cr40f_categoriadespesaoperacionals",
    paymentMethodEntitySet: "cr40f_formapagamentodespesas",
    motoristaEntitySet: "cr40f_funcionarioses",
    veiculoEntitySet: "cr40f_veiculoses",
    reservaEntitySet: "cr40f_reservadeveculoses",
    lookupNavigationNames: {
      motorista: "nav_motorista",
      categoria: "nav_categoria",
      formaPagamento: "nav_formapagamento",
      veiculo: "nav_veiculo",
      reserva: "nav_reserva"
    }
  });

  assert.equal(payload.cr40f_nome, "Combustível - 09/06/2026");
  assert.equal(payload.cr40f_valor, 238.7);
  assert.equal(payload.cr40f_datagasto, "2026-06-09T12:00:00.000Z");
  assert.equal(payload.cr40f_kminformado, 58230);
  assert.equal(payload.cr40f_litros, 42.5);
  assert.equal(payload.cr40f_reembolsavel, undefined);
  assert.equal(payload.cr40f_statusfinanceiro, 100000000);
  assert.equal(payload.cr40f_statusanexo, 100000001);
  assert.match(String(payload.cr40f_observacao), /Forma de pagamento: Pix motorista/);
  assert.match(String(payload.cr40f_observacao), /Litros: 42,5 L/);
  assert.match(String(payload.cr40f_observacao), /Comprovantes: 1/);
  assert.equal(payload["nav_motorista@odata.bind"], "/cr40f_funcionarioses(driver-1)");
  assert.equal(payload["nav_veiculo@odata.bind"], "/cr40f_veiculoses(vehicle-1)");
  assert.equal(payload["nav_categoria@odata.bind"], "/cr40f_categoriadespesaoperacionals(cat-combustivel)");
  assert.equal(payload["nav_formapagamento@odata.bind"], "/cr40f_formapagamentodespesas(pay-pix-motorista)");
});

test("validateExpenseDraft exige veiculo KM e litros so quando regra da categoria pede", () => {
  assert.deepEqual(validateExpenseDraft(baseDraft({ categoriaId: "cat-combustivel" }), photos, referenceData), {
    veiculoId: "Selecione o veículo.",
    kmInformado: "Informe o KM.",
    litros: "Informe os litros."
  });

  assert.deepEqual(validateExpenseDraft(baseDraft({ categoriaId: "cat-alimentacao" }), photos, referenceData), {});
});

test("validateExpenseDraft nunca exige descricao", () => {
  assert.deepEqual(validateExpenseDraft(baseDraft({ categoriaId: "cat-outros", descricao: "" }), photos, referenceData), {});
});
