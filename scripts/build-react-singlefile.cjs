const fs = require("fs");
const path = require("path");

async function run() {
  const esbuild = require("esbuild");
  const root = process.cwd();
  const distDir = path.join(root, "dist");
  const packagePath = path.join(root, "package.json");
  const packageLockPath = path.join(root, "package-lock.json");
  const shouldBumpVersion = !process.argv.includes("--no-version");

  function bumpPatchVersion(version) {
    const parts = String(version).split(".").map((part) => Number(part));
    if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part) || part < 0)) {
      throw new Error(`Versao invalida no package.json: ${version}`);
    }

    parts[2] += 1;
    return parts.join(".");
  }

  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const buildVersion = shouldBumpVersion ? bumpPatchVersion(packageJson.version) : packageJson.version;

  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });

  const result = await esbuild.build({
    entryPoints: [path.join(root, "src", "main.tsx")],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    write: false,
    loader: {
      ".png": "dataurl",
      ".jpg": "dataurl",
      ".jpeg": "dataurl",
      ".svg": "dataurl",
    },
  });

  const js = result.outputFiles[0].text;
  const css = fs.readFileSync(path.join(root, "src", "styles.css"), "utf8");
  if (shouldBumpVersion) {
    packageJson.version = buildVersion;
    fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
  }

  if (shouldBumpVersion && fs.existsSync(packageLockPath)) {
    const packageLock = JSON.parse(fs.readFileSync(packageLockPath, "utf8"));
    packageLock.version = buildVersion;
    if (packageLock.packages?.[""]) {
      packageLock.packages[""].version = buildVersion;
    }
    fs.writeFileSync(packageLockPath, `${JSON.stringify(packageLock, null, 2)}\n`, "utf8");
  }

  const flowEnv = JSON.stringify({
    VITE_FLOW_GERAR_VOUCHER_URL: process.env.VITE_FLOW_GERAR_VOUCHER_URL ?? "",
    VITE_FLOW_SALVAR_FOTOS_MANUTENCAO_URL: process.env.VITE_FLOW_SALVAR_FOTOS_MANUTENCAO_URL ?? ""
  }).replace(/</g, "\\u003c");
  const builtAt = new Date();
  const buildInfo = JSON.stringify({
    version: buildVersion,
    builtAt: builtAt.toISOString(),
    builtAtLabel: builtAt.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }).replace(/</g, "\\u003c");

  const initScript = `<script>window.__APP_FLOW_ENV=${flowEnv};window.__APP_BUILD_INFO=${buildInfo};</script>`;

  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>App Betinhos Motoristas</title>
    <style>${css}</style>
  </head>
  <body>
    <div id="root"></div>
    ${initScript}
    <script>${js}</script>
  </body>
  </html>`;

  fs.writeFileSync(path.join(distDir, "webresource-app-motoristas.html"), html, "utf8");
  fs.writeFileSync(path.join(distDir, "index.html"), html, "utf8");
  console.log(`Build concluído: dist/webresource-app-motoristas.html | versão ${buildVersion}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
