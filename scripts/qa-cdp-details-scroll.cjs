const cdpPort = process.env.CDP_PORT || "9224";
const appPort = process.env.APP_PORT || "5183";
const viewportHeight = Number(process.env.VIEWPORT_HEIGHT || "844");

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
  const { ws, send } = await connect();
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: viewportHeight,
    deviceScaleFactor: 1,
    mobile: true
  });

  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Runtime exception");
    return result.result.value;
  };

  await send("Page.navigate", { url: `http://127.0.0.1:${appPort}/?servicoId=10241&tipo=SERVICO` });
  await sleep(1500);

  const result = await evaluate(`(() => {
    const scroll = document.querySelector('.details-scroll-v1');
    const fields = document.querySelector('.details-fields-v1');
    const card = document.querySelector('.details-card-v1');
    const hint = document.querySelector('.details-scroll-hint');
    return {
      scrollHeight: scroll?.scrollHeight ?? null,
      clientHeight: scroll?.clientHeight ?? null,
      fieldsScrollHeight: fields?.scrollHeight ?? null,
      fieldsRectHeight: fields?.getBoundingClientRect().height ?? null,
      fieldCount: document.querySelectorAll('.detail-field').length,
      scrollTop: scroll?.scrollTop ?? null,
      remaining: scroll ? Math.ceil(scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight) : null,
      cardClass: card?.className ?? '',
      hintExists: Boolean(hint),
      hintDisplay: hint ? getComputedStyle(hint).display : null,
      hintTextVisible: document.body.innerText.includes('Mais detalhes abaixo')
    };
  })()`);

  const bottomResult = await evaluate(`(() => {
    const scroll = document.querySelector('.details-scroll-v1');
    if (!scroll) return { bottomRemaining: null, bottomHintExists: false };
    scroll.scrollTop = scroll.scrollHeight;
    scroll.dispatchEvent(new Event('scroll', { bubbles: true }));
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        const card = document.querySelector('.details-card-v1');
        const hint = document.querySelector('.details-scroll-hint');
        resolve({
          bottomRemaining: Math.ceil(scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight),
          bottomCardClass: card?.className ?? '',
          bottomHintExists: Boolean(hint)
        });
      });
    });
  })()`);

  ws.close();
  console.log(JSON.stringify({
    ok: result.remaining > 16 && result.cardClass.includes("is-scrollable") && result.hintExists && result.hintDisplay !== "none" && !bottomResult.bottomHintExists,
    ...result,
    ...bottomResult
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
