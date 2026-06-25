import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMaintenanceRequestAssignedVehiclesQuery,
  buildMaintenanceRequestRecord,
  buildMaintenanceRequestVehiclesQuery,
  buildReceiptEmailContent,
  normalizeReceiptIdentifier
} from "../src/lib/dataverse.ts";

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
