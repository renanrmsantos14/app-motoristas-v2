import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAutomaticServiceVehiclePatch,
  buildMaintenanceRequestAssignedVehiclesQuery,
  buildExchangeDisplay,
  buildMaintenanceRequestRecord,
  buildMaintenanceRequestVehiclesQuery,
  buildReceiptEmailContent,
  finalizeExchangeRemote,
  formatReceiveDetailValue,
  getDriverContext,
  getExchangeCompletionState,
  normalizeReceiptIdentifier,
  SERVICE_VEHICLE_ORIGIN,
  shouldShowOpenExchangeForDriver
} from "../src/lib/dataverse.ts";

test("receber exibe valor em reais somente quando marcado e positivo", () => {
  assert.equal(
    formatReceiveDetailValue({
      cr40f_receber: true,
      cr40f_valor_a_receber: 1234.5,
      "cr40f_receber@OData.Community.Display.V1.FormattedValue": "Sim"
    }),
    "Sim - R$ 1.234,50"
  );
  assert.equal(
    formatReceiveDetailValue({
      cr40f_receber: false,
      cr40f_valor_a_receber: 1234.5,
      "cr40f_receber@OData.Community.Display.V1.FormattedValue": "Não"
    }),
    "Não"
  );
  assert.equal(
    formatReceiveDetailValue({
      cr40f_receber: true,
      cr40f_valor_a_receber: 0,
      "cr40f_receber@OData.Community.Display.V1.FormattedValue": "Sim"
    }),
    "Sim"
  );
});

test("identidade bloqueia email Microsoft duplicado entre funcionarios ativos", async () => {
  const userId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const previousWindow = (globalThis as any).window;
  let funcionariosQuery = "";
  const windowMock: any = {
    location: { hostname: "org.crm2.dynamics.com" },
    Xrm: {
      Utility: {
        getGlobalContext: () => ({
          userSettings: { userId },
          getClientUrl: () => "https://org.crm2.dynamics.com"
        })
      },
      WebApi: {
        retrieveRecord: async () => ({ internalemailaddress: "duplicado@betinhos.com.br", fullname: "Duplicado" }),
        retrieveMultipleRecords: async (_entityName: string, options: string) => {
          funcionariosQuery = options;
          return {
            entities: [
              { cr40f_funcionariosid: "11111111-1111-1111-1111-111111111111" },
              { cr40f_funcionariosid: "22222222-2222-2222-2222-222222222222" }
            ]
          };
        }
      }
    }
  };
  windowMock.parent = windowMock;
  (globalThis as any).window = windowMock;

  try {
    await assert.rejects(getDriverContext(), /Mais de um funcionario ativo usa o mesmo Email Microsoft/);
    assert.match(funcionariosQuery, /cr40f_emailmicrosoft eq 'duplicado@betinhos\.com\.br'/);
    assert.match(funcionariosQuery, /statecode eq 0/);
    assert.match(funcionariosQuery, /cr40f_datadedemissao eq null/);
  } finally {
    (globalThis as any).window = previousWindow;
  }
});

test("solicitacao de manutencao monta apenas campos de requisicao", () => {
  const record = buildMaintenanceRequestRecord({
    descricao: "Barulho ao frear",
    kmAtual: 58230,
    veiculoId: "{11111111-1111-1111-1111-111111111111}",
    motoristaId: "{22222222-2222-2222-2222-222222222222}",
    gravidade: 3,
    comentario: "Prioridade media"
  });

  assert.equal(record.cr40f_descricao, "Barulho ao frear");
  assert.equal(record.cr40f_kmatual, 58230);
  assert.equal(record["cr40f_Placa_Carro@odata.bind"], "/cr40f_veiculoses(11111111-1111-1111-1111-111111111111)");
  assert.equal(record["cr40f_Solicitado_por@odata.bind"], "/cr40f_funcionarioses(22222222-2222-2222-2222-222222222222)");
  assert.equal(record.cr40f_graudamanutencao, 3);
  assert.equal(record.cr40f_comentariosaomotorista, "Prioridade media");
  assert.equal("cr40f_foto01" in record, false);
  assert.equal("cr40f_linkdaevidencia" in record, false);
  assert.equal("cr40f_foto03" in record, false);
  assert.equal("cr40f_servicorealizado" in record, false);
  assert.equal("cr40f_valor" in record, false);
  assert.equal("cr40f_estabelecimento" in record, false);
  assert.equal("cr40f_Realizado_por_nome@odata.bind" in record, false);
  assert.equal("new_linkdanotafiscal" in record, false);
});

test("solicitacao de manutencao exige descricao km veiculo e motorista", () => {
  assert.throws(
    () => buildMaintenanceRequestRecord({ descricao: "", kmAtual: 1, veiculoId: "1", motoristaId: "2", gravidade: 1 }),
    /Descricao da manutencao e obrigatoria/
  );
  assert.throws(
    () => buildMaintenanceRequestRecord({ descricao: "Falha", kmAtual: 0, veiculoId: "1", motoristaId: "2", gravidade: 1 }),
    /Km atual deve ser maior que zero/
  );
  assert.throws(
    () => buildMaintenanceRequestRecord({ descricao: "Falha", kmAtual: 1, veiculoId: "", motoristaId: "2", gravidade: 1 }),
    /Veiculo atual nao encontrado/
  );
  assert.throws(
    () => buildMaintenanceRequestRecord({ descricao: "Falha", kmAtual: 1, veiculoId: "1", motoristaId: "", gravidade: 1 }),
    /Motorista logado nao encontrado/
  );
});

test("consulta de veiculos da manutencao filtra ativos proprios sem quebrar select", () => {
  const query = buildMaintenanceRequestVehiclesQuery({ onlyOwnCategory: true });
  const params = new URLSearchParams(query);

  assert.equal(params.get("$select")?.includes("&$filter"), false);
  assert.equal(params.get("$select")?.includes("cr40f_statusdoveiculo"), true);
  assert.equal(params.get("$select")?.includes("new_categoriadoveiculo"), true);
  assert.equal(params.get("$select")?.includes("statecode"), true);
  assert.equal(params.get("$select")?.includes("statuscode"), true);
  assert.equal(
    params.get("$filter"),
    "cr40f_statusdoveiculo eq 202410001 and new_categoriadoveiculo eq 100000000"
  );
  assert.equal(params.get("$orderby"), "cr40f_placa asc");
  assert.equal(params.get("$top"), "200");
});

test("consulta de veiculos para colisoes filtra apenas ativos sem restringir categoria", () => {
  const query = buildMaintenanceRequestVehiclesQuery({ activeOnly: true });
  const params = new URLSearchParams(query);

  assert.equal(params.get("$select")?.includes("cr40f_statusdoveiculo"), true);
  assert.equal(
    params.get("$filter"),
    "cr40f_statusdoveiculo eq 202410001"
  );
  assert.equal(params.get("$filter")?.includes("new_categoriadoveiculo"), false);
  assert.equal(params.get("$orderby"), "cr40f_placa asc");
  assert.equal(params.get("$top"), "200");
});

test("fallback de veiculos da manutencao busca veiculo atual ou atribuido ao motorista", () => {
  const query = buildMaintenanceRequestAssignedVehiclesQuery({
    id: "{22222222-2222-2222-2222-222222222222}",
    email: "motorista@betinhos.com.br",
    fullName: "Motorista Teste",
    funcionario: {
      _cr40f_veiculoatual_value: "{11111111-1111-1111-1111-111111111111}"
    }
  });
  const params = new URLSearchParams(query);

  assert.equal(params.get("$select")?.includes("new_categoriadoveiculo"), true);
  assert.equal(
    params.get("$filter"),
    "statecode eq 0 and statuscode eq 1 and cr40f_statusdoveiculo eq 202410001 and (_cr40f_motoristaatual_value eq 22222222-2222-2222-2222-222222222222 or cr40f_veiculosid eq 11111111-1111-1111-1111-111111111111)"
  );
  assert.equal(params.get("$top"), "20");
});

test("patch automatico de veiculo da geral respeita origem manual", () => {
  const patch = buildAutomaticServiceVehiclePatch(
    {
      new_origemveiculo: SERVICE_VEHICLE_ORIGIN.manual,
      _cr40f_veiculo_value: "{11111111-1111-1111-1111-111111111111}"
    },
    "{22222222-2222-2222-2222-222222222222}"
  );

  assert.deepEqual(patch, {});
});

test("patch automatico de veiculo da geral atualiza lookup e origem", () => {
  const patch = buildAutomaticServiceVehiclePatch(
    {
      new_origemveiculo: SERVICE_VEHICLE_ORIGIN.automatico,
      _cr40f_veiculo_value: "{11111111-1111-1111-1111-111111111111}"
    },
    "{22222222-2222-2222-2222-222222222222}"
  );

  assert.equal(patch.new_origemveiculo, SERVICE_VEHICLE_ORIGIN.automatico);
  assert.equal(
    patch["cr40f_Veiculo@odata.bind"],
    "/cr40f_veiculoses(22222222-2222-2222-2222-222222222222)"
  );
});

test("troca entre motoristas fecha somente quando os dois confirmam", () => {
  const waiting = getExchangeCompletionState(
    {
      new_tipodetroca: 100000000,
      new_concluidomotorista1: false,
      new_concluidomotorista2: false
    },
    true,
    false
  );

  assert.equal(waiting.driver1Done, true);
  assert.equal(waiting.driver2Done, false);
  assert.equal(waiting.closesExchange, false);

  const closing = getExchangeCompletionState(
    {
      new_tipodetroca: 100000000,
      new_concluidomotorista1: false,
      new_concluidomotorista2: true
    },
    true,
    false
  );

  assert.equal(closing.closesExchange, true);
});

test("troca com base fecha com confirmacao do motorista principal", () => {
  const retiradaBase = getExchangeCompletionState(
    {
      new_tipodetroca: 100000002,
      new_concluidomotorista1: false,
      new_concluidomotorista2: false
    },
    true,
    false
  );

  assert.equal(retiradaBase.baseExchange, true);
  assert.equal(retiradaBase.driver1Done, true);
  assert.equal(retiradaBase.driver2Done, false);
  assert.equal(retiradaBase.closesExchange, true);

  const devolucaoBase = getExchangeCompletionState(
    {
      new_tipodetroca: 100000001,
      new_concluidomotorista1: false,
      new_concluidomotorista2: false
    },
    true,
    false
  );

  assert.equal(devolucaoBase.baseExchange, true);
  assert.equal(devolucaoBase.closesExchange, true);
});

test("app grava somente a confirmacao e deixa a transacao de posse para o plugin", async () => {
  const userId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const driverId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const exchangeId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
  const commands: any[] = [];
  let rejectCommand = false;

  const previousWindow = (globalThis as any).window;
  const windowMock: any = {
    location: { hostname: "org.crm2.dynamics.com" },
    fetch: async () => {
      throw new Error("O app nao deve executar lote nem gravar posse diretamente.");
    },
    Xrm: {
      Utility: {
        getGlobalContext: () => ({
          userSettings: { userId },
          getClientUrl: () => "https://org.crm2.dynamics.com"
        })
      },
      WebApi: {
        retrieveRecord: async (entityName: string) => {
          if (entityName === "systemuser") return { internalemailaddress: "driver@betinhos.com.br", fullname: "Driver" };
          if (entityName === "cr40f_trocasdecarro") {
            return {
              cr40f_trocasdecarroid: exchangeId,
              cr40f_id: "OT-1",
              cr40f_statusdatroca: 202410000,
              new_tipodetroca: 100000002,
              _cr40f_motorista1_value: driverId,
              "@odata.etag": 'W/"42"'
            };
          }
          throw new Error(`retrieveRecord inesperado: ${entityName}`);
        },
        retrieveMultipleRecords: async (entityName: string, options = "") => {
          if (entityName === "cr40f_funcionarios") {
            return {
              entities: [
                {
                  cr40f_funcionariosid: driverId,
                  cr40f_nomecompleto: "Driver",
                  cr40f_emailmicrosoft: "driver@betinhos.com.br"
                }
              ]
            };
          }
          throw new Error(`retrieveMultipleRecords inesperado: ${entityName}`);
        },
        updateRecord: async () => { throw new Error("O app não deve alterar flags diretamente."); },
        online: {
          execute: async function (this: any, request: any) {
            if (this !== windowMock.Xrm.WebApi.online) throw new Error("execute chamado sem o contexto WebApi.online");
            if (rejectCommand) throw new Error("[POSSESSION_CHAIN_GAP] Posse divergente detectada pelo plugin.");
            commands.push(request);
            return {};
          }
        },
        createRecord: async () => ({ id: "11111111-1111-1111-1111-111111111111" })
      }
    }
  };
  windowMock.parent = windowMock;
  (globalThis as any).window = windowMock;

  try {
    await finalizeExchangeRemote({
      detail: {
        type: "TROCA",
        id: "OT-1",
        title: "Retirada",
        fields: [],
        actions: [],
        dataverse: {
          entitySetName: "cr40f_trocasdecarros",
          id: exchangeId,
          record: {}
        }
      },
      fields: {}
    });
    rejectCommand = true;
    await assert.rejects(
      finalizeExchangeRemote({
        detail: {
          type: "TROCA",
          id: "OT-1",
          title: "Retirada",
          fields: [],
          actions: [],
          dataverse: {
            entitySetName: "cr40f_trocasdecarros",
            id: exchangeId,
            record: {}
          }
        },
        fields: {}
      }),
      /POSSESSION_CHAIN_GAP/
    );
  } finally {
    (globalThis as any).window = previousWindow;
  }

  assert.equal(commands.length, 1);
  assert.equal(commands[0].new_Motivo, "Sem observação.");
  assert.equal(commands[0].new_VersaoEsperada, "42");
  assert.equal(commands[0].getMetadata().operationName, "new_ConfirmarTrocaMotorista");
});

test("troca aberta aparece para motorista da troca sem depender da Geral", () => {
  assert.equal(
    shouldShowOpenExchangeForDriver(
      {
        _cr40f_motorista1_value: "driver-1",
        _cr40f_motorista2_value: "driver-2",
        cr40f_statusdatroca: 202410000,
        new_concluidomotorista1: false,
        new_concluidomotorista2: false
      },
      "driver-2"
    ),
    true
  );
});

test("troca aberta nao aparece quando motorista logado ja concluiu sua parte", () => {
  assert.equal(
    shouldShowOpenExchangeForDriver(
      {
        _cr40f_motorista1_value: "driver-1",
        _cr40f_motorista2_value: "driver-2",
        cr40f_statusdatroca: 202410000,
        new_concluidomotorista1: false,
        new_concluidomotorista2: true
      },
      "driver-2"
    ),
    false
  );
});

test("troca confirmada fica oculta do motorista", () => {
  assert.equal(
    shouldShowOpenExchangeForDriver(
      {
        _cr40f_motorista1_value: "driver-1",
        _cr40f_motorista2_value: "driver-2",
        cr40f_statusdatroca: 100000001,
        new_concluidomotorista1: false,
        new_concluidomotorista2: false
      },
      "driver-2"
    ),
    false
  );
});

test("troca aberta nao aparece quando status e Concluida", () => {
  assert.equal(
    shouldShowOpenExchangeForDriver(
      {
        _cr40f_motorista1_value: "driver-1",
        _cr40f_motorista2_value: "driver-2",
        cr40f_statusdatroca: 202410002,
        new_concluidomotorista1: false,
        new_concluidomotorista2: false
      },
      "driver-2"
    ),
    false
  );
});

test("descricao da troca entre motoristas usa perspectiva do motorista logado", () => {
  const display = buildExchangeDisplay(
    {
      new_tipodetroca: 100000000,
      cr40f_iniciodajaneladetroca: "2026-06-03T11:00:45",
      cr40f_fimdajaneladetroca: "2026-06-03T12:00:30",
      _cr40f_motorista1_value: "driver-1",
      "_cr40f_motorista1_value@OData.Community.Display.V1.FormattedValue": "Ana",
      _cr40f_motorista2_value: "driver-2",
      "_cr40f_motorista2_value@OData.Community.Display.V1.FormattedValue": "Bruno",
      "_cr40f_veiculo1antesdatroca_value@OData.Community.Display.V1.FormattedValue": "ABC1D23",
      "_cr40f_veiculo2antesdatroca_value@OData.Community.Display.V1.FormattedValue": "XYZ9A87",
      __cr40f_veiculo1antesdatrocaLabel: "Corolla Preto - ABC1D23",
      __cr40f_veiculo2antesdatrocaLabel: "Civic Prata - XYZ9A87"
    },
    { id: "driver-1", email: "", fullName: "Ana", funcionario: {} }
  );

  assert.equal(display.label, "Troca entre Motoristas");
  assert.match(display.description, /Entregar Corolla Preto - ABC1D23/);
  assert.match(display.description, /receber Civic Prata - XYZ9A87/);
  assert.match(display.summary, /Bruno/);
  assert.match(display.window, /11:00 - 12:00/);
  assert.doesNotMatch(display.window, /:\d{2}:/);
});

test("transferencia para motorista sem veiculo nao inventa entrega ou recebimento", () => {
  const exchange = {
    new_tipodetroca: 100000000,
    _cr40f_motorista1_value: "driver-1",
    "_cr40f_motorista1_value@OData.Community.Display.V1.FormattedValue": "Ana",
    _cr40f_motorista2_value: "driver-2",
    "_cr40f_motorista2_value@OData.Community.Display.V1.FormattedValue": "Bruno",
    __cr40f_veiculo1antesdatrocaLabel: "Corolla Preto - ABC1D23"
  };

  const giver = buildExchangeDisplay(exchange, { id: "driver-1", email: "", fullName: "Ana", funcionario: {} });
  const receiver = buildExchangeDisplay(exchange, { id: "driver-2", email: "", fullName: "Bruno", funcionario: {} });

  assert.match(giver.description, /Entregar Corolla Preto - ABC1D23 para Bruno/);
  assert.doesNotMatch(giver.description, /receber Não informado/);
  assert.match(receiver.description, /Receber Corolla Preto - ABC1D23 de Ana/);
  assert.doesNotMatch(receiver.description, /Entregar Não informado/);
});

test("detalhe da troca expoe telefone clicavel do outro motorista", () => {
  const display = buildExchangeDisplay(
    {
      new_tipodetroca: 100000000,
      _cr40f_motorista1_value: "driver-1",
      "_cr40f_motorista1_value@OData.Community.Display.V1.FormattedValue": "Ana",
      _cr40f_motorista2_value: "driver-2",
      "_cr40f_motorista2_value@OData.Community.Display.V1.FormattedValue": "Bruno",
      __otherDriverPhone: "+55 (12) 98888-7777"
    },
    { id: "driver-1", email: "", fullName: "Ana", funcionario: {} }
  );

  const phoneField = display.fields.find((field) => field.label === "Telefone do motorista");
  assert.equal(phoneField?.value, "+55 (12) 98888-7777");
  assert.equal(phoneField?.contact?.phone, "+55 (12) 98888-7777");
});

test("descricao de retirada e devolucao na base usa acao certa", () => {
  const retirada = buildExchangeDisplay(
    {
      new_tipodetroca: 100000002,
      _cr40f_motorista1_value: "driver-1",
      "_cr40f_motorista1_value@OData.Community.Display.V1.FormattedValue": "Ana",
      "_cr40f_veiculo2antesdatroca_value@OData.Community.Display.V1.FormattedValue": "Civic XYZ9A87"
    },
    { id: "driver-1", email: "", fullName: "Ana", funcionario: {} }
  );

  assert.equal(retirada.label, "Retirada na Base");
  assert.match(retirada.description, /Retirar Civic XYZ9A87/);
  assert.equal(retirada.fields.some((field) => field.label === "Você recebe" && field.value === "Civic XYZ9A87"), true);

  const devolucao = buildExchangeDisplay(
    {
      new_tipodetroca: 100000001,
      _cr40f_motorista1_value: "driver-1",
      "_cr40f_motorista1_value@OData.Community.Display.V1.FormattedValue": "Ana",
      "_cr40f_veiculo1antesdatroca_value@OData.Community.Display.V1.FormattedValue": "Corolla ABC1D23"
    },
    { id: "driver-1", email: "", fullName: "Ana", funcionario: {} }
  );

  assert.match(devolucao.label, /Base/);
  assert.match(devolucao.description, /Devolver Corolla ABC1D23/);
  assert.equal(devolucao.fields.some((field) => field.label === "Você entrega" && field.value === "Corolla ABC1D23"), true);
});

test("identificador de recibo usa padrao R-XXXX", () => {
  assert.equal(normalizeReceiptIdentifier("12"), "R-0012");
  assert.equal(normalizeReceiptIdentifier("R-7"), "R-0007");
  assert.equal(normalizeReceiptIdentifier("R--123"), "R-0123");
  assert.equal(normalizeReceiptIdentifier("000123"), "R-000123");
});

test("conteudo de email do recibo segue idioma sem traduzir empresa", () => {
  const baseModel = {
    idOp: "OP-1",
    nomePagante: "Renan",
    cliente: "Cliente",
    idPag: "R-0123",
    dataEmissao: "23/06/2026",
    metodoPagamento: "Cartão de Crédito",
    periodo: "23/06/2026 10:00",
    trajetos: "A -> B",
    valorTotal: "R$ 12,00",
    observacoes: "-"
  };

  const pt = buildReceiptEmailContent({ ...baseModel, idioma: "pt-BR" });
  assert.equal(pt.subject, "Recibo - R-0123 | Betinhos Executive Service");
  assert.match(pt.body, /Prezado\(a\) Renan/);
  assert.match(pt.body, /serviços prestados de transporte executivo no Brasil/);
  assert.match(pt.body, /Betinhos Executive Service$/);

  const en = buildReceiptEmailContent({ ...baseModel, idioma: "en-US" });
  assert.equal(en.subject, "Receipt - R-0123 | Betinhos Executive Service");
  assert.match(en.body, /Dear Renan/);
  assert.match(en.body, /executive transportation services provided in Brazil/);
  assert.match(en.body, /Betinhos Executive Service$/);

  const es = buildReceiptEmailContent({ ...baseModel, idioma: "es-ES" });
  assert.equal(es.subject, "Recibo - R-0123 | Betinhos Executive Service");
  assert.match(es.body, /Estimado\(a\) Renan/);
  assert.match(es.body, /transporte ejecutivo en Brasil/);
  assert.match(es.body, /Betinhos Executive Service$/);
});
