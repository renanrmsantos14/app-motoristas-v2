import assert from "node:assert/strict";
import test from "node:test";
import { APP_CONNECTION_LOST_MESSAGE, APP_OPERATION_ERROR_MESSAGE, flushAppErrorLogQueue, reportAppError, redactSensitiveLogValue } from "../src/lib/appErrorLogger.ts";

test("mensagem de erro operacional orienta fechar e reabrir o aplicativo", () => {
  assert.match(APP_OPERATION_ERROR_MESSAGE, /Feche e reabra o aplicativo/);
});

test("mensagem de conexão perdida orienta fechar e reabrir o aplicativo", () => {
  assert.match(APP_CONNECTION_LOST_MESSAGE, /conexão com a internet foi perdida/i);
});

test("redactSensitiveLogValue remove dados sensiveis de strings", () => {
  const value = redactSensitiveLogValue(
    "Enviar para joao.silva@contoso.com tel +55 (11) 98765-4321 url https://contoso.sharepoint.com/sites/app/arquivo.jpg?sig=abc data:image/png;base64,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
  );

  assert.equal(String(value).includes("joao.silva@contoso.com"), false);
  assert.equal(String(value).includes("98765-4321"), false);
  assert.equal(String(value).includes("sig=abc"), false);
  assert.equal(String(value).includes("AAAAAAAAAAAAAAAAAAAAAAAA"), false);
  assert.equal(String(value).includes("[redacted-email]"), true);
  assert.equal(String(value).includes("[redacted-phone]"), true);
  assert.equal(String(value).includes("[redacted-url]"), true);
  assert.equal(String(value).includes("[redacted-base64]"), true);
});

test("redactSensitiveLogValue remove campos sensiveis por chave", () => {
  const value = redactSensitiveLogValue({
    nome: "Manutencao 123",
    conteudoBase64: "ABC",
    telefonePassageiro: "11987654321",
    anexos: [{ foto: "data:image/jpeg;base64,ABC" }]
  });

  assert.deepEqual(value, {
    nome: "Manutencao 123",
    conteudoBase64: "[redacted]",
    telefonePassageiro: "[redacted]",
    anexos: [{ foto: "[redacted]" }]
  });
});

test("redactSensitiveLogValue preserva codigos operacionais de oito e nove digitos", () => {
  assert.equal(redactSensitiveLogValue("OT 202410001 e código 12345678"), "OT 202410001 e código 12345678");
});

test("logger conserva erros internos, contexto e fila concorrente sem depender do armazenamento", async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const created: Record<string, unknown>[] = [];
  const writes = new Map<string, string>();
  let unavailable = true;
  let storageUnavailable = true;
  let releaseFirst: (() => void) | undefined;
  let blockFirst = false;
  const runtime = {
    navigator: { onLine: true },
    setTimeout: () => 1,
    Xrm: { WebApi: { createRecord: async (table: string, record: Record<string, unknown>) => {
      assert.equal(table, "new_appmotoristaslog");
      if (unavailable) throw new Error("Acesso negado ao criar log.");
      if (blockFirst) {
        blockFirst = false;
        await new Promise<void>((resolve) => { releaseFirst = resolve; });
      }
      created.push(record);
      return { id: String(created.length) };
    } } }
  };
  const settle = async () => { for (let index = 0; index < 12; index++) await new Promise<void>((resolve) => setImmediate(resolve)); };
  Object.defineProperty(globalThis, "window", { configurable: true, value: runtime });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => writes.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (storageUnavailable) throw new Error("QuotaExceededError");
      writes.set(key, value);
    }
  } });
  try {
    const internal = Object.assign(new Error("Falha interna em tabela"), { code: "0x80040220" });
    reportAppError(Object.assign(new Error("Falha na operação"), { cause: internal }), {
      action: "assinarComunicado", phase: "execute", screen: "Comunicados", detailId: "recipient-1",
      payload: { authorization: "Bearer sensitive", observacaoLength: 12 }, notifyUser: false
    });
    await settle();
    // Mais de 50 eventos devem sobreviver à falha de localStorage.
    for (let index = 0; index < 55; index++) reportAppError(new Error(`Erro ${index}`), { notifyUser: false });
    await settle();
    unavailable = false;
    blockFirst = true;
    const flushing = flushAppErrorLogQueue();
    await settle();
    assert.ok(releaseFirst);
    storageUnavailable = false;
    reportAppError(new Error("Chegou durante o reenvio"), { notifyUser: false });
    await settle();
    assert.equal(JSON.parse(writes.get("app-motoristas-error-log-queue-v1") ?? "[]").length, 57);
    releaseFirst();
    await flushing;
    await flushAppErrorLogQueue();
    assert.equal(created.length, 57);
    assert.equal(created[0].new_errorcode, "0x80040220");
    assert.equal(created[0].new_action, "assinarComunicado");
    assert.equal(created[0].new_detailid, "recipient-1");
    assert.match(String(created[0].new_rawjson), /Falha interna em tabela/);
    const diagnostic = JSON.parse(String(created[0].new_payloadjson));
    assert.ok(diagnostic.eventId);
    assert.equal(diagnostic.occurredAt, created[0].new_occurredat);
    assert.ok(diagnostic.delivery.attempts >= 1);
    assert.equal(diagnostic.payload.authorization, "[redacted]");
    assert.equal(created[56].new_message, "Chegou durante o reenvio");
    await flushAppErrorLogQueue();
    assert.equal(created.length, 57, "Não reenviar registros já confirmados.");
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (previousStorage) Object.defineProperty(globalThis, "localStorage", previousStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("redação remove credenciais em texto e em erros internos", () => {
  const error = Object.assign(new Error("Authorization=Bearer-secret token=abc senha=xyz"), {
    cause: Object.assign(new Error("Falha interna"), { access_token: "secret" })
  });
  const redacted = JSON.stringify(redactSensitiveLogValue(error));
  assert.equal(redacted.includes("Bearer-secret"), false);
  assert.equal(redacted.includes("token=abc"), false);
  assert.equal(redacted.includes("senha=xyz"), false);
  assert.match(redacted, /Falha interna/);
  assert.equal(redacted.includes('"access_token":"secret"'), false);
});
