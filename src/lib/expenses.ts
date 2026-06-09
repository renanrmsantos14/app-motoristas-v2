export type ExpenseDraft = {
  categoria: string;
  veiculoId: string;
  cidade: string;
  valor: string;
  dataGasto: string;
  formaPagamento: string;
  descricao: string;
  kmInformado: string;
  litros: string;
  observacao: string;
  notaFiscalDataUrl: string;
  notaFiscalFileName: string;
};

export type ExpenseFields = {
  categoria: string;
  cidade: string;
  valor: number;
  dataGasto: string;
  formaPagamento: string;
  descricao: string;
  kmInformado?: number;
  litros?: number;
  observacao?: string;
};

export type ExpenseValidationErrors = Partial<Record<keyof ExpenseDraft, string>>;

export const EXPENSE_CATEGORIES = [
  "Abastecimento",
  "Hospedagem",
  "Lavagem",
  "Café",
  "Almoço",
  "Jantar",
  "Manutenção",
  "Estacionamento",
  "Aplicativos",
  "Locação de carro",
  "Gastos a pedido do cliente",
  "Outros"
] as const;

export const EXPENSE_PAYMENT_METHODS = ["Cartão", "Dinheiro", "Pix", "Pedido de compra", "Pago pelo cliente"] as const;
export const EXPENSE_VEHICLE_CATEGORIES = ["Abastecimento", "Lavagem", "Manutenção", "Estacionamento", "Locação de carro"] as const;
export const EXPENSE_KM_CATEGORIES = ["Abastecimento"] as const;
export const EXPENSE_LITER_CATEGORIES = ["Abastecimento"] as const;
export const EXPENSE_DESCRIPTION_REQUIRED_CATEGORIES = ["Outros", "Gastos a pedido do cliente"] as const;

const EXPENSE_ENTITY_SETS = {
  funcionarios: "cr40f_funcionarioses",
  veiculos: "cr40f_veiculoses"
} as const;

function cleanGuid(value = "") {
  return value.replace(/[{}]/g, "").toLowerCase();
}

function bind(entitySetName: string, id: string) {
  return `/${entitySetName}(${cleanGuid(id)})`;
}

export function expenseNeedsVehicle(categoria: string) {
  return (EXPENSE_VEHICLE_CATEGORIES as readonly string[]).includes(categoria);
}

export function expenseNeedsKm(categoria: string) {
  return (EXPENSE_KM_CATEGORIES as readonly string[]).includes(categoria);
}

export function expenseNeedsLiters(categoria: string) {
  return (EXPENSE_LITER_CATEGORIES as readonly string[]).includes(categoria);
}

export function expenseNeedsDescription(categoria: string) {
  return (EXPENSE_DESCRIPTION_REQUIRED_CATEGORIES as readonly string[]).includes(categoria);
}

export function parseCurrencyInput(value: string) {
  const cleaned = String(value ?? "")
    .replace("R$", "")
    .replace(/\s/g, "")
    .trim();

  if (!cleaned) return 0;
  if (cleaned.includes(",")) return Number(cleaned.replace(/\./g, "").replace(",", "."));
  return Number(cleaned.replace(/,/g, ""));
}

export function parseIntegerInput(value: string) {
  const parsed = Number(String(value ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseDecimalInput(value: string) {
  const cleaned = String(value ?? "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function validateExpenseDraft(draft: ExpenseDraft): ExpenseValidationErrors {
  const errors: ExpenseValidationErrors = {};
  const valor = parseCurrencyInput(draft.valor);

  if (!draft.categoria.trim()) errors.categoria = "Selecione a categoria.";
  if (expenseNeedsVehicle(draft.categoria) && !draft.veiculoId.trim()) errors.veiculoId = "Selecione o veículo.";
  if (!draft.cidade.trim()) errors.cidade = "Informe a cidade.";
  if (!Number.isFinite(valor) || valor <= 0) errors.valor = "Informe um valor maior que zero.";
  if (!draft.dataGasto) errors.dataGasto = "Informe a data do gasto.";
  if (!draft.formaPagamento.trim()) errors.formaPagamento = "Selecione a forma de pagamento.";
  if (expenseNeedsDescription(draft.categoria) && !draft.descricao.trim()) errors.descricao = "Descreva o gasto.";
  if (expenseNeedsKm(draft.categoria) && parseIntegerInput(draft.kmInformado) <= 0) errors.kmInformado = "Informe o KM.";
  if (expenseNeedsLiters(draft.categoria) && parseDecimalInput(draft.litros) <= 0) errors.litros = "Informe os litros.";

  return errors;
}

export function normalizeExpenseFields(draft: ExpenseDraft): ExpenseFields {
  const errors = validateExpenseDraft(draft);
  if (Object.keys(errors).length) throw new Error(Object.values(errors).filter(Boolean).join(" "));

  const kmInformado = parseIntegerInput(draft.kmInformado);
  const litros = parseDecimalInput(draft.litros);
  return {
    categoria: draft.categoria.trim(),
    cidade: draft.cidade.trim(),
    valor: parseCurrencyInput(draft.valor),
    dataGasto: draft.dataGasto,
    formaPagamento: draft.formaPagamento.trim(),
    descricao: draft.descricao.trim(),
    kmInformado: expenseNeedsKm(draft.categoria) && kmInformado > 0 ? kmInformado : undefined,
    litros: expenseNeedsLiters(draft.categoria) && litros > 0 ? litros : undefined,
    observacao: draft.observacao.trim() || undefined
  };
}

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
  motoristaId,
  veiculoId
}: {
  draft: ExpenseDraft;
  motoristaId?: string;
  veiculoId?: string;
}) {
  const fields = normalizeExpenseFields(draft);
  const description = [
    `Categoria: ${fields.categoria}`,
    `Cidade: ${fields.cidade}`,
    `Forma de pagamento: ${fields.formaPagamento}`,
    fields.litros ? `Litros: ${fields.litros.toLocaleString("pt-BR")} L` : "",
    fields.descricao ? `Descrição: ${fields.descricao}` : "",
    fields.observacao ? `Observação: ${fields.observacao}` : ""
  ].filter(Boolean).join("\n");
  const payload: Record<string, unknown> = {
    cr40f_nome: `${fields.categoria} - ${formatDateLabel(fields.dataGasto)}`,
    cr40f_descricaoorigem: fields.categoria,
    cr40f_observacao: description,
    cr40f_cidade: fields.cidade,
    cr40f_datagasto: toDataverseDate(fields.dataGasto),
    cr40f_valorbruto: fields.valor,
    cr40f_valorliquido: fields.valor
  };

  if (fields.kmInformado) payload.cr40f_kminformado = Math.trunc(fields.kmInformado);
  if (motoristaId) payload["cr40f_Motorista@odata.bind"] = bind(EXPENSE_ENTITY_SETS.funcionarios, motoristaId);
  if (veiculoId) payload["cr40f_Veiculo@odata.bind"] = bind(EXPENSE_ENTITY_SETS.veiculos, veiculoId);

  return payload;
}
