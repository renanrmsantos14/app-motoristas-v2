import assert from "node:assert/strict";
import test from "node:test";
import { parseSafeDetailHtml } from "../src/lib/detailHtml.ts";

test("parseSafeDetailHtml keeps text, breaks and safe http links", () => {
  const parts = parseSafeDetailHtml("Ana<br><a href=\"https://wa.me/5511999999999\">WhatsApp</a>");

  assert.deepEqual(parts, [
    { type: "text", value: "Ana" },
    { type: "break" },
    { type: "link", href: "https://wa.me/5511999999999", text: "WhatsApp" }
  ]);
});

test("parseSafeDetailHtml strips scripts and rejects unsafe href", () => {
  const parts = parseSafeDetailHtml("<img src=x onerror=alert(1)>Nome <a href=\"javascript:alert(1)\">clique</a><script>alert(2)</script>");

  assert.deepEqual(parts, [
    { type: "text", value: "Nome " },
    { type: "text", value: "clique" }
  ]);
});
