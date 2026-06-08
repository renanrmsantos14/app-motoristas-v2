import type { AgendaItem, DetailData, DetailField, MaintenancePhotoKind } from "../types";

export type LocalStore = {
  agenda: AgendaItem[];
  history: AgendaItem[];
  signatures: Record<string, string>;
  photos: Record<string, Partial<Record<MaintenancePhotoKind, string>>>;
};

export function upsertField(fields: DetailField[], label: string, value: string): DetailField[] {
  if (fields.some((field) => field.label === label)) {
    return fields.map((field) => (field.label === label ? { ...field, value } : field));
  }

  return [...fields, { label, value }];
}

export function withFields(detail: DetailData, updates: Record<string, string>): DetailData {
  const fields = Object.entries(updates).reduce((current, [label, value]) => upsertField(current, label, value), detail.fields);
  return { ...detail, fields, actions: [] };
}

export function saveSignatureLocally(store: LocalStore, detailId: string, dataUrl: string): LocalStore {
  return {
    ...store,
    signatures: {
      ...store.signatures,
      [detailId]: dataUrl
    }
  };
}

export function saveMaintenancePhoto(
  store: LocalStore,
  detailId: string,
  kind: MaintenancePhotoKind,
  dataUrl: string
): LocalStore {
  return {
    ...store,
    photos: {
      ...store.photos,
      [detailId]: {
        ...(store.photos[detailId] ?? {}),
        [kind]: dataUrl
      }
    }
  };
}

export function clearMaintenancePhotos(store: LocalStore, detailId: string): LocalStore {
  return {
    ...store,
    photos: {
      ...store.photos,
      [detailId]: {}
    }
  };
}

export function deleteMaintenancePhoto(store: LocalStore, detailId: string, kind: MaintenancePhotoKind): LocalStore {
  const nextPhotos = { ...(store.photos[detailId] ?? {}) };
  delete nextPhotos[kind];

  return {
    ...store,
    photos: {
      ...store.photos,
      [detailId]: nextPhotos
    }
  };
}

export function removeAgendaDetail(items: AgendaItem[], detail: DetailData): AgendaItem[] {
  return items.filter((item) => item.tipo === "HEADER" || item.detail?.id !== detail.id || item.detail?.type !== detail.type);
}

export function makeHistoryItem(store: LocalStore, detail: DetailData, fields: Record<string, string>, canceled = false): AgendaItem {
  const extraFields: Record<string, string> = {
    "Data de Finalização": new Date().toLocaleString("pt-BR"),
    ...fields
  };

  if (store.signatures[detail.id]) {
    extraFields.Assinatura = "Assinatura registrada localmente.";
  }

  const photoCount = Object.keys(store.photos[detail.id] ?? {}).length;
  if (photoCount > 0) {
    extraFields.Fotos = `${photoCount} foto(s) salva(s) localmente.`;
  }

  const finalizedDetail = withFields(detail, extraFields);
  const description = detail.fields.find((field) => field.label === "Trajeto")?.value ?? detail.title;

  return {
    id: `hist-local-${detail.type.toLowerCase()}-${detail.id}-${Date.now()}`,
    tipo: detail.type,
    label: detail.type === "SERVICO" ? "Serviço" : detail.type === "TROCA" ? "Troca de Carro" : "Manutenção",
    time: `AGORA ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
    description,
    priority: 0,
    canceled,
    searchText: `${detail.id} ${detail.title} ${detail.fields.map((field) => `${field.label} ${field.value}`).join(" ")}`,
    detail: finalizedDetail
  };
}

export function finalizeDetailLocally(store: LocalStore, detail: DetailData, fields: Record<string, string>): LocalStore {
  const historyItem = makeHistoryItem(store, detail, fields);
  return {
    ...store,
    agenda: removeAgendaDetail(store.agenda, detail),
    history: [historyItem, ...store.history]
  };
}

export function cancelDetailLocally(store: LocalStore, detail: DetailData, reason: string): LocalStore {
  const historyItem = makeHistoryItem(store, detail, { "Observação Final": reason || "Cancelado no local." }, true);
  return {
    ...store,
    agenda: removeAgendaDetail(store.agenda, detail),
    history: [historyItem, ...store.history]
  };
}

function parseLocalNumber(value: string | undefined) {
  const normalized = String(value ?? "")
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();
  return Number(normalized || "0");
}

export function validateVoucherFields(fields: Record<string, string>): string[] {
  const errors: string[] = [];
  const startTime = fields["Horário Inicial"] ?? fields["Horario Inicial"] ?? fields["HorÃ¡rio Inicial"] ?? fields["HorÃƒÂ¡rio Inicial"];

  if (!startTime || startTime === "Não informado" || startTime === "Nao informado" || startTime === "NÃ£o informado" || startTime === "NÃƒÂ£o informado") {
    errors.push("Horário inicial é obrigatório.");
  }

  return errors;
}

export function validateMaintenanceFields(fields: Record<string, string>): string[] {
  const value = parseLocalNumber(fields.Valor);
  const invalid =
    !(fields["Serviço Realizado"] ?? fields["Servico Realizado"] ?? fields["ServiÃ§o Realizado"] ?? fields["ServiÃƒÂ§o Realizado"]) ||
    !fields["Forma de Pagamento"] ||
    fields["Forma de Pagamento"] === "Não informado" ||
    fields["Forma de Pagamento"] === "NÃ£o informado" ||
    fields["Forma de Pagamento"] === "NÃƒÂ£o informado" ||
    !fields.Estabelecimento ||
    fields.Estabelecimento === "Não informado" ||
    fields.Estabelecimento === "NÃ£o informado" ||
    fields.Estabelecimento === "NÃƒÂ£o informado" ||
    value <= 0;

  return invalid ? ["Preencha corretamente: Manutenção Realizada, Forma de Pagamento, Estabelecimento e Valor."] : [];
}

export function findDetailByParams(items: AgendaItem[], servicoId: string, tipo: string): DetailData | null {
  const normalizedType = tipo.trim().toUpperCase();
  const normalizedId = servicoId.trim();
  if (!normalizedId) return null;

  return items.find((item) => {
    if (!item.detail) return false;
    const typeMatches = normalizedType ? item.detail.type === normalizedType : true;
    return typeMatches && item.detail.id === normalizedId;
  })?.detail ?? null;
}

export function detailsToClipboardText(detail: DetailData): string {
  return detail.fields
    .map((field) => {
      const value = field.value
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .trim();
      return `${field.label}: ${value}`;
    })
    .join("\n");
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

type XrmNavigationLike = {
  Navigation?: {
    openUrl?: (url: string, options?: { openInNewWindow?: boolean; height?: number; width?: number }) => void;
  };
};

function getXrmNavigation(): XrmNavigationLike | null {
  const current = window as Window & { Xrm?: XrmNavigationLike };
  try {
    const parentWindow = window.parent as Window & { Xrm?: XrmNavigationLike };
    return current.Xrm?.Navigation?.openUrl ? current.Xrm : parentWindow?.Xrm?.Navigation?.openUrl ? parentWindow.Xrm : null;
  } catch {
    return current.Xrm?.Navigation?.openUrl ? current.Xrm : null;
  }
}

export function openExternalUrl(url: string) {
  const targetUrl = String(url ?? "").trim();
  if (!targetUrl) return;

  const xrm = getXrmNavigation();
  if (xrm?.Navigation?.openUrl) {
    xrm.Navigation.openUrl(targetUrl, { openInNewWindow: true });
    return;
  }

  const opened = window.open(targetUrl, "_blank", "noopener,noreferrer");
  if (opened) {
    opened.opener = null;
    return;
  }

  window.location.assign(targetUrl);
}


