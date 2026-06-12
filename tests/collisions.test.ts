import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCollisionCreatePayload,
  buildCollisionWhatsAppUrl,
  createEmptyCollisionDraft,
  validateCollisionDraft,
  type CollisionDraft,
  type CollisionPhoto
} from "../src/lib/collisions.ts";

const photos: CollisionPhoto[] = [
  { id: "photo-1", kind: "cena", dataUrl: "data:image/jpeg;base64,aaa" },
  { id: "photo-2", kind: "danoBetinhos", dataUrl: "data:image/jpeg;base64,bbb" },
  { id: "photo-3", kind: "danoTerceiro", dataUrl: "data:image/jpeg;base64,ccc" },
  { id: "photo-4", kind: "documentoTerceiro", dataUrl: "data:image/jpeg;base64,ddd" }
];

function baseDraft(overrides: Partial<CollisionDraft> = {}): CollisionDraft {
  return {
    ...createEmptyCollisionDraft(new Date("2026-06-11T10:30:00-03:00")),
    tipoOcorrencia: "bateram_em_mim",
    local: "Av. Paulista, 1000",
    veiculoId: "vehicle-1",
    descricao: "Terceiro encostou no para-choque traseiro.",
    houveTerceiro: true,
    terceiroNome: "Carlos Silva",
    terceiroTelefone: "(11) 99999-8888",
    terceiroPlaca: "abc1d23",
    terceiroVeiculo: "Corolla prata",
    ...overrides
  };
}

test("validateCollisionDraft sem terceiro exige apenas dados base e fotos base", () => {
  const errors = validateCollisionDraft(createEmptyCollisionDraft(new Date("2026-06-11T10:30:00-03:00")), []);

  assert.equal(errors.tipoOcorrencia, "Informe o que aconteceu.");
  assert.equal(errors.local, "Informe o local.");
  assert.equal(errors.danoBetinhos, "Adicione foto: Veículos.");
  assert.equal(errors.cena, "Adicione foto: Local.");
  assert.equal(errors.terceiroNome, undefined);
  assert.equal(errors.danoTerceiro, undefined);
  assert.equal(errors.documentoTerceiro, undefined);
});

test("validateCollisionDraft com terceiro exige dados e fotos do terceiro", () => {
  const errors = validateCollisionDraft(
    createEmptyCollisionDraft(new Date("2026-06-11T10:30:00-03:00")),
    []
  );
  const thirdPartyErrors = validateCollisionDraft({ ...createEmptyCollisionDraft(new Date("2026-06-11T10:30:00-03:00")), houveTerceiro: true }, []);

  assert.equal(errors.terceiroNome, undefined);
  assert.equal(thirdPartyErrors.terceiroNome, "Informe o nome do terceiro.");
  assert.equal(thirdPartyErrors.terceiroPlaca, undefined);
  assert.equal(thirdPartyErrors.terceiroVeiculo, undefined);
  assert.equal(errors.danoTerceiro, undefined);
  assert.equal(thirdPartyErrors.danoTerceiro, "Adicione foto: CNH da pessoa.");
  assert.equal(thirdPartyErrors.documentoTerceiro, "Adicione foto: Documento do veículo da pessoa.");
});

test("validateCollisionDraft em Bateram em mim trata terceiro como obrigatorio", () => {
  const errors = validateCollisionDraft({ ...baseDraft({ houveTerceiro: false }), terceiroNome: "", terceiroTelefone: "" }, photos.slice(0, 2));

  assert.equal(errors.terceiroNome, "Informe o nome do terceiro.");
  assert.equal(errors.terceiroTelefone, "Informe o WhatsApp/telefone.");
  assert.equal(errors.danoTerceiro, "Adicione foto: CNH da pessoa.");
  assert.equal(errors.documentoTerceiro, "Adicione foto: Documento do veículo da pessoa.");
});

test("validateCollisionDraft nao exige KM severidade BO nem origem", () => {
  assert.deepEqual(validateCollisionDraft(baseDraft(), photos), {});
});

test("validateCollisionDraft aceita varias fotos no mesmo grupo de evidencia", () => {
  const multiPhotos: CollisionPhoto[] = [
    ...photos,
    { id: "photo-5", kind: "cena", dataUrl: "data:image/jpeg;base64,eee" },
    { id: "photo-6", kind: "danoBetinhos", dataUrl: "data:image/jpeg;base64,fff" }
  ];

  assert.deepEqual(validateCollisionDraft(baseDraft(), multiPhotos), {});
});

test("buildCollisionCreatePayload monta payload Dataverse com Local", () => {
  const payload = buildCollisionCreatePayload({
    draft: baseDraft({ tipoOcorrencia: "eu_bati" }),
    photos,
    motoristaId: "driver-1",
    veiculoId: "vehicle-1",
    motoristaEntitySet: "cr40f_funcionarioses",
    veiculoEntitySet: "cr40f_veiculoses",
    lookupNavigationNames: {
      motorista: "nav_motorista",
      veiculo: "nav_veiculo"
    }
  });

  assert.equal(payload.cr40f_nome, "Eu bati - Av. Paulista, 1000");
  assert.equal(payload.cr40f_name, "Eu bati - Av. Paulista, 1000");
  assert.equal(payload.cr40f_tipoocorrencia, 100000000);
  assert.equal(payload.cr40f_local, "Av. Paulista, 1000");
  assert.equal(payload.cr40f_houveterceiro, true);
  assert.equal(payload.cr40f_terceiroplaca, "ABC1D23");
  assert.equal(payload.cr40f_statusoperacional, 100000000);
  assert.equal(payload.cr40f_statusanexo, 100000001);
  assert.equal(payload["nav_motorista@odata.bind"], "/cr40f_funcionarioses(driver-1)");
  assert.equal(payload["nav_veiculo@odata.bind"], "/cr40f_veiculoses(vehicle-1)");
});

test("buildCollisionCreatePayload sem terceiro limpa campos de terceiro", () => {
  const payload = buildCollisionCreatePayload({
    draft: baseDraft({
      tipoOcorrencia: "eu_bati",
      houveTerceiro: false,
      terceiroNome: "Nao deve gravar",
      terceiroTelefone: "(11) 99999-8888",
      terceiroPlaca: "abc1d23",
      terceiroVeiculo: "Corolla prata"
    }),
    photos: photos.slice(0, 2),
    motoristaId: "driver-1",
    veiculoId: "vehicle-1",
    motoristaEntitySet: "cr40f_funcionarioses",
    veiculoEntitySet: "cr40f_veiculoses",
    lookupNavigationNames: {
      motorista: "nav_motorista",
      veiculo: "nav_veiculo"
    }
  });

  assert.equal(payload.cr40f_houveterceiro, false);
  assert.equal(payload.cr40f_terceironome, "");
  assert.equal(payload.cr40f_terceirotelefone, "");
  assert.equal(payload.cr40f_terceiroplaca, "");
});

test("buildCollisionWhatsAppUrl limpa telefone e codifica mensagem", () => {
  const url = buildCollisionWhatsAppUrl("(11) 99999-8888", "Mensagem pronta Betinhos");

  assert.equal(url, "https://wa.me/5511999998888?text=Mensagem%20pronta%20Betinhos");
});
