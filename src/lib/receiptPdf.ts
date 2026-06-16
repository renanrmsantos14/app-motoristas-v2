import { PDFDocument } from "pdf-lib";
import logoBetinhosBUrl from "../../Logo Betinhos B.png";
import logoBetinhosPretaUrl from "../../Logo Betinhos Preta.png";
import nlaLogoUrl from "../../NLA.jpg";
import qrCodeAvaliacaoUrl from "../../QrCode-Avaliação.png";
import type { PersonalReceiptModel } from "./personalReceipt";
import { buildReceiptSvgDataUrlFromMarkup, buildReceiptSvgMarkup, RECEIPT_SVG_HEIGHT, RECEIPT_SVG_WIDTH } from "./receiptSvg";

const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const SNAPSHOT_SCALE = 2;
const bytesCache = new Map<string, Promise<string>>();

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

export async function buildReceiptSvg(model: PersonalReceiptModel) {
  const [logoB, logoPreta, nlaLogo, qrCode] = await Promise.all([
    urlToDataUrl(logoBetinhosBUrl),
    urlToDataUrl(logoBetinhosPretaUrl),
    urlToDataUrl(nlaLogoUrl),
    urlToDataUrl(qrCodeAvaliacaoUrl)
  ]);

  return buildReceiptSvgMarkup(model, {
    logoB,
    logoPreta,
    nlaLogo,
    qrCode
  });
}

export async function buildReceiptSvgDataUrl(model: PersonalReceiptModel) {
  return buildReceiptSvgDataUrlFromMarkup(await buildReceiptSvg(model));
}

async function svgToPngBytes(svg: string) {
  const dataUrl = buildReceiptSvgDataUrlFromMarkup(svg);
  const imageElement = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new Image();
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error("Falha ao renderizar recibo para PDF."));
    nextImage.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = RECEIPT_SVG_WIDTH * SNAPSHOT_SCALE;
  canvas.height = RECEIPT_SVG_HEIGHT * SNAPSHOT_SCALE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas indisponivel para renderizar recibo.");
  context.scale(SNAPSHOT_SCALE, SNAPSHOT_SCALE);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, RECEIPT_SVG_WIDTH, RECEIPT_SVG_HEIGHT);
  context.drawImage(imageElement, 0, 0, RECEIPT_SVG_WIDTH, RECEIPT_SVG_HEIGHT);

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
