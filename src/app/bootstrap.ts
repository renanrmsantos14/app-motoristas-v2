import { agendaMock, historyMock } from "../data/mockData";
import { findDetailByParams, type LocalStore } from "../lib/localWorkflow";
import type { DetailData } from "../types";

export const STORAGE_KEY = "app-motoristas-local-v1";

export function isSameDetail(left: DetailData | undefined, right: DetailData) {
  return Boolean(left && left.id === right.id && left.type === right.type);
}

export function findFirstPendingDetail(agenda: LocalStore["agenda"]) {
  return agenda.find((item) => item.tipo !== "HEADER" && item.detail)?.detail;
}

export function initialStore(): LocalStore {
  return {
    agenda: agendaMock,
    history: historyMock,
    signatures: {},
    photos: {}
  };
}

export function loadStore(storage: Storage = window.localStorage): LocalStore {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as LocalStore;
  } catch {
    // fallback local
  }

  return initialStore();
}

export function getInitialDetail(store: LocalStore, search = window.location.search): DetailData | null {
  const params = new URLSearchParams(search);
  const serviceId = params.get("servicoId") ?? "";
  const type = params.get("tipo") ?? "";
  return findDetailByParams([...store.agenda, ...store.history], serviceId, type);
}

export function getInitialParams(search = window.location.search) {
  const params = new URLSearchParams(search);
  return {
    serviceId: params.get("servicoId") ?? "",
    type: params.get("tipo") ?? ""
  };
}

export function getVoucherDraftKey(detail: DetailData) {
  return `${detail.type}:${detail.id}`;
}
