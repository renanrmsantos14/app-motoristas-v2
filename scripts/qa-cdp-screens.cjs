const fs = require("fs");
const path = require("path");

const cdpPort = process.env.CDP_PORT || "9223";
const outDir = path.join(process.env.TEMP || process.cwd(), "app-motoristas-qa-extra");

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

  async function navigate(url) {
    await send("Page.navigate", { url });
    await sleep(900);
  }

  async function clearStorage() {
    await evaluate("localStorage.clear(); sessionStorage.clear(); true");
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
    await sleep(700);
  }

  async function screenshot(name) {
    const result = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const filePath = path.join(outDir, `${name}.png`);
    fs.writeFileSync(filePath, Buffer.from(result.data, "base64"));
    return filePath;
  }

  const shots = {};

  await navigate("http://127.0.0.1:5174/?servicoId=10241&tipo=SERVICO");
  await clearStorage();
  await navigate("http://127.0.0.1:5174/?servicoId=10241&tipo=SERVICO");
  await waitForText("Detalhes do Serviço");
  await clickText("Finalizar");
  await waitForText("Digite abaixo sua observação");
  shots.finalizeService = await screenshot("01-finalize-service");

  await navigate("http://127.0.0.1:5174/?servicoId=10241&tipo=SERVICO");
  await waitForText("Detalhes do Serviço");
  await clickText("Cancelar no local");
  await sleep(250);
  await clickText("Cancelar no local");
  await waitForText("Detalhes do Cancelamento");
  shots.cancelLocal = await screenshot("02-cancel-local");

  await navigate("http://127.0.0.1:5174/?servicoId=10241&tipo=SERVICO");
  await waitForText("Detalhes do Serviço");
  await clickText("Voucher");
  await waitForText("Voucher - 10241");
  await clickText("Assinar");
  await waitForText("Assinatura do Passageiro");
  shots.signature = await screenshot("03-signature");

  await navigate("http://127.0.0.1:5174/?servicoId=76&tipo=MANUTENCAO");
  await waitForText("Detalhes da Manutenção");
  await clickText("Finalizar");
  await waitForText("Detalhes da Manutenção");
  shots.finalizeMaintenance = await screenshot("04-finalize-maintenance");
  await clickText("Adicionar foto");
  await waitForText("Tire a foto da nota fiscal");
  shots.photo = await screenshot("05-photo");

  await navigate("http://127.0.0.1:5174/");
  await waitForText("Renan");
  await clickText("Histórico");
  await waitForText("HISTÓRICO");
  await evaluate(`document.querySelector(".agenda-card:not(.header) .agenda-hit")?.click(); true`);
  await waitForText("Detalhes do Serviço");
  shots.historyDetail = await screenshot("06-history-detail");

  const appErrors = events.filter((event) => event.method === "Runtime.exceptionThrown");
  ws.close();

  console.log(JSON.stringify({
    ok: appErrors.length === 0,
    exceptionCount: appErrors.length,
    screenshots: shots
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
