/*
  frontend-proxy-server.mjs

  Lightweight server for integration CI that:
  - serves the frontend app shell at '/'
  - proxies '/api/*' traffic to the backend

  This avoids installing/running the full React dev server in CI.
*/

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..", "..");

const PORT = Number(process.env.FRONTEND_PORT ?? 3000);
const BACKEND_BASE_URL = process.env.BACKEND_PROXY ?? "http://localhost:8080";

function getIndexCandidates() {
  return [
    path.join(ROOT, "frontend", "build", "index.html"),
    path.join(ROOT, "frontend", "public", "index.html")
  ];
}

async function loadAppShell() {
  for (const candidate of getIndexCandidates()) {
    try {
      const html = await readFile(candidate, "utf8");
      return html;
    } catch {
      // Try next candidate path.
    }
  }

  return "<!doctype html><html><body><div id=\"root\"></div></body></html>";
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function copyResponseHeaders(sourceHeaders, res) {
  for (const [key, value] of sourceHeaders.entries()) {
    if (key.toLowerCase() === "transfer-encoding") {
      continue;
    }
    res.setHeader(key, value);
  }
}

async function main() {
  const appShellHtml = await loadAppShell();

  const server = createServer(async (req, res) => {
    try {
      const method = req.method ?? "GET";
      const incomingUrl = req.url ?? "/";

      if (incomingUrl.startsWith("/api/")) {
        const targetUrl = new URL(incomingUrl, BACKEND_BASE_URL).toString();
        const body = method === "GET" || method === "HEAD" ? undefined : await readRequestBody(req);

        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) {
          if (!value) {
            continue;
          }
          const lower = key.toLowerCase();
          if (lower === "host" || lower === "connection") {
            continue;
          }

          if (Array.isArray(value)) {
            for (const v of value) {
              headers.append(key, v);
            }
          } else {
            headers.set(key, String(value));
          }
        }

        const backendRes = await fetch(targetUrl, {
          method,
          headers,
          body
        });

        res.statusCode = backendRes.status;
        copyResponseHeaders(backendRes.headers, res);

        const bytes = Buffer.from(await backendRes.arrayBuffer());
        res.end(bytes);
        return;
      }

      if (incomingUrl === "/" || incomingUrl.startsWith("/?")) {
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(appShellHtml);
        return;
      }

      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Not Found");
    } catch (error) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end(`Proxy server error: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  server.listen(PORT, () => {
    console.log(`[ready] frontend proxy server on http://localhost:${PORT}`);
    console.log(`[proxy] /api -> ${BACKEND_BASE_URL}`);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
