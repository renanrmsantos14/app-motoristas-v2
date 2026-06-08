const fs = require("fs");
const path = require("path");

const cdpPort = process.env.CDP_PORT || "9224";
const appPort = process.env.APP_PORT || "5182";
const outDir = path.join(process.env.TEMP || process.cwd(), "app-motoristas-qa-signature");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connect() {
  const targets = await fetch(`http://127.0.0.1:${cdpPort}/json/list`).then((response) => response.json());
  const target = targets.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
  if (!target) throw new Error(`Target page not found on DevTools port ${cdpPort}.`);

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  const events = [];
  let id = 0;

  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    } else {
      events.push(message);
    }
  });

  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const nextId = ++id;
      pending.set(nextId, (message) => {
        if (message.error) reject(new Error(`${method}: ${JSON.stringify(message.error)}`));
        else resolve(message.result);
      });
      ws.send(JSON.stringify({ id: nextId, method, params }));
    });

  return { ws, send, events };
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const { ws, send, events } = await connect();

  await send("Runtime.enable");
  await send("Page.enable");
  await send("Input.setIgnoreInputEvents", { ignore: false });
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });

  async function evaluate(expression) {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Runtime exception");
    return result.result.value;
  }

  async function screenshot(name) {
    const result = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const filePath = path.join(outDir, `${name}.png`);
    fs.writeFileSync(filePath, Buffer.from(result.data, "base64"));
    return filePath;
  }

  async function waitFor(predicateSource, label) {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      if (await evaluate(predicateSource)) return;
      await sleep(100);
    }
    throw new Error(`Timeout: ${label}`);
  }

  await send("Page.navigate", { url: `http://127.0.0.1:${appPort}/?servicoId=10241&tipo=SERVICO` });
  await sleep(900);
  await evaluate("localStorage.clear(); sessionStorage.clear(); true");
  await send("Page.navigate", { url: `http://127.0.0.1:${appPort}/?servicoId=10241&tipo=SERVICO` });
  await waitFor("document.body.innerText.includes('Detalhes')", "details");
  await evaluate("document.querySelector('.detail-action.voucher')?.click(); true");
  await sleep(800);
  await waitFor("document.querySelector('.voucher-card') !== null", "voucher");
  const voucherDebug = await evaluate(`(() => ({
    text: document.body.innerText.slice(0, 800),
    buttons: [...document.querySelectorAll('button')].map((button) => ({
      text: button.innerText,
      className: button.className
    }))
  }))()`);
  if (!voucherDebug.buttons.some((button) => String(button.className).includes("voucher-sign"))) {
    console.log(JSON.stringify({ voucherDebug }, null, 2));
  }
  await evaluate("document.querySelector('.voucher-sign')?.click(); true");
  await waitFor("document.querySelector('.signature-pad') !== null", "signature pad");

  const rect = await evaluate(`(() => {
    const rect = document.querySelector('.signature-pad').getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  })()`);

  const x1 = Math.round(rect.left + rect.width * 0.18);
  const y1 = Math.round(rect.top + rect.height * 0.55);
  const x2 = Math.round(rect.left + rect.width * 0.72);
  const y2 = Math.round(rect.top + rect.height * 0.42);
  const dotX = Math.round(rect.left + rect.width * 0.82);
  const dotY = Math.round(rect.top + rect.height * 0.32);

  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x1, y: y1, radiusX: 2, radiusY: 2 }] });
  await send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x2, y: y2, radiusX: 2, radiusY: 2 }] });
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: dotX, y: dotY, radiusX: 2, radiusY: 2 }] });
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(250);

  const signed = await evaluate("document.body.innerText.includes('Assinatura capturada')");
  const signatureRotateExists = await evaluate("Boolean(document.querySelector('.signature-rotate'))");
  const signatureShot = await screenshot("01-signature-drawn");

  const appErrors = events.filter((event) => event.method === "Runtime.exceptionThrown");
  ws.close();

  console.log(JSON.stringify({
    ok: signed && !signatureRotateExists && appErrors.length === 0,
    signed,
    signatureRotateExists,
    exceptionCount: appErrors.length,
    screenshots: { signatureShot }
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
