export type SafeDetailHtmlPart =
  | { type: "text"; value: string }
  | { type: "break" }
  | { type: "link"; href: string; text: string };

const safeExternalUrlPattern = /^https?:\/\/[^\s<>"']+$/i;
const supportedHtmlPattern = /<br\s*\/?>|<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;

function decodeHtmlEntities(value: string) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code: string) => {
    const normalized = code.toLowerCase();
    if (normalized === "amp") return "&";
    if (normalized === "lt") return "<";
    if (normalized === "gt") return ">";
    if (normalized === "quot") return "\"";
    if (normalized === "apos") return "'";
    if (normalized === "nbsp") return " ";
    if (normalized.startsWith("#x")) {
      const codePoint = Number.parseInt(normalized.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }
    if (normalized.startsWith("#")) {
      const codePoint = Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }
    return entity;
  });
}

function stripUnsupportedMarkup(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<script\b[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]*>/g, "")
  );
}

function pushTextParts(parts: SafeDetailHtmlPart[], rawText: string) {
  const text = stripUnsupportedMarkup(rawText);
  if (!text) return;

  text.split(/\r?\n/).forEach((line, index) => {
    if (index > 0) parts.push({ type: "break" });
    if (line) parts.push({ type: "text", value: line });
  });
}

export function parseSafeDetailHtml(value: string): SafeDetailHtmlPart[] {
  const parts: SafeDetailHtmlPart[] = [];
  supportedHtmlPattern.lastIndex = 0;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = supportedHtmlPattern.exec(value)) !== null) {
    pushTextParts(parts, value.slice(cursor, match.index));

    const fullMatch = match[0];
    if (/^<br/i.test(fullMatch)) {
      parts.push({ type: "break" });
    } else {
      const href = decodeHtmlEntities((match[1] ?? match[2] ?? match[3] ?? "").trim());
      const text = stripUnsupportedMarkup(match[4] ?? "").trim();
      if (safeExternalUrlPattern.test(href)) {
        parts.push({ type: "link", href, text: text || href });
      } else {
        pushTextParts(parts, text);
      }
    }

    cursor = supportedHtmlPattern.lastIndex;
  }

  pushTextParts(parts, value.slice(cursor));
  return parts;
}
