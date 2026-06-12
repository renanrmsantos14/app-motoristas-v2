const suspiciousMojibakePattern = /[\u00c2\u00c3\ufffd]/;

function decodeMojibakeOnce(value: string) {
  if (!suspiciousMojibakePattern.test(value) || typeof TextDecoder === "undefined") return "";

  const bytes = new Uint8Array(Array.from(value, (character) => character.charCodeAt(0) & 0xff));
  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (!decoded || decoded === value || decoded.includes("\ufffd")) return "";
  return decoded;
}

function getTextCandidates(value: string) {
  const candidates = [value];
  let current = value;

  for (let index = 0; index < 2; index += 1) {
    const decoded = decodeMojibakeOnce(current);
    if (!decoded || candidates.includes(decoded)) break;
    candidates.push(decoded);
    current = decoded;
  }

  return candidates;
}

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function getNormalizedKeys(value: string) {
  return Array.from(new Set(getTextCandidates(value).map(normalizeKey).filter(Boolean)));
}

export function getFieldValue(fields: Record<string, string>, ...labels: string[]) {
  for (const label of labels) {
    if (Object.prototype.hasOwnProperty.call(fields, label)) return fields[label] ?? "";
  }

  const targetKeys = new Set(labels.flatMap(getNormalizedKeys));
  for (const [key, value] of Object.entries(fields)) {
    if (getNormalizedKeys(key).some((normalizedKey) => targetKeys.has(normalizedKey))) {
      return value ?? "";
    }
  }

  return "";
}

export function isBlankOrNotInformed(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  if (!text) return true;
  return getNormalizedKeys(text).includes("naoinformado");
}
