import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("manifestos registram bloqueio PreValidation para Create de troca", () => {
  for (const path of [
    "../scripts/register-driver-record-sharing-plugin-webapi.ps1",
    "../scripts/register-driver-record-sharing-plugin.ps1",
    "../scripts/validate-driver-record-sharing-plugin.ps1"
  ]) {
    assert.match(read(path), /Trocas de carro Create PreValidation/);
  }
});

test("app motorista não oferece cancelamento para troca", () => {
  const dataverse = read("../src/lib/dataverse.ts");
  const exchangeMapper = dataverse.slice(dataverse.indexOf("function mapExchange"), dataverse.indexOf("function compareAgenda"));
  assert.match(exchangeMapper, /actions:\s*\["finalizar"\]/);
  assert.doesNotMatch(exchangeMapper, /actions:\s*\["cancel"/);
});

test("handler de atualização não aceita mudança estrutural", () => {
  const handler = read("../plugins/DriverRecordSharing/ExchangeLifecycleCommandHandler.cs");
  const update = handler.slice(handler.indexOf("private void UpdateExchange"), handler.indexOf("private void Register"));
  assert.doesNotMatch(update, /new_Tipo|new_Motorista|new_Veiculo/);
  assert.match(update, /ExchangeObservation/);
});
