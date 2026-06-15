import { PDFDocument } from "pdf-lib";
import logoBetinhosBUrl from "../../Logo Betinhos B.png";
import logoBetinhosPretaUrl from "../../Logo Betinhos Preta.png";
import nlaLogoUrl from "../../NLA.jpg";
import qrCodeAvaliacaoUrl from "../../QrCode-Avaliação.png";
import type { PersonalReceiptModel } from "./personalReceipt";

const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const SVG_WIDTH = 794;
const SVG_HEIGHT = 1123;
const SNAPSHOT_SCALE = 2;
const MARGIN = 48;
const bytesCache = new Map<string, Promise<string>>();

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
      if (!current || estimateTextWidth(next, size, weight) <= maxWidth) {
        current = next;
      } else {
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
  const family = options.family ?? "Montserrat, Open Sans, Arial, sans-serif";
  const weight = options.weight ?? 500;
  const lineHeight = options.lineHeight ?? Math.round(options.size * 1.35);
  const maxWidth = options.maxWidth ?? SVG_WIDTH;
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

async function urlToDataUrl(url: string) {
  if (url.startsWith("data:")) return url;
  const cached = bytesCache.get(url);
  if (cached) return cached;

  const request = fetch(url).then(async (response) => {
    if (!response.ok) throw new Error("Falha ao carregar imagem do recibo.");
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Falha ao preparar imagem do recibo."));
      reader.readAsDataURL(blob);
    });
  });

  bytesCache.set(url, request);
  return request;
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

async function buildReceiptSvg(model: PersonalReceiptModel) {
  const [logoB, logoPreta, nlaLogo, qrCode] = await Promise.all([
    urlToDataUrl(logoBetinhosBUrl),
    urlToDataUrl(logoBetinhosPretaUrl),
    urlToDataUrl(nlaLogoUrl),
    urlToDataUrl(qrCodeAvaliacaoUrl)
  ]);

  const right = SVG_WIDTH - MARGIN;
  const contentWidth = SVG_WIDTH - MARGIN * 2;
  const colWidth = contentWidth / 3;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}">`,
    rect(0, 0, SVG_WIDTH, SVG_HEIGHT, "#ffffff"),
    rect(0, 0, SVG_WIDTH, 125, "#000e23"),
    svgText("INVOICE", {
      x: MARGIN,
      y: 86,
      size: 70,
      weight: 400,
      fill: "#ffffff",
      family: "Centabel Book, Cormorant Garamond, Times New Roman, serif"
    }),
    image(logoB, right - 74, 25, 74, 74),
    rect(0, 125, SVG_WIDTH, 45, "#ebf3ff"),
    svgText("Obrigado por escolher seu recibo digital, você faz parte da solução!", {
      x: MARGIN,
      y: 153,
      size: 15,
      fill: "#595959",
      maxWidth: 520,
      maxLines: 1
    }),
    svgText(model.idOp, { x: right, y: 153, size: 16, weight: 700, anchor: "end", fill: "#000e23", maxWidth: 180 }),

    svgText(model.nomePagante, { x: MARGIN, y: 224, size: 22, weight: 700, maxWidth: 360, maxLines: 2, lineHeight: 26 }),
    svgText(model.cliente, { x: MARGIN, y: 263, size: 15, fill: "#595959", maxWidth: 360, maxLines: 2, lineHeight: 20 }),
    svgText("Identificação", { x: 565, y: 222, size: 14, fill: "#747474", anchor: "end" }),
    svgText("Data de Emissão", { x: 565, y: 244, size: 14, fill: "#747474", anchor: "end" }),
    svgText("Método de Pagamento", { x: 565, y: 266, size: 14, fill: "#747474", anchor: "end" }),
    svgText(model.idPag, { x: right, y: 222, size: 14, weight: 700, anchor: "end", maxWidth: 170 }),
    svgText(model.dataEmissao, { x: right, y: 244, size: 14, weight: 700, anchor: "end", maxWidth: 170 }),
    svgText(model.metodoPagamento, { x: right, y: 266, size: 14, weight: 700, anchor: "end", maxWidth: 170 }),

    line(MARGIN, 348, right),
    line(MARGIN, 383, right),
    svgText("Descrição", { x: MARGIN + 16, y: 371, size: 18, weight: 800 }),
    line(MARGIN, 383, right),
    line(MARGIN, 548, right),
    svgText(`Serviço(s) de transporte terrestre executivo prestado(s) no período de ${model.periodo}.`, {
      x: MARGIN + 16,
      y: 423,
      size: 15,
      maxWidth: contentWidth - 32,
      lineHeight: 23,
      maxLines: 3
    }),
    svgText("Viagens percorridas nos seguintes trajetos:", { x: MARGIN + 16, y: 488, size: 15, weight: 700 }),
    svgText(model.trajetos, { x: MARGIN + 16, y: 516, size: 15, maxWidth: contentWidth - 32, lineHeight: 22, maxLines: 5 }),

    rect(MARGIN, 548, contentWidth - 260, 40, "#ebf3ff"),
    rect(right - 260, 548, 110, 40, "#cde1ff"),
    rect(right - 150, 548, 150, 40, "#cde1ff"),
    line(MARGIN, 548, right),
    svgText("Obrigado por viajar com a Betinhos", { x: MARGIN + 16, y: 574, size: 16, weight: 700, maxWidth: contentWidth - 290 }),
    svgText("Total", { x: right - 205, y: 574, size: 16, weight: 700, anchor: "middle" }),
    svgText(model.valorTotal, { x: right - 16, y: 574, size: 16, weight: 700, anchor: "end", maxWidth: 135 }),

    svgText("Observações:", { x: MARGIN, y: 645, size: 13, weight: 700, fill: "#747474" }),
    svgText(model.observacoes, { x: MARGIN, y: 673, size: 13, fill: "#747474", maxWidth: 340, lineHeight: 18, maxLines: 6 }),
    svgText("BETINHOS EXECUTIVE SERVICE LTDA EPP", { x: right, y: 645, size: 11, weight: 700, fill: "#747474", anchor: "end", maxWidth: 320 }),
    svgText("CNPJ: 07.108.241/0001-06", { x: right, y: 663, size: 11, fill: "#747474", anchor: "end" }),
    svgText("CNPJ: 24.484.228/0001-62", { x: right, y: 681, size: 11, fill: "#747474", anchor: "end" }),
    svgText("Sede: São José dos Campos, São Paulo - Brasil", { x: right, y: 699, size: 11, fill: "#747474", anchor: "end", maxWidth: 320 }),
    svgText("Filial: Pindamonhangaba, São Paulo - Brasil", { x: right, y: 717, size: 11, fill: "#747474", anchor: "end", maxWidth: 320 }),

    image(nlaLogo, MARGIN + 4, 835, colWidth - 18, 78),
    image(logoPreta, MARGIN + colWidth + 4, 820, colWidth - 8, 100),
    image(qrCode, MARGIN + colWidth * 2 + 48, 842, 72, 72),
    svgText("Avalie sua experiência", { x: MARGIN + colWidth * 2 + 84, y: 933, size: 11, weight: 700, fill: "#00398e", anchor: "middle", maxWidth: colWidth - 30 }),
    line(MARGIN + 24, 963, right - 24, "#00398e", 2),

    svgText("Junior de Paula", { x: 76, y: 1001, size: 11, weight: 700 }),
    svgText("Concierge (Bilingual)", { x: 184, y: 1001, size: 11, fill: "#00398e" }),
    svgText("+55 12 99723 6961", { x: 314, y: 1001, size: 11, fill: "#747474" }),
    svgText("junior@betinhos.com.br", { x: 426, y: 1001, size: 11, fill: "#747474" }),
    svgText("Deborah Keila", { x: 76, y: 1022, size: 11, weight: 700 }),
    svgText("Operations Manager", { x: 184, y: 1022, size: 11, fill: "#00398e" }),
    svgText("+55 12 99615 9093", { x: 314, y: 1022, size: 11, fill: "#747474" }),
    svgText("deborah.keila@betinhos.com.br", { x: 426, y: 1022, size: 11, fill: "#747474" }),
    svgText("Juliana Rodrigues", { x: 76, y: 1043, size: 11, weight: 700 }),
    svgText("Finance Manager", { x: 184, y: 1043, size: 11, fill: "#00398e" }),
    svgText("+55 12 99615 9085", { x: 314, y: 1043, size: 11, fill: "#747474" }),
    svgText("financeiro@betinhos.com.br", { x: 426, y: 1043, size: 11, fill: "#747474" }),
    "</svg>"
  ].join("");
}

async function svgToPngBytes(svg: string) {
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const imageElement = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new Image();
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error("Falha ao renderizar recibo para PDF."));
    nextImage.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = SVG_WIDTH * SNAPSHOT_SCALE;
  canvas.height = SVG_HEIGHT * SNAPSHOT_SCALE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas indisponivel para renderizar recibo.");
  context.scale(SNAPSHOT_SCALE, SNAPSHOT_SCALE);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, SVG_WIDTH, SVG_HEIGHT);
  context.drawImage(imageElement, 0, 0, SVG_WIDTH, SVG_HEIGHT);

  const blob = await new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob((nextBlob) => {
        if (nextBlob) resolve(nextBlob);
        else reject(new Error("Falha ao converter recibo em imagem."));
      }, "image/png", 1);
    } catch (error) {
      reject(error);
    }
  });
  return new Uint8Array(await blob.arrayBuffer());
}

export async function generateReceiptPdfBlob(model: PersonalReceiptModel) {
  const svg = await buildReceiptSvg(model);
  const pngBytes = await svgToPngBytes(svg);
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([A4_WIDTH_PT, A4_HEIGHT_PT]);
  const previewImage = await pdfDoc.embedPng(pngBytes);

  page.drawImage(previewImage, {
    x: 0,
    y: 0,
    width: A4_WIDTH_PT,
    height: A4_HEIGHT_PT
  });

  const bytes = await pdfDoc.save();
  const bytesCopy = new Uint8Array(bytes);
  return new Blob([bytesCopy.buffer], { type: "application/pdf" });
}
