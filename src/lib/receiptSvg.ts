import type { PersonalReceiptModel } from "./personalReceipt";
import { getReceiptCopy, getReceiptDisplayClient } from "./receiptLanguage.ts";

export const RECEIPT_SVG_WIDTH = 794;
export const RECEIPT_SVG_HEIGHT = 1123;
const MARGIN = 48;

export type ReceiptSvgAssets = {
  logoB: string;
  logoPreta: string;
  nlaLogo: string;
  qrCode: string;
  centabelBook?: string;
};

type SvgTextOptions = {
  x: number;
  y: number;
  size: number;
  weight?: number;
  fill?: string;
  family?: string;
  anchor?: "start" | "middle" | "end";
  maxWidth?: number;
  lineHeight?: number;
  maxLines?: number;
};

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeText(value: unknown) {
  return String(value ?? "").normalize("NFKC").replace(/\u00a0/g, " ").trim();
}

function displayReceiptValue(value: unknown) {
  const normalized = normalizeText(value);
  return normalized || "-";
}

function buildReceiptDescription(model: PersonalReceiptModel, descriptionBody: string) {
  return [
    descriptionBody,
    normalizeText(model.periodo),
    normalizeText(model.trajetos)
  ].filter(Boolean).join("\n");
}

function estimateTextWidth(text: string, size: number, weight = 500) {
  const weightFactor = weight >= 700 ? 0.58 : 0.52;
  return Array.from(text).reduce((width, char) => {
    if (char === " ") return width + size * 0.28;
    if (/[A-Z0-9]/.test(char)) return width + size * (weight >= 700 ? 0.61 : 0.56);
    if (/[il.,:;]/.test(char)) return width + size * 0.27;
    return width + size * weightFactor;
  }, 0);
}

function wrapText(value: unknown, size: number, maxWidth: number, weight = 500) {
  const paragraphs = normalizeText(value).split(/\r?\n/);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (!current || estimateTextWidth(next, size, weight) <= maxWidth) current = next;
      else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }

  return lines;
}

function svgText(value: unknown, options: SvgTextOptions) {
  const fill = options.fill ?? "#111d21";
  const family = options.family ?? "Montserrat, Manrope, sans-serif";
  const weight = options.weight ?? 500;
  const lineHeight = options.lineHeight ?? Math.round(options.size * 1.35);
  const maxWidth = options.maxWidth ?? RECEIPT_SVG_WIDTH;
  let lines = wrapText(value, options.size, maxWidth, weight);

  if (options.maxLines && lines.length > options.maxLines) {
    lines = lines.slice(0, options.maxLines);
    const lastIndex = lines.length - 1;
    while (lines[lastIndex] && estimateTextWidth(`${lines[lastIndex]}...`, options.size, weight) > maxWidth) {
      lines[lastIndex] = lines[lastIndex].slice(0, -1).trimEnd();
    }
    lines[lastIndex] = `${lines[lastIndex]}...`;
  }

  return [
    `<text x="${options.x}" y="${options.y}" fill="${fill}" font-family="${escapeXml(family)}" font-size="${options.size}" font-weight="${weight}" text-anchor="${options.anchor ?? "start"}">`,
    ...lines.map((line, index) => `<tspan x="${options.x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`),
    "</text>"
  ].join("");
}

function rect(x: number, y: number, width: number, height: number, fill: string) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"/>`;
}

function line(x1: number, y: number, x2: number, color = "#d1d1d1", width = 1) {
  return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${color}" stroke-width="${width}"/>`;
}

function image(href: string, x: number, y: number, width: number, height: number) {
  return `<image href="${href}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>`;
}

function embeddedFontStyle(centabelBook?: string) {
  if (!centabelBook) return "";
  return `<defs><style><![CDATA[
@font-face {
  font-family: "Centabel Book Embedded";
  src: url("${centabelBook}") format("truetype");
  font-weight: 400;
  font-style: normal;
}
]]></style></defs>`;
}

export function buildReceiptSvgMarkup(model: PersonalReceiptModel, assets: ReceiptSvgAssets) {
  const right = RECEIPT_SVG_WIDTH - MARGIN;
  const contentWidth = RECEIPT_SVG_WIDTH - MARGIN * 2;
  const colWidth = contentWidth / 3;
  const copy = getReceiptCopy(model.idioma);
  const description = buildReceiptDescription(model, copy.descriptionBody);
  const footerLogoY = 818;
  const footerLogoRailWidth = 684;
  const footerLogoRailStartX = (RECEIPT_SVG_WIDTH - footerLogoRailWidth) / 2;
  const footerLogoColumnWidth = footerLogoRailWidth / 3;
  const footerLogoCenters = {
    nla: footerLogoRailStartX + footerLogoColumnWidth * 0.5,
    preta: footerLogoRailStartX + footerLogoColumnWidth * 1.5,
    qr: footerLogoRailStartX + footerLogoColumnWidth * 2.5
  };
  const footerContactGap = 12;
  const footerContactColumns = {
    name: 138,
    role: 170,
    phone: 150,
    email: 190
  };
  const footerContactWidth =
    footerContactColumns.name +
    footerContactColumns.role +
    footerContactColumns.phone +
    footerContactColumns.email +
    footerContactGap * 3;
  const footerContactStartX = (RECEIPT_SVG_WIDTH - footerContactWidth) / 2;
  const footerContactX = {
    name: footerContactStartX + footerContactColumns.name / 2,
    role: footerContactStartX + footerContactColumns.name + footerContactGap + footerContactColumns.role / 2,
    phone: footerContactStartX + footerContactColumns.name + footerContactColumns.role + footerContactGap * 2 + footerContactColumns.phone / 2,
    email: footerContactStartX + footerContactColumns.name + footerContactColumns.role + footerContactColumns.phone + footerContactGap * 3 + footerContactColumns.email / 2
  };

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${RECEIPT_SVG_WIDTH}" height="${RECEIPT_SVG_HEIGHT}" viewBox="0 0 ${RECEIPT_SVG_WIDTH} ${RECEIPT_SVG_HEIGHT}">`,
    embeddedFontStyle(assets.centabelBook),
    rect(0, 0, RECEIPT_SVG_WIDTH, RECEIPT_SVG_HEIGHT, "#ffffff"),
    rect(0, 0, RECEIPT_SVG_WIDTH, 125, "#000e23"),
    svgText(copy.title, {
      x: MARGIN,
      y: 86,
      size: 70,
      weight: 400,
      fill: "#ffffff",
      family: "Centabel Book Embedded, Centabel Book, serif"
    }),
    image(assets.logoB, right - 74, 25, 74, 74),
    rect(0, 125, RECEIPT_SVG_WIDTH, 45, "#ebf3ff"),
    svgText(copy.note, {
      x: MARGIN,
      y: 153,
      size: 15,
      fill: "#595959",
      maxWidth: 520,
      maxLines: 1
    }),
    svgText(displayReceiptValue(model.nomePagante), { x: MARGIN, y: 224, size: 22, weight: 700, maxWidth: 360, maxLines: 2, lineHeight: 26 }),
    svgText(displayReceiptValue(getReceiptDisplayClient(model.cliente, model.idioma)), { x: MARGIN, y: 263, size: 15, fill: "#595959", maxWidth: 360, maxLines: 2, lineHeight: 20 }),
    svgText(copy.identificationLabel, { x: 565, y: 222, size: 14, fill: "#747474", anchor: "end" }),
    svgText(copy.issueDateLabel, { x: 565, y: 244, size: 14, fill: "#747474", anchor: "end" }),
    svgText(copy.paymentMethodLabel, { x: 565, y: 266, size: 14, fill: "#747474", anchor: "end" }),
    svgText(displayReceiptValue(model.idPag), { x: right, y: 222, size: 14, weight: 700, anchor: "end", maxWidth: 170 }),
    svgText(displayReceiptValue(model.dataEmissao), { x: right, y: 244, size: 14, weight: 700, anchor: "end", maxWidth: 170 }),
    svgText(displayReceiptValue(model.metodoPagamento), { x: right, y: 266, size: 14, weight: 700, anchor: "end", maxWidth: 170 }),
    line(MARGIN, 348, right),
    line(MARGIN, 383, right),
    svgText(copy.descriptionTitle, { x: MARGIN + 16, y: 371, size: 18, weight: 800 }),
    line(MARGIN, 383, right),
    line(MARGIN, 548, right),
    svgText(description, {
      x: MARGIN + 16,
      y: 423,
      size: 15,
      maxWidth: contentWidth - 32,
      lineHeight: 21,
      maxLines: 5
    }),
    rect(MARGIN, 548, contentWidth - 260, 40, "#ebf3ff"),
    rect(right - 260, 548, 110, 40, "#cde1ff"),
    rect(right - 150, 548, 150, 40, "#cde1ff"),
    line(MARGIN, 548, right),
    svgText(copy.thanksForTravel, { x: MARGIN + 16, y: 574, size: 16, weight: 700, maxWidth: contentWidth - 290 }),
    svgText(copy.totalLabel, { x: right - 205, y: 574, size: 16, weight: 700, anchor: "middle" }),
    svgText(displayReceiptValue(model.valorTotal), { x: right - 16, y: 574, size: 16, weight: 700, anchor: "end", maxWidth: 135 }),
    svgText(copy.observationsLabel, { x: MARGIN, y: 645, size: 13, weight: 700, fill: "#747474" }),
    svgText(displayReceiptValue(model.observacoes), { x: MARGIN, y: 673, size: 13, fill: "#747474", maxWidth: 340, lineHeight: 18, maxLines: 6 }),
    svgText("BETINHOS EXECUTIVE SERVICE LTDA EPP", { x: right, y: 645, size: 11, weight: 700, fill: "#747474", anchor: "end", maxWidth: 320 }),
    svgText("CNPJ: 07.108.241/0001-06", { x: right, y: 663, size: 11, fill: "#747474", anchor: "end" }),
    svgText("CNPJ: 24.484.228/0001-62", { x: right, y: 681, size: 11, fill: "#747474", anchor: "end" }),
    svgText("Sede: São José dos Campos, São Paulo - Brasil", { x: right, y: 699, size: 11, fill: "#747474", anchor: "end", maxWidth: 320 }),
    svgText("Filial: Pindamonhangaba, São Paulo - Brasil", { x: right, y: 717, size: 11, fill: "#747474", anchor: "end", maxWidth: 320 }),
    image(assets.nlaLogo, footerLogoCenters.nla - (colWidth - 36) / 2, footerLogoY + 18, colWidth - 36, 64),
    image(assets.logoPreta, footerLogoCenters.preta - (colWidth - 44) / 2, footerLogoY, colWidth - 44, 96),
    image(assets.qrCode, footerLogoCenters.qr - 35, footerLogoY + 10, 70, 70),
    svgText(copy.qrCaption, { x: footerLogoCenters.qr, y: footerLogoY + 96, size: 10, weight: 700, fill: "#00398e", anchor: "middle", maxWidth: 96, maxLines: 2, lineHeight: 11 }),
    rect(MARGIN + 24, 948, contentWidth - 48, 3, "#dce8fa"),
    line(MARGIN + 24, 950, right - 24, "#00398e", 1),
    svgText("Junior de Paula", { x: footerContactX.name, y: 984, size: 10, weight: 700, anchor: "middle", maxWidth: footerContactColumns.name }),
    svgText(copy.conciergeRole, { x: footerContactX.role, y: 984, size: 10, fill: "#00398e", anchor: "middle", maxWidth: footerContactColumns.role }),
    svgText("+55 12 99723 6961", { x: footerContactX.phone, y: 984, size: 10, fill: "#747474", anchor: "middle", maxWidth: footerContactColumns.phone }),
    svgText("junior@betinhos.com.br", { x: footerContactX.email, y: 984, size: 10, fill: "#747474", anchor: "middle", maxWidth: footerContactColumns.email }),
    svgText("Deborah Keila", { x: footerContactX.name, y: 1005, size: 10, weight: 700, anchor: "middle", maxWidth: footerContactColumns.name }),
    svgText(copy.operationsManagerRole, { x: footerContactX.role, y: 1005, size: 10, fill: "#00398e", anchor: "middle", maxWidth: footerContactColumns.role }),
    svgText("+55 12 99615 9093", { x: footerContactX.phone, y: 1005, size: 10, fill: "#747474", anchor: "middle", maxWidth: footerContactColumns.phone }),
    svgText("deborah.keila@betinhos.com.br", { x: footerContactX.email, y: 1005, size: 10, fill: "#747474", anchor: "middle", maxWidth: footerContactColumns.email }),
    svgText("Juliana Rodrigues", { x: footerContactX.name, y: 1026, size: 10, weight: 700, anchor: "middle", maxWidth: footerContactColumns.name }),
    svgText(copy.financeManagerRole, { x: footerContactX.role, y: 1026, size: 10, fill: "#00398e", anchor: "middle", maxWidth: footerContactColumns.role }),
    svgText("+55 12 99615 9085", { x: footerContactX.phone, y: 1026, size: 10, fill: "#747474", anchor: "middle", maxWidth: footerContactColumns.phone }),
    svgText("financeiro@betinhos.com.br", { x: footerContactX.email, y: 1026, size: 10, fill: "#747474", anchor: "middle", maxWidth: footerContactColumns.email }),
    "</svg>"
  ].join("");
}

export function buildReceiptSvgDataUrlFromMarkup(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
