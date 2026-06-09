import assert from "node:assert/strict";
import test from "node:test";
import { buildGoogleMapsSearchUrl, isConfidentMapAddress } from "../src/lib/mapLinks.ts";

test("gera Google Maps para campos de endereço confiáveis", () => {
  const address = "Rua Vitório Fasano, 88 - Jardins, São Paulo - SP";
  assert.equal(isConfidentMapAddress("Endereço de Saída", address), true);
  assert.equal(
    buildGoogleMapsSearchUrl("Endereço de Saída", address),
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
  );
});

test("gera Google Maps para destino com avenida e cidade", () => {
  assert.equal(isConfidentMapAddress("Destino", "Av. Brigadeiro Faria Lima, São Paulo - SP"), true);
});

test("não gera Google Maps para trajeto ou destino ambíguo", () => {
  assert.equal(buildGoogleMapsSearchUrl("Trajeto", "Hotel Unique -> Aeroporto de Viracopos"), "");
  assert.equal(buildGoogleMapsSearchUrl("Destino", "Reunião Faria Lima"), "");
  assert.equal(buildGoogleMapsSearchUrl("Endereço de Saída", "+55 (11) 95555-0101"), "");
});
