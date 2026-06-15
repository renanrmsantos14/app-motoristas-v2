import { normalizeExpenseFields } from "./expenses.reference.ts";
import type { ExpenseDraft, ExpenseLookupNavigationNames, ExpensePhoto, ExpenseReferenceData } from "./expenses.types.ts";

function formatDateLabel(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function toDataverseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date(value).toISOString();
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).toISOString();
}

export function buildExpenseCreatePayload({
  draft,
  photos,
  referenceData,
  motoristaId,
  veiculoId,
  reservaId,
  categoryEntitySet,
  paymentMethodEntitySet,
  cityEntitySet,
  motoristaEntitySet,
  veiculoEntitySet,
  reservaEntitySet,
  lookupNavigationNames
}: {
  draft: ExpenseDraft;
  photos: ExpensePhoto[];
  referenceData: ExpenseReferenceData;
  motoristaId: string;
  veiculoId?: string;
  reservaId?: string;
  categoryEntitySet: string;
  paymentMethodEntitySet: string;
  cityEntitySet: string;
  motoristaEntitySet: string;
  veiculoEntitySet: string;
  reservaEntitySet: string;
  lookupNavigationNames: ExpenseLookupNavigationNames;
}) {
  const fields = normalizeExpenseFields(draft, photos, referenceData);
  const vehicleToBind = fields.veiculoId || veiculoId || "";
  const name = `${fields.categoria.name} - ${formatDateLabel(fields.dataGasto)}`;
  const observation = [
    fields.descricao ? `Descri\u00e7\u00e3o: ${fields.descricao}` : "",
    fields.estabelecimento ? `Estabelecimento: ${fields.estabelecimento}` : "",
    `Cidade: ${fields.cidade.name}`,
    `Pa\u00eds: ${fields.cidade.pais || "Brasil"}`,
    fields.litros ? `Litros: ${fields.litros.toLocaleString("pt-BR")} L` : "",
    `Forma de pagamento: ${fields.formaPagamento.name}`,
    `Categoria: ${fields.categoria.name}`,
    photos.length ? `Comprovantes: ${photos.length}` : ""
  ].filter(Boolean).join("\n");

  const payload: Record<string, unknown> = {
    cr40f_nome: name,
    cr40f_datagasto: toDataverseDate(fields.dataGasto),
    cr40f_valor: fields.valor,
    cr40f_statusoperacional: 100000000,
    cr40f_statusfinanceiro: 100000000,
    cr40f_statusanexo: photos.length ? 100000001 : 100000000,
    cr40f_origem: 100000000,
    cr40f_observacao: observation,
    [`${lookupNavigationNames.motorista}@odata.bind`]: `/${motoristaEntitySet}(${motoristaId})`,
    [`${lookupNavigationNames.categoria}@odata.bind`]: `/${categoryEntitySet}(${fields.categoria.id})`,
    [`${lookupNavigationNames.formaPagamento}@odata.bind`]: `/${paymentMethodEntitySet}(${fields.formaPagamento.id})`,
    [`${lookupNavigationNames.cidade}@odata.bind`]: `/${cityEntitySet}(${fields.cidade.id})`
  };

  if (fields.kmInformado) payload.cr40f_kminformado = Math.trunc(fields.kmInformado);
  if (fields.litros) payload.cr40f_litros = fields.litros;
  if (fields.estabelecimento) payload.cr40f_estabelecimento = fields.estabelecimento;
  if (vehicleToBind) {
    if (!lookupNavigationNames.veiculo) throw new Error("Navigation property de ve\u00edculo n\u00e3o resolvido para despesa.");
    payload[`${lookupNavigationNames.veiculo}@odata.bind`] = `/${veiculoEntitySet}(${vehicleToBind})`;
  }
  if (reservaId) {
    if (!lookupNavigationNames.reserva) throw new Error("Navigation property de reserva n\u00e3o resolvido para despesa.");
    payload[`${lookupNavigationNames.reserva}@odata.bind`] = `/${reservaEntitySet}(${reservaId})`;
  }

  return payload;
}
