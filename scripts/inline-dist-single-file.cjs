const fs = require("fs");
const path = require("path");

const distDir = path.join(process.cwd(), "dist");
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
