import assert from "node:assert/strict";
import test from "node:test";
import { createReceiptPdfCache } from "../src/lib/receiptPdfCache.ts";

test("clique durante antecipacao reutiliza a mesma geracao de PDF", async () => {
  let resolveFirst!: (blob: Blob) => void;
  let calls = 0;
  const cache = createReceiptPdfCache(async () => {
    calls += 1;
    return new Promise<Blob>((resolve) => { resolveFirst = resolve; });
  });
  const first = cache.get({ id: "R-1" });
  const click = cache.get({ id: "R-1" });
  assert.equal(first, click);
  await Promise.resolve();
  resolveFirst(new Blob(["pdf"]));
  assert.equal(await click, await cache.get({ id: "R-1" }));
  assert.equal(calls, 1);
});

test("mudanca de modelo ignora resultado antigo e falha permite nova tentativa", async () => {
  let finishOld!: (blob: Blob) => void;
  let attempts = 0;
  const cache = createReceiptPdfCache(async ({ id }: { id: string }) => {
    attempts += 1;
    if (id === "antigo") return new Promise<Blob>((resolve) => { finishOld = resolve; });
    if (attempts === 2) throw new Error("falha");
    return new Blob([id]);
  });
  const old = cache.get({ id: "antigo" });
  await Promise.resolve();
  await assert.rejects(cache.get({ id: "novo" }), /falha/);
  const latest = await cache.get({ id: "novo" });
  finishOld(new Blob(["antigo"]));
  await old;
  assert.equal(await cache.get({ id: "novo" }), latest);
  assert.equal(attempts, 3);
});
