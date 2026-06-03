const fs = require("fs");
const http = require("http");
const path = require("path");

const root = path.join(process.cwd(), "dist");
const port = Number(process.env.PORT || 5173);

const server = http.createServer((request, response) => {
  const parsedUrl = new URL(request.url || "/", "http://127.0.0.1");
  const pathname = parsedUrl.pathname === "/" ? "/index.html" : parsedUrl.pathname;
  const urlPath = pathname.replace(/^\//, "");
  const filePath = path.join(root, urlPath);

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": filePath.endsWith(".html") ? "text/html; charset=utf-8" : "text/plain"
    });
    response.end(data);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`http://127.0.0.1:${port}`);
});
