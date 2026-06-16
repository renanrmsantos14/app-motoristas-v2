import assert from "node:assert/strict";
import test from "node:test";
import { buildReceiptSvgDataUrlFromMarkup, buildReceiptSvgMarkup } from "../src/lib/receiptSvg.ts";
import type { PersonalReceiptModel } from "../src/lib/personalReceipt.ts";

const model: PersonalReceiptModel = {
  idOp: "OP-999",
  nomePagante: "Cliente de Teste",
  cliente: "Betinhos",
  idPag: "PAG-TESTE",
  dataEmissao: "16/06/2026",
  metodoPagamento: "PIX",
  periodo: "16/06/2026 08:30",
  trajetos: "Hotel -> Aeroporto\nAeroporto -> Hotel",
  valorTotal: "R$ 500,00",
  observacoes: "Linha um.\nLinha dois."
};

const assets = {
  logoB: "data:image/png;base64,AAA",
  logoPreta: "data:image/png;base64,BBB",
  nlaLogo: "data:image/png;base64,CCC",
  qrCode: "data:image/png;base64,DDD"
};

test("buildReceiptSvgMarkup inclui campos variaveis e preserva quebras em trajetos e observacoes", () => {
  const svg = buildReceiptSvgMarkup(model, assets);

  assert.match(svg, /Cliente de Teste/);
  assert.match(svg, /Betinhos/);
  assert.match(svg, /PAG-TESTE/);
  assert.match(svg, /Hotel -&gt; Aeroporto/);
  assert.match(svg, /Aeroporto -&gt; Hotel/);
  assert.match(svg, /Linha um\./);
  assert.match(svg, /Linha dois\./);
  assert.match(svg, /data:image\/png;base64,AAA/);
});

test("buildReceiptSvgDataUrlFromMarkup converte svg para data url utilizavel no preview", () => {
  const svg = buildReceiptSvgMarkup(model, assets);
  const dataUrl = buildReceiptSvgDataUrlFromMarkup(svg);

  assert.ok(dataUrl.startsWith("data:image/svg+xml;charset=utf-8,"));
  assert.ok(dataUrl.includes(encodeURIComponent("Cliente de Teste")));
});
