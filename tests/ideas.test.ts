import assert from "node:assert/strict";
import test from "node:test";
import {
  IDEA_STATUS,
  IDEA_TITLE_MAX_LENGTH,
  buildIdeaRecord,
  getIdeaStatusOption,
  normalizeIdeaRecord,
  validateIdeaDraft
} from "../src/lib/ideas.ts";

test("validateIdeaDraft exige título e respeita limites da tabela cr40f_boasideias", () => {
  assert.deepEqual(validateIdeaDraft({ title: "   ", details: "" }), { title: "Informe o título da ideia." });
  assert.ok(validateIdeaDraft({ title: "a".repeat(IDEA_TITLE_MAX_LENGTH + 1), details: "" }).title);
  assert.ok(validateIdeaDraft({ title: "Ok", details: "x".repeat(2001) }).details);
  assert.deepEqual(validateIdeaDraft({ title: "Água no carro", details: "" }), {});
});

test("buildIdeaRecord usa o mesmo payload da Tela Planner com status Nova", () => {
  assert.deepEqual(buildIdeaRecord({ title: "  Facilitar trocas  ", details: " Detalhe " }), {
    cr40f_name: "Facilitar trocas",
    cr40f_detalhes: "Detalhe",
    cr40f_status: IDEA_STATUS.nova
  });
});

test("normalizeIdeaRecord converte registro Dataverse e assume Nova sem status", () => {
  assert.deepEqual(
    normalizeIdeaRecord({ cr40f_boasideiasid: "abc", cr40f_name: "Título", cr40f_detalhes: null, createdon: "2026-10-01T12:00:00Z" }),
    { id: "abc", title: "Título", details: "", status: IDEA_STATUS.nova, createdAt: "2026-10-01T12:00:00Z" }
  );
  assert.equal(normalizeIdeaRecord({ cr40f_status: IDEA_STATUS.aprovada }).status, IDEA_STATUS.aprovada);
});

test("getIdeaStatusOption expõe rótulo textual dos quatro status reais", () => {
  assert.equal(getIdeaStatusOption(IDEA_STATUS.emAvaliacao)?.label, "Em avaliação");
  assert.equal(getIdeaStatusOption(IDEA_STATUS.implementada)?.label, "Implementada");
  assert.equal(getIdeaStatusOption(42), null);
});
