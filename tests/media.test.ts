import assert from "node:assert/strict";
import test from "node:test";
import { dataUrlToBase64, formatVideoDuration, readBlobAsDataUrl } from "../src/lib/photoOrientation.ts";

test("readBlobAsDataUrl gera Data URL de video com base64 decodificavel", async () => {
  const dataUrl = await readBlobAsDataUrl(new Blob([new Uint8Array([0, 1, 2, 253, 254, 255])], { type: "video/webm" }));
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);

  assert.equal(dataUrl.startsWith("data:video/webm;base64,"), true);
  assert.equal(base64.includes("data:"), false);
  assert.deepEqual(Array.from(Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))), [0, 1, 2, 253, 254, 255]);
});

test("dataUrlToBase64 preserva video com codecs que possuem virgula", () => {
  const base64 = dataUrlToBase64("data:video/webm;codecs=vp8,opus;base64,QUJDRA==");

  assert.equal(base64, "QUJDRA==");
  assert.equal(base64.includes("opus;base64"), false);
});

test("formatVideoDuration gera badge compacto", () => {
  assert.equal(formatVideoDuration(4.9), "0:04");
  assert.equal(formatVideoDuration(72), "1:12");
  assert.equal(formatVideoDuration(3725), "1:02:05");
});
