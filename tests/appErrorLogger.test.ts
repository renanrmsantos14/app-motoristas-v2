import assert from "node:assert/strict";
import test from "node:test";
import { redactSensitiveLogValue } from "../src/lib/appErrorLogger.ts";

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
