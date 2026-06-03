const fs = require("fs");
const path = require("path");

async function run() {
  const esbuild = require("esbuild");
  const root = process.cwd();
  const distDir = path.join(root, "dist");

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
    <script>${js}</script>
  </body>
  </html>`;

  fs.writeFileSync(path.join(distDir, "webresource-app-motoristas.html"), html, "utf8");
  fs.writeFileSync(path.join(distDir, "index.html"), html, "utf8");
  console.log("Build concluído: dist/webresource-app-motoristas.html");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
