export type ExpenseReferenceOption = {
  id: string;
  name: string;
  order: number;
};

export type ExpenseCategoryOption = ExpenseReferenceOption & {
  exigeVeiculo: boolean;
  exigeReserva: boolean;
  exigeKm: boolean;
  exigeLitros: boolean;
};

export type ExpensePaymentMethodOption = ExpenseReferenceOption & {
  tipo: string;
};

export type ExpenseReferenceData = {
  categories: ExpenseCategoryOption[];
  paymentMethods: ExpensePaymentMethodOption[];
};

export type ExpenseLookupNavigationNames = {
  motorista: string;
  categoria: string;
  formaPagamento: string;
  veiculo?: string;
  reserva?: string;
};

export type ExpenseDraft = {
  categoriaId: string;
  veiculoId: string;
  valor: string;
  dataGasto: string;
  formaPagamentoId: string;
  estabelecimento: string;
  descricao: string;
  kmInformado: string;
  litros: string;
};

export type ExpensePhoto = {
  id: string;
  dataUrl: string;
};

export type ExpenseFields = {
  categoria: ExpenseCategoryOption;
  formaPagamento: ExpensePaymentMethodOption;
  valor: number;
  dataGasto: string;
  estabelecimento?: string;
  descricao?: string;
  kmInformado?: number;
  litros?: number;
  veiculoId?: string;
};

export type ExpenseValidationErrors = Partial<Record<keyof ExpenseDraft | "photos", string>>;

export const DEFAULT_EXPENSE_REFERENCE_DATA: ExpenseReferenceData = {
  categories: [
    {
      id: "local-combustivel",
      name: "Combustível",
      order: 10,
      exigeVeiculo: true,
      exigeReserva: false,
      exigeKm: true,
      exigeLitros: true
    },
    {
      id: "local-pedagio",
      name: "Pedágio",
      order: 20,
      exigeVeiculo: false,
      exigeReserva: false,
      exigeKm: false,
      exigeLitros: false
    },
    {
      id: "local-estacionamento",
      name: "Estacionamento",
      order: 30,
      exigeVeiculo: false,
      exigeReserva: false,
      exigeKm: false,
      exigeLitros: false
    },
    {
      id: "local-lavagem",
      name: "Lavagem",
      order: 40,
      exigeVeiculo: true,
      exigeReserva: false,
      exigeKm: false,
      exigeLitros: false
    },
    {
      id: "local-manutencao-emergencial",
      name: "Manutenção emergencial",
      order: 50,
      exigeVeiculo: true,
      exigeReserva: false,
      exigeKm: false,
      exigeLitros: false
    },
    {
      id: "local-alimentacao",
      name: "Alimentação",
      order: 60,
      exigeVeiculo: false,
      exigeReserva: false,
      exigeKm: false,
      exigeLitros: false
    },
    {
      id: "local-hospedagem",
      name: "Hospedagem",
      order: 70,
      exigeVeiculo: false,
      exigeReserva: false,
      exigeKm: false,
      exigeLitros: false
    },
    {
      id: "local-outros",
      name: "Outros",
      order: 999,
      exigeVeiculo: false,
      exigeReserva: false,
      exigeKm: false,
      exigeLitros: false
    }
  ],
  paymentMethods: [
    { id: "local-cartao-empresa", name: "Cartão empresa", order: 10, tipo: "Cartão" },
    { id: "local-cartao-motorista", name: "Cartão motorista", order: 20, tipo: "Cartão" },
    { id: "local-dinheiro-motorista", name: "Dinheiro motorista", order: 30, tipo: "Dinheiro" },
    { id: "local-pix-motorista", name: "Pix motorista", order: 40, tipo: "Pix" },
    { id: "local-tag-ctf", name: "Tag CTF", order: 50, tipo: "Tag" },
    { id: "local-sem-parar", name: "Sem Parar", order: 60, tipo: "Tag" }
  ]
};

const fallbackCategoryRules: Record<string, Partial<ExpenseCategoryOption>> = {
  Combustível: { exigeVeiculo: true, exigeKm: true, exigeLitros: true },
  combustivel: { exigeVeiculo: true, exigeKm: true, exigeLitros: true },
  Lavagem: { exigeVeiculo: true },
  "Manutenção emergencial": { exigeVeiculo: true }
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function findExpenseCategory(referenceData: ExpenseReferenceData, id: string) {
  return referenceData.categories.find((category) => category.id === id) ?? null;
}

export function findExpensePaymentMethod(referenceData: ExpenseReferenceData, id: string) {
  return referenceData.paymentMethods.find((method) => method.id === id) ?? null;
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

  const fallback = fallbackCategoryRules[category.name] ?? fallbackCategoryRules[normalizeText(category.name)] ?? {};
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
  const rules = getExpenseCategoryRules(category);
  const valor = parseCurrencyInput(draft.valor);

  if (!category) errors.categoriaId = "Selecione a categoria.";
  if (rules.exigeVeiculo && !draft.veiculoId.trim()) errors.veiculoId = "Selecione o veículo.";
  if (!Number.isFinite(valor) || valor <= 0) errors.valor = "Informe um valor maior que zero.";
  if (!draft.dataGasto) errors.dataGasto = "Informe a data do gasto.";
  if (!paymentMethod) errors.formaPagamentoId = "Selecione a forma de pagamento.";
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
  if (!categoria || !formaPagamento) throw new Error("Categoria ou forma de pagamento não carregada.");

  const rules = getExpenseCategoryRules(categoria);
  const kmInformado = parseIntegerInput(draft.kmInformado);
  const litros = parseDecimalInput(draft.litros);

  return {
    categoria,
    formaPagamento,
    valor: parseCurrencyInput(draft.valor),
    dataGasto: draft.dataGasto,
    estabelecimento: draft.estabelecimento.trim() || undefined,
    descricao: draft.descricao.trim() || undefined,
    kmInformado: rules.exigeKm && kmInformado > 0 ? kmInformado : undefined,
    litros: rules.exigeLitros && litros > 0 ? litros : undefined,
    veiculoId: draft.veiculoId.trim() || undefined
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
  photos,
  referenceData,
  motoristaId,
  veiculoId,
  reservaId,
  categoryEntitySet,
  paymentMethodEntitySet,
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
  motoristaEntitySet: string;
  veiculoEntitySet: string;
  reservaEntitySet: string;
  lookupNavigationNames: ExpenseLookupNavigationNames;
}) {
  const fields = normalizeExpenseFields(draft, photos, referenceData);
  const vehicleToBind = fields.veiculoId || veiculoId || "";
  const name = `${fields.categoria.name} - ${formatDateLabel(fields.dataGasto)}`;
  const observation = [
    fields.descricao ? `Descrição: ${fields.descricao}` : "",
    fields.estabelecimento ? `Estabelecimento: ${fields.estabelecimento}` : "",
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
    [`${lookupNavigationNames.formaPagamento}@odata.bind`]: `/${paymentMethodEntitySet}(${fields.formaPagamento.id})`
  };

  if (fields.kmInformado) payload.cr40f_kminformado = Math.trunc(fields.kmInformado);
  if (fields.litros) payload.cr40f_litros = fields.litros;
  if (fields.estabelecimento) payload.cr40f_estabelecimento = fields.estabelecimento;
  if (vehicleToBind) {
    if (!lookupNavigationNames.veiculo) throw new Error("Navigation property de veículo não resolvido para despesa.");
    payload[`${lookupNavigationNames.veiculo}@odata.bind`] = `/${veiculoEntitySet}(${vehicleToBind})`;
  }
  if (reservaId) {
    if (!lookupNavigationNames.reserva) throw new Error("Navigation property de reserva não resolvido para despesa.");
    payload[`${lookupNavigationNames.reserva}@odata.bind`] = `/${reservaEntitySet}(${reservaId})`;
  }

  return payload;
}
