import assert from "node:assert/strict";
import test from "node:test";
import { filterAgendaGalleryItems, shouldShowAgendaItemInGallery } from "../src/app/agendaVisibility.ts";
import { findFirstPendingDetail } from "../src/app/bootstrap.ts";
import type { AgendaItem } from "../src/types.ts";

const firstDetail = {
  type: "SERVICO",
  id: "first",
  title: "Servico",
  actions: ["finalizar"],
  fields: []
} as const;

const nextDetail = {
  type: "SERVICO",
  id: "next",
  title: "Servico",
  actions: ["finalizar"],
  fields: []
} as const;

test("findFirstPendingDetail ignores canceled agenda items", () => {
  const agenda: AgendaItem[] = [
    { id: "header", tipo: "HEADER", tituloData: "Hoje" },
    { id: "srv-first", tipo: "SERVICO", canceled: true, detail: firstDetail },
    { id: "srv-next", tipo: "SERVICO", detail: nextDetail }
  ];

  assert.equal(findFirstPendingDetail(agenda)?.id, "next");
});

test("canceled agenda item stays visible for 20 minutes after departure", () => {
  const item: AgendaItem = {
    id: "srv-canceled",
    tipo: "SERVICO",
    canceled: true,
    detail: {
      ...firstDetail,
      fields: [{ label: "Data / horario", value: "23/06/2026 14:00" }]
    }
  };

  assert.equal(shouldShowAgendaItemInGallery(item, new Date(2026, 5, 23, 14, 19).getTime()), true);
  assert.equal(shouldShowAgendaItemInGallery(item, new Date(2026, 5, 23, 14, 20).getTime()), false);
});

test("filterAgendaGalleryItems removes orphan date headers", () => {
  const now = new Date(2026, 5, 24, 10, 0).getTime();
  const items: AgendaItem[] = [
    { id: "header-yesterday", tipo: "HEADER", tituloData: "ONTEM" },
    {
      id: "srv-yesterday",
      tipo: "SERVICO",
      canceled: true,
      time: "ONTEM 09:00",
      detail: firstDetail
    }
  ];

  assert.deepEqual(filterAgendaGalleryItems(items, now), []);
});
