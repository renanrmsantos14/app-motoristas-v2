import assert from "node:assert/strict";
import test from "node:test";
import { createRemoteReadBatch } from "../src/lib/remoteReadBatch.ts";

test("limita leituras simultaneas a quatro sem alterar a ordem dos resultados", async () => {
  const batch = createRemoteReadBatch();
  let active = 0;
  let maximum = 0;
  const results = await Promise.all(Array.from({ length: 9 }, (_, index) => batch.run(async () => {
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 3));
    active -= 1;
    return index;
  })));
  assert.equal(maximum, 4);
  assert.deepEqual(results, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
});

test("reutiliza leitura identica apenas na mesma carga e tenta de novo apos erro", async () => {
  const batch = createRemoteReadBatch();
  let calls = 0;
  const read = () => batch.once("passageiro:id:select", async () => ++calls);
  assert.deepEqual(await Promise.all([read(), read()]), [1, 1]);
  assert.equal(await read(), 1);
  assert.equal(await createRemoteReadBatch().once("passageiro:id:select", async () => ++calls), 2);

  let attempts = 0;
  const unstable = () => batch.once("falha", async () => {
    if (++attempts === 1) throw new Error("rede");
    return "ok";
  });
  await assert.rejects(unstable(), /rede/);
  assert.equal(await unstable(), "ok");
});
