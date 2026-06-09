const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const root = process.cwd();
const distDir = path.join(root, "dist");
const preferredPort = Number(process.env.PORT || 5173);
const host = "127.0.0.1";
let building = false;
let pending = false;

function build() {
  if (building) {
    pending = true;
    return;
  }

  building = true;
  const child = spawn(process.execPath, [path.join(root, "scripts", "build-react-singlefile.cjs"), "--no-version"], {
    cwd: root,
    stdio: "inherit"
  });

  child.on("exit", (code) => {
    building = false;
    if (code === 0) {
      console.log("[dev] build atualizado");
    } else {
      console.log(`[dev] build falhou: ${code}`);
    }
    if (pending) {
      pending = false;
      build();
    }
  });
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  return "text/plain; charset=utf-8";
}

function serveFile(request, response) {
  const requestedPath = request.url === "/" ? "index.html" : request.url.replace(/^\//, "");
  const filePath = path.join(distDir, requestedPath);

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("not found");
      return;
    }

    response.writeHead(200, { "Content-Type": contentType(filePath) });
    response.end(data);
  });
}

function watchDirectory(relativePath) {
  const directory = path.join(root, relativePath);
  if (!fs.existsSync(directory)) return;

  fs.watch(directory, { recursive: true }, (eventType, fileName) => {
    if (!fileName || fileName.includes("~")) return;
    console.log(`[dev] mudança detectada: ${relativePath}\\${fileName}`);
    build();
  });
}

build();
watchDirectory("src");
watchDirectory("extracted-msapp\\Assets\\Images");

function listen(port) {
  const server = http.createServer(serveFile);

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.log(`[dev] porta ${port} ocupada; tentando ${port + 1}`);
      listen(port + 1);
      return;
    }
    throw error;
  });

  server.listen(port, host, () => {
    console.log(`[dev] http://${host}:${port}`);
    console.log("[dev] edite src/*; recarregue o navegador");
  });
}

listen(preferredPort);
