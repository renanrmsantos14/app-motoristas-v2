import assert from "node:assert/strict";
import test from "node:test";
import { buildOneDrivePreviewCandidates, extractMaintenancePhotoUrls, isMaintenancePhotoPreviewField } from "../src/lib/detailMedia.ts";

test("detecta campos de foto de manutencao para preview", () => {
  assert.equal(isMaintenancePhotoPreviewField("Link Foto Solicitação 1", "https://contoso/image.jpg"), true);
  assert.equal(isMaintenancePhotoPreviewField("Link Foto Final 2", "https://contoso/foto.png"), true);
});

test("nao transforma outros links em preview de foto", () => {
  assert.equal(isMaintenancePhotoPreviewField("Link Nota Fiscal", "https://contoso/notafiscal.pdf"), false);
  assert.equal(isMaintenancePhotoPreviewField("Destino", "https://maps.google.com"), false);
  assert.equal(isMaintenancePhotoPreviewField("Link Foto Final 1", ""), false);
});

test("extrai multiplos links de foto e cria candidato de download", () => {
  const links = extractMaintenancePhotoUrls("Foto 1: https://contoso.sharepoint.com/:i:/s/site/a?e=abc\nFoto 2: https://contoso.sharepoint.com/:i:/s/site/b");
  assert.equal(links.length, 2);

  const candidates = buildOneDrivePreviewCandidates(links[0]);
  assert.equal(candidates[0], "https://contoso.sharepoint.com/:i:/s/site/a?e=abc");
  assert.equal(candidates[1], "https://contoso.sharepoint.com/:i:/s/site/a?e=abc&download=1");
});
