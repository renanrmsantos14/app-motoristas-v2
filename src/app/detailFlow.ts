import type { ExpensePhoto } from "../lib/expenses";
import type { DetailData, Screen } from "../types";

function getDetailFieldValue(detail: DetailData, label: string) {
  return detail.fields.find((field) => field.label.toLowerCase() === label.toLowerCase())?.value ?? "";
}

function isTrueLike(value: unknown) {
  return value === true || value === 1 || value === "true";
}

export function shouldRequireReceiveStep(detail: DetailData) {
  return (
    detail.type === "SERVICO" &&
    (
      detail.actions.includes("receber") ||
      isTrueLike(detail.dataverse?.record?.cr40f_receber) ||
      getDetailFieldValue(detail, "Receber").trim().toLowerCase() === "sim"
    )
  );
}

export function shouldRouteServiceToVoucher(detail: DetailData) {
  return detail.type === "SERVICO" && /tenn?aris/i.test(getDetailFieldValue(detail, "Cliente"));
}

export function getServiceTaskBackScreen(detail: DetailData): Screen {
  return shouldRequireReceiveStep(detail) ? "receber" : "servicos";
}

export function hasReceiveProofs(detail: DetailData, receiveProofs: Record<string, ExpensePhoto[]>) {
  return (receiveProofs[detail.id]?.length ?? 0) > 0;
}

export function hasUploadedReceiveProofs(
  detail: DetailData,
  receiveProofs: Record<string, ExpensePhoto[]>,
  receiveUploadedCounts: Record<string, number>
) {
  const proofCount = receiveProofs[detail.id]?.length ?? 0;
  return proofCount > 0 && receiveUploadedCounts[detail.id] === proofCount;
}
