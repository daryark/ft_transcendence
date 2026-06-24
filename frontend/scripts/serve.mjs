import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, request as httpRequest } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distDir = join(rootDir, "dist");
const port = Number(process.env.FRONTEND_PORT ?? process.argv[2] ?? 5001);
const backendUrl = new URL(process.env.BACKEND_URL ?? "http://localhost:3000");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function proxy(req, res) {
  const target = new URL(req.url ?? "/", backendUrl);
  const proxyReq = httpRequest(
    target,
    {
      method: req.method,
      headers: req.headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on("error", () => {
    res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Backend proxy failed");
  });

  req.pipe(proxyReq);
}

async function serveFile(req, res) {
  const rawPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
  const safePath = normalize(rawPath).replace(/^(\.\.[/\\])+/, "");
  const requestedPath = join(distDir, safePath);
  const filePath = requestedPath.startsWith(distDir) && existsSync(requestedPath)
    ? requestedPath
    : join(distDir, "index.html");
  const fileStat = await stat(filePath);

  if (fileStat.isDirectory()) {
    return serveIndex(res);
  }

  res.writeHead(200, {
    "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream",
  });
  createReadStream(filePath).pipe(res);
}

function serveIndex(res) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  createReadStream(join(distDir, "index.html")).pipe(res);
}

createServer((req, res) => {
  if (req.url?.startsWith("/api/") || req.url?.startsWith("/socket.io/")) {
    proxy(req, res);
    return;
  }

  serveFile(req, res).catch(() => {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Frontend server failed");
  });
}).listen(port, "0.0.0.0", () => {
  console.log(`Frontend preview listening on http://localhost:${port}`);
});
