const fs = require("fs");
const path = require("path");

const root = process.cwd();

function read(relPath, maxChars = 12000) {
  const abs = path.isAbsolute(relPath) ? relPath : path.join(root, relPath);
  const text = fs.readFileSync(abs, "utf8");
  return text.slice(0, maxChars);
}

function list(dir) {
  const abs = path.join(root, dir);
  return fs.readdirSync(abs).sort();
}

function printSection(title, body) {
  process.stdout.write(`\n=== ${title} ===\n`);
  process.stdout.write(body);
  process.stdout.write(`\n`);
}

printSection("SRC FILES", list("extracted-msapp/Src").join("\n"));
printSection(
  "USING-SUPERPOWERS SKILL",
  read("C:/Users/mendo/.codex/plugins/cache/openai-curated/superpowers/bd80d7d9/skills/using-superpowers/SKILL.md", 8000)
);
printSection(
  "FRONTEND-APP-BUILDER SKILL",
  read("C:/Users/mendo/.codex/plugins/cache/openai-curated/build-web-apps/bd80d7d9/skills/frontend-app-builder/SKILL.md", 8000)
);
printSection("HEADER", read("extracted-msapp/Header.json", 4000));
printSection("PROPERTIES", read("extracted-msapp/Properties.json", 10000));
printSection("APP YAML", read("extracted-msapp/Src/App.pa.yaml", 12000));
printSection("TELA INICIAL YAML", read("extracted-msapp/Src/TelaInicial.pa.yaml", 12000));
printSection("TELA SERVICOS YAML", read("extracted-msapp/Src/TelaServiços.pa.yaml", 12000));
