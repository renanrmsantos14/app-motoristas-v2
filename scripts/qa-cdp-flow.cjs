const fs = require("fs");
const path = require("path");

const cdpPort = process.env.CDP_PORT || "9223";
const CDP_LIST_URL = `http://127.0.0.1:${cdpPort}/json/list`;
const outDir = path.join(process.env.TEMP || process.cwd(), "app-motoristas-qa");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connect() {
  const targets = await fetch(CDP_LIST_URL).then((response) => response.json());
  const target = targets.find((item) => item.type === "page" && item.url.includes("127.0.0.1:5174"));
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
      return;
    }
    events.push(message);
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
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  await send("Page.navigate", { url: "http://127.0.0.1:5174/" });
  await sleep(900);

  async function evaluate(expression) {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || "Runtime exception");
    }
    return result.result.value;
  }

  async function waitForText(text) {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const found = await evaluate(`document.body.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())})`);
      if (found) return;
      await sleep(100);
    }
    throw new Error(`Text not found: ${text}`);
  }

  async function clickText(text) {
    const clicked = await evaluate(`
      (() => {
        const target = [...document.querySelectorAll("button")]
          .find((button) => button.innerText.trim().toLowerCase().includes(${JSON.stringify(text.toLowerCase())}));
        if (!target) return false;
        target.click();
        return true;
      })()
    `);
    if (!clicked) throw new Error(`Button not found: ${text}`);
    await sleep(650);
  }

  async function screenshot(name) {
    const result = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const filePath = path.join(outDir, `${name}.png`);
    fs.writeFileSync(filePath, Buffer.from(result.data, "base64"));
    return filePath;
  }

  await evaluate("localStorage.clear(); sessionStorage.clear(); true");
  await send("Page.navigate", { url: "http://127.0.0.1:5174/" });
  await sleep(900);

  await waitForText("Renan");
  const home = await screenshot("01-home");

  await clickText("Serviços");
  await waitForText("Seus Serviços");
  const services = await screenshot("02-services");

  const openedCard = await evaluate(`
    (() => {
      const target = document.querySelector(".agenda-card:not(.header) .agenda-hit");
      if (!target) return false;
      target.click();
      return true;
    })()
  `);
  if (!openedCard) throw new Error("No service card found.");
  await waitForText("Detalhes do Serviço");
  const detail = await screenshot("03-detail");

  await clickText("Voucher");
  await waitForText("Voucher - 10241");
  const voucher = await screenshot("04-voucher");

  await evaluate(`
    (() => {
      function setValue(el, value) {
        const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value").set;
        setter.call(el, value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
      setValue(document.querySelector('select[aria-label="horario-inicial hora"]'), "14");
      setValue(document.querySelector('select[aria-label="horario-inicial minuto"]'), "30");
      const numbers = [...document.querySelectorAll('input[type="number"]')];
      setValue(numbers[0], "10");
      setValue(numbers[1], "20");
      return true;
    })()
  `);
  await clickText("Finalizar");
  await waitForText("HISTÓRICO");
  const history = await screenshot("05-history-after-finalize");

  const text = await evaluate("document.body.innerText");
  const appErrors = events.filter((event) => event.method === "Runtime.exceptionThrown");
  ws.close();

  console.log(JSON.stringify({
    ok: appErrors.length === 0,
    exceptionCount: appErrors.length,
    containsHistory: text.includes("HISTÓRICO"),
    screenshots: { home, services, detail, voucher, history }
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
