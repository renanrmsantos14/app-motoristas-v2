import type { AgendaItem } from "../types.ts";

const CANCELED_AGENDA_GRACE_MS = 20 * 60 * 1000;

function parseAgendaFieldDate(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (!match) return null;

  const [, day, month, year, hour, minute] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
}

function getServiceDateFromAgendaItem(item: AgendaItem) {
  const fieldValue = item.detail?.fields.find((field) => {
    const label = field.label.toLowerCase();
    return label.includes("data") && (label.includes("horario") || label.includes("horário"));
  })?.value;

  return fieldValue ? parseAgendaFieldDate(fieldValue) : null;
}

function getRelativeDateFromTimeLabel(item: AgendaItem, now: number) {
  if (!item.time) return null;

  const timeMatch = item.time.match(/(\d{2}):(\d{2})/);
  if (!timeMatch) return null;

  const [, hour, minute] = timeMatch;
  const label = item.time.toUpperCase();
  const date = new Date(now);

  if (label.includes("AMANH")) date.setDate(date.getDate() + 1);
  if (label.includes("ONTEM")) date.setDate(date.getDate() - 1);

  date.setHours(Number(hour), Number(minute), 0, 0);
  return date;
}

export function getAgendaItemStartDate(item: AgendaItem, now = Date.now()) {
  return getServiceDateFromAgendaItem(item) ?? getRelativeDateFromTimeLabel(item, now);
}

export function shouldShowAgendaItemInGallery(item: AgendaItem, now = Date.now()) {
  if (item.tipo === "HEADER" || !item.canceled) return true;

  const startDate = getAgendaItemStartDate(item, now);
  if (!startDate) return true;

  return now < startDate.getTime() + CANCELED_AGENDA_GRACE_MS;
}

export function filterAgendaGalleryItems(items: AgendaItem[], now = Date.now()) {
  const visibleItems = items.filter((item) => shouldShowAgendaItemInGallery(item, now));
  const result: AgendaItem[] = [];

  for (let index = 0; index < visibleItems.length; index += 1) {
    const item = visibleItems[index];

    if (item.tipo !== "HEADER") {
      result.push(item);
      continue;
    }

    const nextItem = visibleItems[index + 1];
    if (nextItem && nextItem.tipo !== "HEADER") result.push(item);
  }

  return result;
}
