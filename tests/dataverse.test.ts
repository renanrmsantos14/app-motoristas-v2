import assert from "node:assert/strict";
import test from "node:test";
import { buildMaintenanceRequestRecord } from "../src/lib/dataverse.ts";

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
