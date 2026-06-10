const fs = require("fs");
const path = require("path");
const { openBrowser } = require("@remotion/renderer");

const root = process.cwd();
const outDir = path.join(root, "public", "screens");
const baseUrl = process.env.APP_MOTORISTAS_URL || "http://127.0.0.1:5174";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForText(page, text) {
  const lower = text.toLowerCase();
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const found = await page.evaluate((needle) => document.body.innerText.toLowerCase().includes(needle), lower);
    if (found) return;
    await sleep(100);
  }
  const body = await page.evaluate(() => document.body.innerText.slice(0, 1000));
  throw new Error(`Text not found: ${text}. Body: ${JSON.stringify(body)}`);
}

async function clickText(page, text) {
  const clicked = await page.evaluate((needle) => {
    const groups = [
      [...document.querySelectorAll("button, [role='button']")],
      [...document.querySelectorAll(".agenda-hit, .agenda-card")],
      [...document.querySelectorAll("[class*='card']")]
    ];
    const target = groups.flat().find((element) => element.innerText.trim().toLowerCase().includes(needle.toLowerCase()));
    if (!target) return false;
    target.click();
    return true;
  }, text);
  if (!clicked) {
    const texts = await page.evaluate(() => [...document.querySelectorAll("button, [role='button'], .agenda-hit, .agenda-card, [class*='card']")]
      .map((element) => element.innerText.trim())
      .filter(Boolean)
      .slice(0, 30));
    throw new Error(`Clickable text not found: ${text}. Candidates: ${JSON.stringify(texts)}`);
  }
  await sleep(750);
}

async function shot(page, name) {
  const result = await page._client().send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false
  });
  const data = result.data ?? result.result?.data ?? result.value?.data;
  if (!data) throw new Error(`Page.captureScreenshot returned no data: ${JSON.stringify(result).slice(0, 300)}`);
  const filePath = path.join(outDir, `${name}.png`);
  fs.writeFileSync(filePath, Buffer.from(data, "base64"));
  return filePath;
}

async function navigate(page, url) {
  await page.goto({ url, timeout: 30000 });
  await sleep(900);
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await openBrowser("chrome", {
    browserExecutable: null,
    chromiumOptions: {},
    forceDeviceScaleFactor: 1,
    logLevel: "warn"
  });

  const page = await browser.newPage({
    context: null,
    logLevel: "warn",
    indent: false,
    pageIndex: 0,
    onBrowserLog: null,
    onLog: () => undefined
  });

  await page.setViewport({
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true
  });

  const shots = {};
  try {
    await navigate(page, `${baseUrl}/`);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      return true;
    });
    await navigate(page, `${baseUrl}/`);
    await waitForText(page, "Renan");
    shots.home = await shot(page, "01-home");

    await clickText(page, "Serviços");
    await waitForText(page, "HOJE");
    shots.services = await shot(page, "02-services");

    await navigate(page, `${baseUrl}/?servicoId=10241&tipo=SERVICO`);
    await waitForText(page, "Detalhes");
    shots.details = await shot(page, "03-details");

    await clickText(page, "Voucher");
    await waitForText(page, "Inicial");
    shots.voucher = await shot(page, "04-voucher");

    await clickText(page, "Assinar");
    await waitForText(page, "Assinatura do Passageiro");
    shots.signature = await shot(page, "05-signature");

    await navigate(page, `${baseUrl}/?servicoId=76&tipo=MANUTENCAO`);
    await waitForText(page, "Detalhes da Manutenção");
    shots.maintenance = await shot(page, "06-maintenance");

    await clickText(page, "Finalizar");
    await waitForText(page, "MANUTENÇÃO REALIZADA");
    shots.finalizeMaintenance = await shot(page, "07-finalize-maintenance");

    await navigate(page, `${baseUrl}/`);
    await waitForText(page, "Renan");
    await clickText(page, "Gastos");
    await waitForText(page, "Registrar gasto");
    shots.expenses = await shot(page, "08-expenses");
  } finally {
    await browser.close({ silent: true });
  }

  const manifest = {
    capturedAt: new Date().toISOString(),
    sourceUrl: baseUrl,
    viewport: { width: 390, height: 844 },
    shots
  };
  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
