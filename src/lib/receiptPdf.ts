import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import logoBetinhosBUrl from "../../Logo Betinhos B.png";
import logoBetinhosPretaUrl from "../../Logo Betinhos Preta.png";
import nlaLogoUrl from "../../NLA.jpg";
import qrCodeAvaliacaoUrl from "../../QrCode-Avaliação.png";
import type { PersonalReceiptModel } from "./personalReceipt";

const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const PAGE_MARGIN_PT = 36;

const COLORS = {
  navy: rgb(0, 14 / 255, 35 / 255),
  blue: rgb(0, 57 / 255, 142 / 255),
  paleBlue: rgb(235 / 255, 243 / 255, 255 / 255),
  tableBlue: rgb(205 / 255, 225 / 255, 255 / 255),
  text: rgb(17 / 255, 29 / 255, 33 / 255),
  muted: rgb(116 / 255, 116 / 255, 116 / 255),
  grey: rgb(209 / 255, 209 / 255, 209 / 255),
  white: rgb(1, 1, 1)
};

type PdfAssets = {
  logoB: PDFImage;
  logoPreta: PDFImage;
  nlaLogo: PDFImage;
  qrCode: PDFImage;
  title: PDFFont;
  regular: PDFFont;
  bold: PDFFont;
};

type TextOptions = {
  font: PDFFont;
  size: number;
  color?: ReturnType<typeof rgb>;
  maxWidth?: number;
  lineHeight?: number;
  maxLines?: number;
};

const bytesCache = new Map<string, Promise<Uint8Array>>();

function sanitizePdfText(value: string) {
  return (value || "")
    .normalize("NFKC")
    .replace(/[â€“â€”]/g, "-")
    .replace(/[â€œâ€]/g, '"')
    .replace(/[â€˜â€™]/g, "'")
    .replace(/\u00a0/g, " ")
    .replace(/[^\n\r\t\x20-\x7e\u00a1-\u00ff]/g, "?");
}

async function fetchBytes(url: string) {
  const cached = bytesCache.get(url);
  if (cached) return cached;

  const request = fetch(url).then(async (response) => {
    if (!response.ok) throw new Error("Falha ao carregar recurso do PDF do recibo.");
    return new Uint8Array(await response.arrayBuffer());
  });

  bytesCache.set(url, request);
  return request;
}

async function embedImage(pdfDoc: PDFDocument, url: string) {
  const bytes = await fetchBytes(url);
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes(".jpg") || lowerUrl.includes(".jpeg") || lowerUrl.startsWith("data:image/jpeg")) {
    return pdfDoc.embedJpg(bytes);
  }
  return pdfDoc.embedPng(bytes);
}

async function loadAssets(pdfDoc: PDFDocument): Promise<PdfAssets> {
  const [logoB, logoPreta, nlaLogo, qrCode, title, regular, bold] = await Promise.all([
    embedImage(pdfDoc, logoBetinhosBUrl),
    embedImage(pdfDoc, logoBetinhosPretaUrl),
    embedImage(pdfDoc, nlaLogoUrl),
    embedImage(pdfDoc, qrCodeAvaliacaoUrl),
    pdfDoc.embedFont(StandardFonts.TimesRoman),
    pdfDoc.embedFont(StandardFonts.Helvetica),
    pdfDoc.embedFont(StandardFonts.HelveticaBold)
  ]);

  return { logoB, logoPreta, nlaLogo, qrCode, title, regular, bold };
}

function drawText(page: PDFPage, text: string, x: number, y: number, options: TextOptions) {
  page.drawText(sanitizePdfText(text), {
    x,
    y,
    size: options.size,
    font: options.font,
    color: options.color ?? COLORS.text
  });
}

function fitImage(image: PDFImage, boxWidth: number, boxHeight: number) {
  const scale = Math.min(boxWidth / image.width, boxHeight / image.height);
  return { width: image.width * scale, height: image.height * scale };
}

function drawImageFit(page: PDFPage, image: PDFImage, x: number, y: number, boxWidth: number, boxHeight: number) {
  const fitted = fitImage(image, boxWidth, boxHeight);
  page.drawImage(image, {
    x: x + (boxWidth - fitted.width) / 2,
    y: y + (boxHeight - fitted.height) / 2,
    width: fitted.width,
    height: fitted.height
  });
}

function splitWords(text: string) {
  return sanitizePdfText(text).replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
}

function wrapLine(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = splitWords(text);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth || !current) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  return sanitizePdfText(text)
    .split(/\r?\n/)
    .flatMap((line) => wrapLine(line, font, size, maxWidth))
    .filter(Boolean);
}

function drawWrappedText(page: PDFPage, text: string, x: number, y: number, options: TextOptions) {
  const maxWidth = options.maxWidth ?? A4_WIDTH_PT - x - PAGE_MARGIN_PT;
  const lineHeight = options.lineHeight ?? options.size * 1.35;
  const rawLines = wrapText(text || "", options.font, options.size, maxWidth);
  const lines = options.maxLines && rawLines.length > options.maxLines ? rawLines.slice(0, options.maxLines) : rawLines;

  if (options.maxLines && rawLines.length > options.maxLines && lines.length) {
    const lastIndex = lines.length - 1;
    let lastLine = lines[lastIndex];
    while (lastLine && options.font.widthOfTextAtSize(`${lastLine}...`, options.size) > maxWidth) {
      lastLine = lastLine.slice(0, -1).trimEnd();
    }
    lines[lastIndex] = `${lastLine}...`;
  }

  lines.forEach((line, index) => {
    drawText(page, line, x, y - index * lineHeight, options);
  });

  return y - lines.length * lineHeight;
}

function drawRightText(page: PDFPage, text: string, rightX: number, y: number, options: TextOptions) {
  const safeText = sanitizePdfText(text);
  const width = options.font.widthOfTextAtSize(safeText, options.size);
  drawText(page, safeText, rightX - width, y, options);
}

function drawRect(page: PDFPage, x: number, y: number, width: number, height: number, color: ReturnType<typeof rgb>) {
  page.drawRectangle({ x, y, width, height, color });
}

function drawLine(page: PDFPage, x1: number, y: number, x2: number, color = COLORS.grey, thickness = 1) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, color, thickness });
}

function drawHeader(page: PDFPage, assets: PdfAssets, model: PersonalReceiptModel) {
  drawRect(page, 0, 716, A4_WIDTH_PT, 126, COLORS.navy);
  drawText(page, "INVOICE", PAGE_MARGIN_PT, 747, {
    font: assets.title,
    size: 58,
    color: COLORS.white
  });
  drawImageFit(page, assets.logoB, A4_WIDTH_PT - PAGE_MARGIN_PT - 58, 748, 58, 58);

  drawRect(page, 0, 671, A4_WIDTH_PT, 45, COLORS.paleBlue);
  drawWrappedText(page, "Obrigado por escolher seu recibo digital, vocÃª faz parte da soluÃ§Ã£o!", PAGE_MARGIN_PT, 690, {
    font: assets.regular,
    size: 11,
    color: COLORS.muted,
    maxWidth: 380,
    lineHeight: 13,
    maxLines: 2
  });
  drawRightText(page, model.idOp, A4_WIDTH_PT - PAGE_MARGIN_PT, 689, {
    font: assets.bold,
    size: 12,
    color: COLORS.navy
  });
}

function drawSummary(page: PDFPage, assets: PdfAssets, model: PersonalReceiptModel) {
  drawWrappedText(page, model.nomePagante, PAGE_MARGIN_PT, 636, {
    font: assets.bold,
    size: 16,
    maxWidth: 235,
    lineHeight: 18,
    maxLines: 2
  });
  drawWrappedText(page, model.cliente, PAGE_MARGIN_PT, 596, {
    font: assets.regular,
    size: 11,
    color: COLORS.muted,
    maxWidth: 245,
    lineHeight: 14,
    maxLines: 2
  });

  const labelX = 350;
  const valueRight = A4_WIDTH_PT - PAGE_MARGIN_PT;
  const labels = ["IdentificaÃ§Ã£o", "Data de EmissÃ£o", "MÃ©todo de Pagamento"];
  const values = [model.idPag, model.dataEmissao, model.metodoPagamento];

  labels.forEach((label, index) => {
    const y = 634 - index * 18;
    drawRightText(page, label, labelX + 82, y, {
      font: assets.regular,
      size: 10,
      color: COLORS.muted
    });
    drawRightText(page, values[index] ?? "", valueRight, y, {
      font: assets.bold,
      size: 10,
      color: COLORS.text
    });
  });
}

function drawBody(page: PDFPage, assets: PdfAssets, model: PersonalReceiptModel) {
  const left = PAGE_MARGIN_PT;
  const right = A4_WIDTH_PT - PAGE_MARGIN_PT;
  const contentWidth = right - left;

  drawLine(page, left, 545, right);
  drawLine(page, left, 516, right);
  drawText(page, "DescriÃ§Ã£o", left + 14, 525, { font: assets.bold, size: 14 });

  drawLine(page, left, 516, right);
  drawLine(page, left, 376, right);

  drawWrappedText(page, `ServiÃ§o(s) de transporte terrestre executivo prestado(s) no perÃ­odo de ${model.periodo}.`, left + 14, 492, {
    font: assets.regular,
    size: 11,
    maxWidth: contentWidth - 28,
    lineHeight: 16,
    maxLines: 3
  });

  drawText(page, "Viagens percorridas nos seguintes trajetos:", left + 14, 434, {
    font: assets.bold,
    size: 11
  });

  drawWrappedText(page, model.trajetos, left + 14, 414, {
    font: assets.regular,
    size: 11,
    maxWidth: contentWidth - 28,
    lineHeight: 15,
    maxLines: 5
  });

  drawRect(page, left, 346, contentWidth - 260, 30, COLORS.paleBlue);
  drawRect(page, right - 260, 346, 110, 30, COLORS.tableBlue);
  drawRect(page, right - 150, 346, 150, 30, COLORS.tableBlue);
  drawLine(page, left, 376, right);

  drawText(page, "Obrigado por viajar com a Betinhos", left + 14, 355, {
    font: assets.bold,
    size: 12
  });
  drawText(page, "Total", right - 220, 355, {
    font: assets.bold,
    size: 12
  });
  drawRightText(page, model.valorTotal, right - 14, 355, {
    font: assets.bold,
    size: 12
  });

  drawText(page, "ObservaÃ§Ãµes:", left, 304, {
    font: assets.bold,
    size: 10,
    color: COLORS.muted
  });
  drawWrappedText(page, model.observacoes, left, 284, {
    font: assets.regular,
    size: 10,
    color: COLORS.muted,
    maxWidth: 275,
    lineHeight: 14,
    maxLines: 6
  });

  const companyRight = right;
  const companyLines = [
    "BETINHOS EXECUTIVE SERVICE LTDA EPP",
    "CNPJ: 07.108.241/0001-06",
    "CNPJ: 24.484.228/0001-62",
    "Sede: SÃ£o JosÃ© dos Campos, SÃ£o Paulo - Brasil",
    "Filial: Pindamonhangaba, SÃ£o Paulo - Brasil"
  ];
  companyLines.forEach((line, index) => {
    drawRightText(page, line, companyRight, 304 - index * 13, {
      font: index === 0 ? assets.bold : assets.regular,
      size: index === 0 ? 8.5 : 8,
      color: COLORS.muted
    });
  });
}

function drawFooter(page: PDFPage, assets: PdfAssets) {
  const left = PAGE_MARGIN_PT;
  const right = A4_WIDTH_PT - PAGE_MARGIN_PT;
  const contentWidth = right - left;
  const colWidth = contentWidth / 3;

  drawImageFit(page, assets.nlaLogo, left + 4, 118, colWidth - 18, 70);
  drawImageFit(page, assets.logoPreta, left + colWidth + 4, 105, colWidth - 8, 92);
  drawImageFit(page, assets.qrCode, left + colWidth * 2 + 48, 126, 58, 58);
  drawWrappedText(page, "Avalie sua experiÃªncia", left + colWidth * 2 + 20, 111, {
    font: assets.bold,
    size: 8,
    color: COLORS.blue,
    maxWidth: colWidth - 40,
    lineHeight: 9,
    maxLines: 2
  });

  drawLine(page, left + 24, 92, right - 24, COLORS.blue, 1.4);

  const contactRows = [
    ["Junior de Paula", "Concierge (Bilingual)", "+55 12 99723 6961", "junior@betinhos.com.br"],
    ["Deborah Keila", "Operations Manager", "+55 12 99615 9093", "deborah.keila@betinhos.com.br"],
    ["Juliana Rodrigues", "Finance Manager", "+55 12 99615 9085", "financeiro@betinhos.com.br"]
  ];
  const columns = [76, 184, 314, 426];

  contactRows.forEach((row, rowIndex) => {
    const y = 66 - rowIndex * 15;
    drawText(page, row[0], columns[0], y, { font: assets.bold, size: 8.4 });
    drawText(page, row[1], columns[1], y, { font: assets.regular, size: 8.4, color: COLORS.blue });
    drawText(page, row[2], columns[2], y, { font: assets.regular, size: 8.4, color: COLORS.muted });
    drawText(page, row[3], columns[3], y, { font: assets.regular, size: 8.4, color: COLORS.muted });
  });
}

export async function generateReceiptPdfBlob(model: PersonalReceiptModel) {
  const pdfDoc = await PDFDocument.create();
  const assets = await loadAssets(pdfDoc);
  const page = pdfDoc.addPage([A4_WIDTH_PT, A4_HEIGHT_PT]);

  drawRect(page, 0, 0, A4_WIDTH_PT, A4_HEIGHT_PT, COLORS.white);
  drawHeader(page, assets, model);
  drawSummary(page, assets, model);
  drawBody(page, assets, model);
  drawFooter(page, assets);

  const bytes = await pdfDoc.save();
  const bytesCopy = new Uint8Array(bytes);
  return new Blob([bytesCopy.buffer], { type: "application/pdf" });
}

