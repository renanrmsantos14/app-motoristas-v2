type XrmOpenFile = (
  file: { fileContent: string; fileName: string; fileSize: number; mimeType: string },
  options?: { openMode?: 1 | 2 }
) => Promise<void> | void;

type XrmOpenUrl = (url: string, options?: { height?: number; width?: number }) => Promise<void> | void;

type XrmNavigation = {
  openFile?: XrmOpenFile;
  openUrl?: XrmOpenUrl;
};

export type ReceiptPdfActionOutcome = {
  message: string;
  tone: "info" | "success" | "warning";
  confirmed: boolean;
};

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? "");
      resolve(value.includes(",") ? value.split(",")[1] ?? "" : value);
    };
    reader.onerror = () => reject(new Error("Falha ao preparar o PDF do recibo."));
    reader.readAsDataURL(blob);
  });
}

function getWindowNavigation(target: Window | null | undefined): XrmNavigation | undefined {
  try {
    return (target as (Window & { Xrm?: { Navigation?: XrmNavigation } }) | null | undefined)?.Xrm?.Navigation;
  } catch {
    return undefined;
  }
}

function getXrmNavigation(): XrmNavigation | undefined {
  const candidates = [
    window,
    window.parent,
    window.top,
    window.opener as Window | null
  ];

  for (const candidate of candidates) {
    const navigation = getWindowNavigation(candidate);
    if (navigation?.openFile || navigation?.openUrl) return navigation;
  }

  return undefined;
}

async function tryOpenFile(blob: Blob, fileName: string, openMode: 1 | 2) {
  const openFile = getXrmNavigation()?.openFile;
  if (!openFile) return false;

  try {
    await openFile(
      {
        fileContent: await blobToBase64(blob),
        fileName,
        fileSize: Math.ceil(blob.size / 1024),
        mimeType: "application/pdf"
      },
      { openMode }
    );
    return true;
  } catch {
    return false;
  }
}

async function tryOpenDataUrl(blob: Blob) {
  const openUrl = getXrmNavigation()?.openUrl;
  if (!openUrl) return false;

  try {
    await openUrl(`data:application/pdf;base64,${await blobToBase64(blob)}`);
    return true;
  } catch {
    return false;
  }
}

function requestBrowserDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export async function saveReceiptPdf(blob: Blob, fileName: string) {
  if (await tryOpenFile(blob, fileName, 2)) {
    return {
      message: "Power Apps recebeu o PDF para salvar. Confirme no visualizador do sistema.",
      tone: "info",
      confirmed: false
    } satisfies ReceiptPdfActionOutcome;
  }

  if (await tryOpenFile(blob, fileName, 1)) {
    return {
      message: "PDF aberto pelo Power Apps. Salve pelo visualizador.",
      tone: "info",
      confirmed: false
    } satisfies ReceiptPdfActionOutcome;
  }

  if (await tryOpenDataUrl(blob)) {
    return {
      message: "PDF aberto fora do WebView. Salve pelo navegador.",
      tone: "info",
      confirmed: false
    } satisfies ReceiptPdfActionOutcome;
  }

  requestBrowserDownload(blob, fileName);
  return {
    message: "Download solicitado ao navegador. Nao foi possivel confirmar arquivo salvo.",
    tone: "warning",
    confirmed: false
  } satisfies ReceiptPdfActionOutcome;
}

export async function shareReceiptPdf(blob: Blob, fileName: string) {
  if (await tryOpenFile(blob, fileName, 1)) {
    return {
      message: "PDF aberto pelo Power Apps. Compartilhe pelo visualizador.",
      tone: "info",
      confirmed: false
    } satisfies ReceiptPdfActionOutcome;
  }

  const file = new File([blob], fileName, { type: "application/pdf" });
  if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    await navigator.share({
      files: [file],
      title: "Recibo Betinhos",
      text: "Recibo Betinhos em PDF"
    });
    return {
      message: "Compartilhamento nativo concluido pelo navegador.",
      tone: "success",
      confirmed: true
    } satisfies ReceiptPdfActionOutcome;
  }

  if (await tryOpenFile(blob, fileName, 2)) {
    return {
      message: "Power Apps recebeu o PDF para salvar. Compartilhe pelo arquivo se ele aparecer no dispositivo.",
      tone: "info",
      confirmed: false
    } satisfies ReceiptPdfActionOutcome;
  }

  if (await tryOpenDataUrl(blob)) {
    return {
      message: "PDF aberto fora do WebView. Compartilhe pelo navegador.",
      tone: "info",
      confirmed: false
    } satisfies ReceiptPdfActionOutcome;
  }

  throw new Error("Nao consegui abrir o PDF para compartilhar neste WebView. O Power Apps nao expos Xrm.Navigation.openFile/openUrl e o navegador nao expos compartilhamento nativo.");
}
