import assert from "node:assert/strict";
import test from "node:test";
import { loadRemoteStore } from "../src/lib/dataverse.ts";

test("carga pagina todas as consultas com no maximo quatro leituras simultaneas", async () => {
  const previousWindow = (globalThis as any).window;
  let active = 0;
  let maximum = 0;
  let dataCalls = 0;
  let secondPage = 0;
  const runtime: any = {
    location: { hostname: "org.crm2.dynamics.com" },
    Xrm: {
      Utility: { getGlobalContext: () => ({ userSettings: { userId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" } }) },
      WebApi: {
        retrieveRecord: async () => ({ internalemailaddress: "driver@betinhos.com.br" }),
        retrieveMultipleRecords: async (entity: string, options: string) => {
          if (entity === "cr40f_funcionarios") return { entities: [{
            cr40f_funcionariosid: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            cr40f_emailmicrosoft: "driver@betinhos.com.br",
            cr40f_nomecompleto: "Motorista"
          }] };
          const callNumber = ++dataCalls;
          active += 1;
          maximum = Math.max(maximum, active);
          await new Promise((resolve) => setTimeout(resolve, 3));
          active -= 1;
          if (options.includes("page=2")) secondPage += 1;
          const nextLink = options.includes("page=2") || callNumber !== 1 ? undefined : "https://org.crm2.dynamics.com/api/data/v9.2/cr40f_reservadeveculoses?page=2";
          return { entities: [], nextLink };
        }
      }
    }
  };
  runtime.parent = runtime;
  (globalThis as any).window = runtime;

  try {
    const result = await loadRemoteStore();
    assert.deepEqual(result.agenda, []);
    assert.deepEqual(result.history, []);
    assert.equal(dataCalls, 9);
    assert.equal(secondPage, 1);
    assert.equal(maximum, 4);
  } finally {
    (globalThis as any).window = previousWindow;
  }
});
