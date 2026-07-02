import assert from "node:assert/strict";
import test from "node:test";
import {
  buildExpenseCreatePayload,
  findMaintenanceExpenseCategory,
  findExpensePaymentMethodByName,
  mapMaintenancePaymentToExpensePaymentNames,
  matchesExpenseCitySearch,
  parseCurrencyInput,
  shouldUploadMaintenanceExpenseInvoices,
  validateExpenseDraft,
  type ExpenseDraft,
  type ExpensePhoto,
  type ExpenseReferenceData
} from "../src/lib/expenses.ts";

const referenceData: ExpenseReferenceData = {
  categories: [
    {
      id: "cat-abastecimento",
      name: "Abastecimento",
      order: 10,
      exigeVeiculo: true,
      exigeReserva: false,
      exigeKm: true,
      exigeLitros: true
    },
    {
      id: "cat-almoco",
      name: "Almo\u00e7o",
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
    },
    {
      id: "cat-manutencao",
      name: "Manuten\u00e7\u00e3o",
      order: 120,
      exigeVeiculo: true,
      exigeReserva: false,
      exigeKm: false,
      exigeLitros: false
    }
  ],
  paymentMethods: [
    {
      id: "pay-cartao-credito",
      name: "Cart\u00e3o de cr\u00e9dito",
      order: 10,
      tipo: "Cart\u00e3o"
    },
    {
      id: "pay-particular-reembolso",
      name: "Particular (Reembolso)",
      order: 20,
      tipo: "Reembolso"
    },
    {
      id: "pay-faturado",
      name: "Faturado (Plano mensal)",
      order: 30,
      tipo: "Faturado"
    }
  ],
  cities: [
    {
      id: "city-sao-paulo",
      name: "S\u00e3o Paulo - SP",
      order: 0,
      uf: "SP",
      pais: "Brasil",
      codigoIbge: "3550308"
    },
    {
      id: "city-campinas",
      name: "Campinas - SP",
      order: 0,
      uf: "SP",
      pais: "Brasil",
      codigoIbge: "3509502"
    },
    {
      id: "city-sao-jose-dos-campos",
      name: "Sao Jose dos Campos - SP",
      order: 0,
      uf: "SP",
      pais: "Brasil",
      codigoIbge: "3549904"
    }
  ]
};

const photos: ExpensePhoto[] = [{ id: "photo-1", dataUrl: "data:image/jpeg;base64,abc" }];

function baseDraft(overrides: Partial<ExpenseDraft> = {}): ExpenseDraft {
  return {
    categoriaId: "cat-almoco",
    veiculoId: "",
    valor: "R$ 50,00",
    dataGasto: "2026-06-09",
    formaPagamentoId: "pay-cartao-credito",
    cidadeId: "city-sao-paulo",
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
    formaPagamentoId: "",
    cidadeId: ""
  });

  assert.deepEqual(validateExpenseDraft(draft, [], referenceData), {
    categoriaId: "Selecione a categoria.",
    valor: "Informe um valor maior que zero.",
    dataGasto: "Informe a data do gasto.",
    formaPagamentoId: "Selecione a forma de pagamento.",
    cidadeId: "Selecione a cidade.",
    photos: "Adicione ao menos uma foto do comprovante."
  });
});

test("buildExpenseCreatePayload monta payload Dataverse novo sem reembolso", () => {
  const payload = buildExpenseCreatePayload({
    draft: baseDraft({
      categoriaId: "cat-abastecimento",
      formaPagamentoId: "pay-particular-reembolso",
      cidadeId: "city-campinas",
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
    cityEntitySet: "cr40f_cidades",
    motoristaEntitySet: "cr40f_funcionarioses",
    veiculoEntitySet: "cr40f_veiculoses",
    reservaEntitySet: "cr40f_reservadeveculoses",
    lookupNavigationNames: {
      motorista: "nav_motorista",
      categoria: "nav_categoria",
      formaPagamento: "nav_formapagamento",
      cidade: "nav_cidade",
      veiculo: "nav_veiculo",
      reserva: "nav_reserva"
    }
  });

  assert.equal(payload.cr40f_nome, "Abastecimento - 09/06/2026");
  assert.equal(payload.cr40f_valor, 238.7);
  assert.equal(payload.cr40f_datagasto, "2026-06-09T12:00:00.000Z");
  assert.equal(payload.cr40f_kminformado, 58230);
  assert.equal(payload.cr40f_litros, 42.5);
  assert.equal(payload.cr40f_reembolsavel, undefined);
  assert.equal(payload.cr40f_statusfinanceiro, 100000000);
  assert.equal(payload.cr40f_statusanexo, 100000001);
  assert.equal(payload.cr40f_observacao, "Abastecimento no retorno da agenda");
  assert.equal(payload["nav_motorista@odata.bind"], "/cr40f_funcionarioses(driver-1)");
  assert.equal(payload["nav_veiculo@odata.bind"], "/cr40f_veiculoses(vehicle-1)");
  assert.equal(payload["nav_categoria@odata.bind"], "/cr40f_categoriadespesaoperacionals(cat-abastecimento)");
  assert.equal(payload["nav_formapagamento@odata.bind"], "/cr40f_formapagamentodespesas(pay-particular-reembolso)");
  assert.equal(payload["nav_cidade@odata.bind"], "/cr40f_cidades(city-campinas)");
});

test("validateExpenseDraft exige veiculo KM e litros so quando regra da categoria pede", () => {
  assert.deepEqual(validateExpenseDraft(baseDraft({ categoriaId: "cat-abastecimento" }), photos, referenceData), {
    veiculoId: "Selecione o ve\u00edculo.",
    kmInformado: "Informe o KM.",
    litros: "Informe os litros."
  });

  assert.deepEqual(validateExpenseDraft(baseDraft({ categoriaId: "cat-almoco" }), photos, referenceData), {});
});

test("validateExpenseDraft nunca exige descricao", () => {
  assert.deepEqual(validateExpenseDraft(baseDraft({ categoriaId: "cat-outros", descricao: "" }), photos, referenceData), {});
});

test("matchesExpenseCitySearch aceita sigla como sjc", () => {
  const city = referenceData.cities[2];

  assert.equal(matchesExpenseCitySearch(city, "sjc"), true);
  assert.equal(matchesExpenseCitySearch(city, "sao jose"), true);
  assert.equal(matchesExpenseCitySearch(city, "3549904"), true);
});

test("buildExpenseCreatePayload vincula gasto automatico a manutencao", () => {
  const payload = buildExpenseCreatePayload({
    draft: baseDraft({
      categoriaId: "cat-manutencao",
      formaPagamentoId: "pay-faturado",
      cidadeId: "city-sao-jose-dos-campos",
      veiculoId: "vehicle-1",
      dataGasto: "2026-06-25",
      valor: "R$ 480,00",
      estabelecimento: "Auto Center",
      descricao: "Manutencao MNT-123"
    }),
    photos,
    referenceData,
    motoristaId: "driver-1",
    veiculoId: "vehicle-1",
    manutencaoId: "maintenance-1",
    dataGastoIso: "2026-06-25T15:30:00.000Z",
    categoryEntitySet: "cr40f_categoriadespesaoperacionals",
    paymentMethodEntitySet: "cr40f_formapagamentodespesas",
    cityEntitySet: "cr40f_cidades",
    motoristaEntitySet: "cr40f_funcionarioses",
    veiculoEntitySet: "cr40f_veiculoses",
    reservaEntitySet: "cr40f_reservadeveculoses",
    maintenanceEntitySet: "cr40f_manutencoeses",
    lookupNavigationNames: {
      motorista: "nav_motorista",
      categoria: "nav_categoria",
      formaPagamento: "nav_formapagamento",
      cidade: "nav_cidade",
      veiculo: "nav_veiculo",
      manutencao: "nav_manutencao"
    }
  });

  assert.equal(payload.cr40f_nome, "Manuten\u00e7\u00e3o - 25/06/2026");
  assert.equal(payload.cr40f_datagasto, "2026-06-25T15:30:00.000Z");
  assert.equal(payload.cr40f_valor, 480);
  assert.equal(payload.cr40f_statusanexo, 100000001);
  assert.equal(payload.cr40f_estabelecimento, "Auto Center");
  assert.equal(payload["nav_manutencao@odata.bind"], "/cr40f_manutencoeses(maintenance-1)");
  assert.equal(payload["nav_veiculo@odata.bind"], "/cr40f_veiculoses(vehicle-1)");
});

test("mapeia pagamento de manutencao para formas existentes de despesas", () => {
  const pedidoNames = mapMaintenancePaymentToExpensePaymentNames("Pedido de compra");
  const pixNames = mapMaintenancePaymentToExpensePaymentNames("Pix");

  assert.equal(findExpensePaymentMethodByName(referenceData, pedidoNames)?.id, "pay-faturado");
  assert.equal(findExpensePaymentMethodByName(referenceData, pixNames)?.id, "pay-particular-reembolso");
  assert.deepEqual(mapMaintenancePaymentToExpensePaymentNames("Cart\u00e3o de cr\u00e9dito")[0], "Cartao de credito");
});

test("localiza categoria de manutencao mesmo com nome complementar", () => {
  const category = findMaintenanceExpenseCategory({
    ...referenceData,
    categories: [
      { id: "cat-outros", name: "Outros", order: 130, exigeVeiculo: false, exigeReserva: false, exigeKm: false, exigeLitros: false },
      { id: "cat-manutencao-veiculo", name: "Manuten\u00e7\u00e3o de Ve\u00edculo", order: 120, exigeVeiculo: true, exigeReserva: false, exigeKm: false, exigeLitros: false }
    ]
  });

  assert.equal(category?.id, "cat-manutencao-veiculo");
});

test("retry de manutencao reutiliza gasto completo sem reenviar anexos", () => {
  assert.equal(shouldUploadMaintenanceExpenseInvoices(100000002), false);
  assert.equal(shouldUploadMaintenanceExpenseInvoices(100000003), true);
  assert.equal(shouldUploadMaintenanceExpenseInvoices(undefined), true);
});
