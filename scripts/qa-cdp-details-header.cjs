const fs = require("fs");
const path = require("path");

const cdpPort = process.env.CDP_PORT || "9224";
const appPort = process.env.APP_PORT || "5184";
const outDir = path.join(process.env.TEMP || process.cwd(), "app-motoristas-qa-details-header");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connect() {
  const targets = await fetch(`http://127.0.0.1:${cdpPort}/json/list`).then((response) => response.json());
  const target = targets.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
  if (!target) throw new Error(`Target page not found on DevTools port ${cdpPort}.`);

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  let id = 0;

  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
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

  return { ws, send };
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const { ws, send } = await connect();
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });

  await send("Page.navigate", { url: `http://127.0.0.1:${appPort}/?servicoId=10241&tipo=SERVICO` });
  await sleep(1800);

  const result = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const filePath = path.join(outDir, "details-header.png");
  fs.writeFileSync(filePath, Buffer.from(result.data, "base64"));
  ws.close();
  console.log(filePath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
