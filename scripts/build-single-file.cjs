const fs = require("fs");
const path = require("path");

const root = process.cwd();
const srcDir = path.join(root, "src");
const distDir = path.join(root, "dist");

function read(fileName) {
  return fs.readFileSync(path.join(srcDir, fileName), "utf8");
}

function inlineCss(html, css) {
  return html.replace(
    /<link rel="stylesheet" href="\.\/styles\.css" \/>/,
    `<style>\n${css}\n</style>`
  );
}

function inlineScripts(html, scripts) {
  return html.replace(
    /<script src="\.\/data\.js"><\/script>\s*<script src="\.\/state\.js"><\/script>\s*<script src="\.\/components\.js"><\/script>\s*<script src="\.\/app\.js"><\/script>/,
    `<script>\n${scripts.join("\n\n")}\n</script>`
  );
}

function build() {
  const html = read("index.html");
  const css = read("styles.css");
  const scripts = ["data.js", "state.js", "components.js", "app.js"].map(read);

  const bundled = inlineScripts(inlineCss(html, css), scripts);

  fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(path.join(distDir, "app-motoristas.html"), bundled, "utf8");
  fs.writeFileSync(path.join(distDir, "index.html"), bundled, "utf8");

  console.log("Build concluído: dist/app-motoristas.html");
}

build();
