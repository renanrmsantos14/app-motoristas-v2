import assert from "node:assert/strict";
import test from "node:test";
import { getFieldValue, isBlankOrNotInformed } from "../src/lib/fieldLookup.ts";

test("getFieldValue resolves accented and unaccented labels", () => {
  assert.equal(getFieldValue({ "Horario Inicial": "08:00" }, "Hor\u00e1rio Inicial", "Horario Inicial"), "08:00");
  assert.equal(getFieldValue({ "Servi\u00e7o Realizado": "Troca de pneu" }, "Servico Realizado"), "Troca de pneu");
});

test("getFieldValue repairs legacy mojibake labels without hardcoded corrupted keys", () => {
  const fields = {
    ["Hor" + "\u00c3\u00a1" + "rio Inicial"]: "09:15",
    ["Observa" + "\u00c3\u00a7\u00c3\u00a3" + "o Final"]: "OK"
  };

  assert.equal(getFieldValue(fields, "Hor\u00e1rio Inicial"), "09:15");
  assert.equal(getFieldValue(fields, "Observa\u00e7\u00e3o Final"), "OK");
});

test("isBlankOrNotInformed normalizes legacy mojibake value", () => {
  assert.equal(isBlankOrNotInformed("N" + "\u00c3\u00a3" + "o informado"), true);
  assert.equal(isBlankOrNotInformed("Pix"), false);
});
