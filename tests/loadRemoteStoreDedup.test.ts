import assert from "node:assert/strict";
import test from "node:test";
import { loadRemoteStore } from "../src/lib/dataverse.ts";

test("passageiro compartilhado entre agenda e historico e consultado uma vez por carga", async () => {
  const previousWindow = (globalThis as any).window;
  const previousLog = console.log;
  let passengerReads = 0;
  const passengerId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
  const service = (id: string) => ({
    cr40f_reservadeveculosid: id,
    cr40f_id: id,
    cr40f_dataehorriodesada: "2026-09-25T12:00:00Z",
    cr40f_trajeto: "Origem -> Destino",
    cr40f_status: 1
  });
  const runtime: any = {
    location: { hostname: "org.crm2.dynamics.com" },
    Xrm: {
      Utility: { getGlobalContext: () => ({ userSettings: { userId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" } }) },
      WebApi: {
        retrieveRecord: async (entity: string) => {
          if (entity === "systemuser") return { internalemailaddress: "driver@betinhos.com.br" };
          if (entity === "cr40f_bancodedados") {
            passengerReads += 1;
            return { cr40f_nomedopassageiro: "Passageiro", cr40f_telefone: "" };
          }
          throw new Error(`Leitura inesperada: ${entity}`);
        },
        retrieveMultipleRecords: async (entity: string, options: string) => {
          if (entity === "cr40f_funcionarios") return { entities: [{
            cr40f_funcionariosid: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            cr40f_emailmicrosoft: "driver@betinhos.com.br",
            cr40f_nomecompleto: "Motorista"
          }] };
          if (entity === "cr40f_servicosporpassageiro") return { entities: [{
            cr40f_servicosporpassageiroid: "dddddddd-dddd-dddd-dddd-dddddddddddd",
            _cr40f_bancodedados_value: passengerId
          }] };
          if (entity === "cr40f_reservadeveculos" && options.includes("_cr40f_om_value eq null")) {
            if (options.includes("cr40f_status ne")) return { entities: [service("11111111-1111-1111-1111-111111111111")] };
            if (options.includes("cr40f_status eq")) return { entities: [service("22222222-2222-2222-2222-222222222222")] };
          }
          return { entities: [] };
        }
      }
    }
  };
  runtime.parent = runtime;
  (globalThis as any).window = runtime;
  console.log = () => undefined;
  try {
    const first = await loadRemoteStore();
    assert.equal(first.agenda.some((item) => item.id.includes("11111111")), true);
    assert.equal(first.history.length > 0, true);
    assert.equal(passengerReads, 1);
    await loadRemoteStore();
    assert.equal(passengerReads, 2);
  } finally {
    console.log = previousLog;
    (globalThis as any).window = previousWindow;
  }
});
