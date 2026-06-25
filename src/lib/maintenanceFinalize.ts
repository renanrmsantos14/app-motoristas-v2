import type { MaintenancePhotoKind } from "../types";

export type MaintenanceFinalizeErrorKey = "serviceDone" | "value" | "payment" | "cidadeId" | "establishment" | "invoicePhoto" | "maintenancePhoto";
export type MaintenanceFinalizeErrors = Partial<Record<MaintenanceFinalizeErrorKey, string>>;

export function parseMaintenanceCurrency(value: string) {
  return Number(value.replace("R$", "").replace(/\./g, "").replace(",", ".").trim() || "0");
}

export function validateMaintenanceFinalizeFields({
  serviceDone,
  value,
  payment,
  cidadeId,
  validCityIds,
  establishment,
  confirmedPhotos
}: {
  serviceDone: string;
  value: string;
  payment: string;
  cidadeId: string;
  validCityIds: Set<string>;
  establishment: string;
  confirmedPhotos: MaintenancePhotoKind[];
}): MaintenanceFinalizeErrors {
  const errors: MaintenanceFinalizeErrors = {};
  if (!serviceDone.trim()) errors.serviceDone = "Descreva a manutencao realizada.";
  if (parseMaintenanceCurrency(value) <= 0) errors.value = "Informe um valor maior que zero.";
  if (!payment) errors.payment = "Selecione a forma de pagamento.";
  if (!cidadeId || !validCityIds.has(cidadeId)) errors.cidadeId = "Selecione a cidade.";
  if (!establishment.trim()) errors.establishment = "Informe o estabelecimento.";
  if (!confirmedPhotos.some((kind) => kind.startsWith("NOTAFISCAL"))) errors.invoicePhoto = "Adicione a foto da nota fiscal.";
  if (!confirmedPhotos.some((kind) => kind === "FOTO1" || kind === "FOTO2" || kind === "FOTO3")) {
    errors.maintenancePhoto = "Adicione pelo menos uma foto da manutencao.";
  }
  return errors;
}
