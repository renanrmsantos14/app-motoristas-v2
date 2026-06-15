import type {
  ExpenseCategoryOption,
  ExpenseCityOption,
  ExpenseDraft,
  ExpenseFields,
  ExpensePhoto,
  ExpenseReferenceData,
  ExpenseValidationErrors
} from "./expenses.types.ts";

const FALLBACK_CATEGORY_RULES: Record<string, Partial<ExpenseCategoryOption>> = {
  abastecimento: { exigeVeiculo: true, exigeKm: true, exigeLitros: true },
  lavagem: { exigeVeiculo: true },
  manutencao: { exigeVeiculo: true }
};

const CITY_ABBREVIATION_STOP_WORDS = new Set(["de", "da", "do", "das", "dos", "e"]);

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildExpenseCityAbbreviation(value: string) {
  const baseName = value.split(" - ")[0] ?? value;
  return normalizeText(baseName)
    .split(/\s+/)
    .filter((part) => part && !CITY_ABBREVIATION_STOP_WORDS.has(part))
    .map((part) => part[0])
    .join("");
}

export function findExpenseCategory(referenceData: ExpenseReferenceData, id: string) {
  return referenceData.categories.find((category) => category.id === id) ?? null;
}

export function findExpensePaymentMethod(referenceData: ExpenseReferenceData, id: string) {
  return referenceData.paymentMethods.find((method) => method.id === id) ?? null;
}

export function findExpenseCity(referenceData: ExpenseReferenceData, id: string) {
  return referenceData.cities.find((city) => city.id === id) ?? null;
}

export function matchesExpenseCitySearch(city: ExpenseCityOption, query: string) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return false;
  const searchableText = normalizeText(`${city.name} ${city.uf} ${city.pais} ${city.codigoIbge}`);
  if (searchableText.includes(normalizedQuery)) return true;
  return buildExpenseCityAbbreviation(city.name) === normalizedQuery;
}

export function getExpenseCategoryRules(category: ExpenseCategoryOption | null) {
  if (!category) {
    return {
      exigeVeiculo: false,
      exigeReserva: false,
      exigeKm: false,
      exigeLitros: false
    };
  }

  const fallback = FALLBACK_CATEGORY_RULES[normalizeText(category.name)] ?? {};
  return {
    exigeVeiculo: category.exigeVeiculo || fallback.exigeVeiculo || false,
    exigeReserva: category.exigeReserva || fallback.exigeReserva || false,
    exigeKm: category.exigeKm || fallback.exigeKm || false,
    exigeLitros: category.exigeLitros || fallback.exigeLitros || false
  };
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

export function validateExpenseDraft(
  draft: ExpenseDraft,
  photos: ExpensePhoto[],
  referenceData: ExpenseReferenceData
): ExpenseValidationErrors {
  const errors: ExpenseValidationErrors = {};
  const category = findExpenseCategory(referenceData, draft.categoriaId);
  const paymentMethod = findExpensePaymentMethod(referenceData, draft.formaPagamentoId);
  const city = findExpenseCity(referenceData, draft.cidadeId);
  const rules = getExpenseCategoryRules(category);
  const valor = parseCurrencyInput(draft.valor);

  if (!category) errors.categoriaId = "Selecione a categoria.";
  if (rules.exigeVeiculo && !draft.veiculoId.trim()) errors.veiculoId = "Selecione o ve\u00edculo.";
  if (!Number.isFinite(valor) || valor <= 0) errors.valor = "Informe um valor maior que zero.";
  if (!draft.dataGasto) errors.dataGasto = "Informe a data do gasto.";
  if (!paymentMethod) errors.formaPagamentoId = "Selecione a forma de pagamento.";
  if (!city) errors.cidadeId = "Selecione a cidade.";
  if (rules.exigeKm && parseIntegerInput(draft.kmInformado) <= 0) errors.kmInformado = "Informe o KM.";
  if (rules.exigeLitros && parseDecimalInput(draft.litros) <= 0) errors.litros = "Informe os litros.";
  if (photos.length === 0) errors.photos = "Adicione ao menos uma foto do comprovante.";

  return errors;
}

export function normalizeExpenseFields(
  draft: ExpenseDraft,
  photos: ExpensePhoto[],
  referenceData: ExpenseReferenceData
): ExpenseFields {
  const errors = validateExpenseDraft(draft, photos, referenceData);
  if (Object.keys(errors).length) throw new Error(Object.values(errors).filter(Boolean).join(" "));

  const categoria = findExpenseCategory(referenceData, draft.categoriaId);
  const formaPagamento = findExpensePaymentMethod(referenceData, draft.formaPagamentoId);
  const cidade = findExpenseCity(referenceData, draft.cidadeId);
  if (!categoria || !formaPagamento || !cidade) {
    throw new Error("Categoria, forma de pagamento ou cidade n\u00e3o carregada.");
  }

  const rules = getExpenseCategoryRules(categoria);
  const kmInformado = parseIntegerInput(draft.kmInformado);
  const litros = parseDecimalInput(draft.litros);

  return {
    categoria,
    formaPagamento,
    cidade,
    valor: parseCurrencyInput(draft.valor),
    dataGasto: draft.dataGasto,
    estabelecimento: draft.estabelecimento.trim() || undefined,
    descricao: draft.descricao.trim() || undefined,
    kmInformado: rules.exigeKm && kmInformado > 0 ? kmInformado : undefined,
    litros: rules.exigeLitros && litros > 0 ? litros : undefined,
    veiculoId: draft.veiculoId.trim() || undefined
  };
}
