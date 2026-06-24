export const RECEIPT_LANGUAGE = {
  portuguese: "pt-BR",
  english: "en-US",
  spanish: "es-ES"
} as const;

export type ReceiptLanguage = (typeof RECEIPT_LANGUAGE)[keyof typeof RECEIPT_LANGUAGE];

export const RECEIPT_LANGUAGE_OPTIONS = [
  { value: RECEIPT_LANGUAGE.portuguese, label: "Português" },
  { value: RECEIPT_LANGUAGE.english, label: "Inglês" },
  { value: RECEIPT_LANGUAGE.spanish, label: "Espanhol" }
] as const;

type ReceiptCopy = {
  title: string;
  note: string;
  identificationLabel: string;
  issueDateLabel: string;
  paymentMethodLabel: string;
  descriptionTitle: string;
  descriptionBody: string;
  thanksForTravel: string;
  totalLabel: string;
  observationsLabel: string;
  qrCaption: string;
  previewTitle: string;
  previewHint: string;
  expandedPreviewTitle: string;
  expandedPreviewAria: string;
  zoomControlsAria: string;
  expandPreviewAria: string;
  closeExpandedPreviewAria: string;
  conciergeRole: string;
  operationsManagerRole: string;
  financeManagerRole: string;
};

const RECEIPT_COPY: Record<ReceiptLanguage, ReceiptCopy> = {
  "pt-BR": {
    title: "INVOICE",
    note: "Obrigado por escolher seu recibo digital, você faz parte da solução!",
    identificationLabel: "Identificação",
    issueDateLabel: "Data de Emissão",
    paymentMethodLabel: "Método de Pagamento",
    descriptionTitle: "Descrição",
    descriptionBody: "Serviços prestados de transporte executivo terrestre no Brasil",
    thanksForTravel: "Obrigado por viajar com a Betinhos",
    totalLabel: "Total",
    observationsLabel: "Observações:",
    qrCaption: "Avalie sua experiência",
    previewTitle: "Preview do recibo",
    previewHint: "Toque aqui para visualizar",
    expandedPreviewTitle: "Preview ampliado",
    expandedPreviewAria: "Preview ampliado do recibo",
    zoomControlsAria: "Controle de zoom do recibo",
    expandPreviewAria: "Visualizar preview do recibo",
    closeExpandedPreviewAria: "Fechar preview ampliado",
    conciergeRole: "Concierge Bilíngue",
    operationsManagerRole: "Gerente de Operações",
    financeManagerRole: "Gerente Financeira"
  },
  "en-US": {
    title: "INVOICE",
    note: "Thank you for choosing your digital receipt. You are part of the solution!",
    identificationLabel: "Identification",
    issueDateLabel: "Issue Date",
    paymentMethodLabel: "Payment Method",
    descriptionTitle: "Description",
    descriptionBody: "Executive ground transportation services rendered in Brazil",
    thanksForTravel: "Thank you for traveling with Betinhos",
    totalLabel: "Total",
    observationsLabel: "Notes:",
    qrCaption: "Rate your experience",
    previewTitle: "Receipt preview",
    previewHint: "Tap here to view",
    expandedPreviewTitle: "Expanded preview",
    expandedPreviewAria: "Expanded receipt preview",
    zoomControlsAria: "Receipt zoom controls",
    expandPreviewAria: "View receipt preview",
    closeExpandedPreviewAria: "Close expanded preview",
    conciergeRole: "Bilingual Concierge",
    operationsManagerRole: "Operations Manager",
    financeManagerRole: "Finance Manager"
  },
  "es-ES": {
    title: "INVOICE",
    note: "Gracias por elegir su recibo digital. Usted forma parte de la solución.",
    identificationLabel: "Identificación",
    issueDateLabel: "Fecha de Emisión",
    paymentMethodLabel: "Método de Pago",
    descriptionTitle: "Descripción",
    descriptionBody: "Servicios de transporte ejecutivo terrestre prestados en Brasil",
    thanksForTravel: "Gracias por viajar con Betinhos",
    totalLabel: "Total",
    observationsLabel: "Observaciones:",
    qrCaption: "Califique su experiencia",
    previewTitle: "Vista previa del recibo",
    previewHint: "Toque aquí para visualizar",
    expandedPreviewTitle: "Vista ampliada",
    expandedPreviewAria: "Vista ampliada del recibo",
    zoomControlsAria: "Controles de zoom del recibo",
    expandPreviewAria: "Visualizar vista previa del recibo",
    closeExpandedPreviewAria: "Cerrar vista ampliada",
    conciergeRole: "Concierge Bilingüe",
    operationsManagerRole: "Gerente de Operaciones",
    financeManagerRole: "Gerente Financiera"
  }
};

export function normalizeReceiptLanguage(value: string | null | undefined): ReceiptLanguage {
  if (value === RECEIPT_LANGUAGE.english) return RECEIPT_LANGUAGE.english;
  if (value === RECEIPT_LANGUAGE.spanish) return RECEIPT_LANGUAGE.spanish;
  return RECEIPT_LANGUAGE.portuguese;
}

export function getReceiptCopy(language: string | null | undefined) {
  return RECEIPT_COPY[normalizeReceiptLanguage(language)];
}

export function getReceiptDisplayClient(cliente: string, language: string | null | undefined) {
  const trimmed = cliente.trim();
  if (!trimmed) return "";
  if (trimmed.toLowerCase() !== "particular") return trimmed;

  const normalizedLanguage = normalizeReceiptLanguage(language);
  if (normalizedLanguage === RECEIPT_LANGUAGE.english) return "Private";
  return "Particular";
}

const CREDIT_CARD_PAYMENT_METHOD_BY_LANGUAGE: Record<ReceiptLanguage, string> = {
  "pt-BR": "Cartão de Crédito",
  "en-US": "Credit Card",
  "es-ES": "Tarjeta de Crédito"
};

function normalizeReceiptComparableText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isCreditCardPaymentMethod(value: string) {
  const normalized = normalizeReceiptComparableText(value);
  return ["cartao de credito", "cartaoo de credito", "credit card", "tarjeta de credito"].includes(normalized);
}

export function getDefaultReceiptPaymentMethod(language: string | null | undefined) {
  return CREDIT_CARD_PAYMENT_METHOD_BY_LANGUAGE[normalizeReceiptLanguage(language)];
}

export function getReceiptDisplayPaymentMethod(value: string, language: string | null | undefined) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (isCreditCardPaymentMethod(trimmed)) return getDefaultReceiptPaymentMethod(language);
  return trimmed;
}

export function formatReceiptDateByLanguage(value: string, language: string | null | undefined) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  const brMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  const date = isoMatch
    ? new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T12:00:00`)
    : brMatch
      ? new Date(`${brMatch[3]}-${brMatch[2]}-${brMatch[1]}T12:00:00`)
      : new Date(trimmed);
  if (Number.isNaN(date.getTime())) return trimmed;

  return date.toLocaleDateString(normalizeReceiptLanguage(language));
}

export function formatReceiptCurrencyByLanguage(amount: number, language: string | null | undefined) {
  return amount.toLocaleString(normalizeReceiptLanguage(language), {
    style: "currency",
    currency: "BRL"
  });
}
