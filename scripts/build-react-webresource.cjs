const path = require("path");
const fs = require("fs");

async function run() {
  const { build } = await import("vite");
  const root = process.cwd();

  await build({
    root,
    logLevel: "info",
    plugins: [],
    build: {
      target: "es2020",
      assetsInlineLimit: 100000000,
      cssCodeSplit: false,
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: undefined,
        },
      },
    },
  });

  const distDir = path.join(root, "dist");
  const htmlPath = path.join(distDir, "index.html");
  let html = fs.readFileSync(htmlPath, "utf8");

  html = html.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/, (_, src) => {
    const jsPath = path.join(distDir, src.replace(/^\//, ""));
    const js = fs.readFileSync(jsPath, "utf8");
    return `<script>${js}</script>`;
  });

  html = html.replace(/<link rel="stylesheet" crossorigin href="([^"]+)">/, (_, href) => {
    const cssPath = path.join(distDir, href.replace(/^\//, ""));
    const css = fs.readFileSync(cssPath, "utf8");
    return `<style>${css}</style>`;
  });

  fs.writeFileSync(path.join(distDir, "webresource-app-motoristas.html"), html, "utf8");
  console.log("Build concluído: dist/webresource-app-motoristas.html");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
