import assert from "node:assert/strict";
import test from "node:test";
import { validateMaintenanceFinalizeFields } from "../src/lib/maintenanceFinalize.ts";

test("finalizacao de manutencao exige cidade alem de campos e fotos", () => {
  const errors = validateMaintenanceFinalizeFields({
    serviceDone: "Troca de pastilhas",
    value: "480,00",
    payment: "Pix",
    cidadeId: "",
    validCityIds: new Set(["city-sjc"]),
    establishment: "Auto Center",
    confirmedPhotos: ["NOTAFISCAL", "FOTO1"]
  });

  assert.deepEqual(errors, {
    cidadeId: "Selecione a cidade."
  });
});

test("finalizacao de manutencao valida conjunto completo", () => {
  const errors = validateMaintenanceFinalizeFields({
    serviceDone: "Troca de pastilhas",
    value: "480,00",
    payment: "Pix",
    cidadeId: "city-sjc",
    validCityIds: new Set(["city-sjc"]),
    establishment: "Auto Center",
    confirmedPhotos: ["NOTAFISCAL", "FOTO1"]
  });

  assert.deepEqual(errors, {});
});
