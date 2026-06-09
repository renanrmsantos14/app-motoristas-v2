const addressLabels = new Set([
  "endereco de saida",
  "endereco saida",
  "ed de saida",
  "local de saida",
  "saida",
  "destino"
]);

const streetOrPlacePattern = /(?:\b(?:rua|avenida|av|alameda|rodovia|estrada|pra[çc]a|travessa|terminal|aeroporto|airport|hotel|condom[ií]nio|residencial|edif[ií]cio|shopping|hospital|base)\b|\br\.|\bav\.)/i;
const cityOrStatePattern = /(?:,\s*[^,\n]{2,}\s*-\s*[A-Z]{2}\b)|\b(S[ãa]o Paulo|Barueri|Campinas|Guarulhos|Congonhas|Viracopos|Jundia[ií]|Santos|Sorocaba)\b/i;
const streetNumberPattern = /(?:,\s*\d{1,6}\b|\b\d{1,6}\s*-|\bs\/n\b)/i;

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function isAddressFieldLabel(label: string) {
  return addressLabels.has(normalizeText(label));
}

export function isConfidentMapAddress(label: string, value: string) {
  const cleanValue = value.trim();
  if (!isAddressFieldLabel(label)) return false;
  if (cleanValue.length < 8 || cleanValue.length > 220) return false;
  if (/^https?:\/\//i.test(cleanValue)) return false;
  if (/<[^>]+>/.test(cleanValue)) return false;
  if (/[\r\n]|->|→/.test(cleanValue)) return false;
  if (/^\+?\d[\d\s().-]{7,}$/.test(cleanValue)) return false;

  const hasPlaceSignal = streetOrPlacePattern.test(cleanValue);
  const hasLocationSignal = streetNumberPattern.test(cleanValue) || cityOrStatePattern.test(cleanValue);

  return hasPlaceSignal && hasLocationSignal;
}

export function buildGoogleMapsSearchUrl(label: string, value: string) {
  if (!isConfidentMapAddress(label, value)) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value.trim())}`;
}
