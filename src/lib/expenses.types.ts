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

export type ExpenseCityOption = ExpenseReferenceOption & {
  uf: string;
  pais: string;
  codigoIbge: string;
};

export type ExpenseReferenceData = {
  categories: ExpenseCategoryOption[];
  paymentMethods: ExpensePaymentMethodOption[];
  cities: ExpenseCityOption[];
};

export type ExpenseLookupNavigationNames = {
  motorista: string;
  categoria: string;
  formaPagamento: string;
  cidade: string;
  veiculo?: string;
  reserva?: string;
  manutencao?: string;
};

export type ExpenseDraft = {
  categoriaId: string;
  veiculoId: string;
  valor: string;
  dataGasto: string;
  formaPagamentoId: string;
  cidadeId: string;
  estabelecimento: string;
  descricao: string;
  kmInformado: string;
  litros: string;
};

export type ExpensePhoto = {
  id: string;
  dataUrl: string;
  previewUrl?: string;
  posterUrl?: string;
  durationLabel?: string;
  mediaType?: "foto" | "video";
  rawBlob?: Blob;
};

export type ExpenseFields = {
  categoria: ExpenseCategoryOption;
  formaPagamento: ExpensePaymentMethodOption;
  cidade: ExpenseCityOption;
  valor: number;
  dataGasto: string;
  estabelecimento?: string;
  descricao?: string;
  kmInformado?: number;
  litros?: number;
  veiculoId?: string;
};

export type ExpenseValidationErrors = Partial<Record<keyof ExpenseDraft | "photos", string>>;
