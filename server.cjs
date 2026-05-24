/**
 * Обход падения Next 16 в 500 на запросы к уже удалённым чанкам после деплоя
 * (старый HTML → старые URL; next start отдаёт 500 вместо 404).
 * Реальные файлы из .next/static по-прежнему отдаёт Next.
 */
const http = require("http");
const path = require("path");
const fs = require("fs");
const { parse: parseUrl } = require("url");
const next = require("next");

const projectDir = __dirname;
const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);
const staticRoot = path.join(projectDir, ".next", "static");

const app = next({ dev, dir: projectDir, hostname, port });

function resolveUnderStatic(pathname) {
  const prefix = "/_next/static/";
  if (!pathname.startsWith(prefix)) {
    return null;
  }
  const rel = pathname.slice(prefix.length);
  if (!rel || rel.includes("..")) {
    return null;
  }
  const segments = rel.split("/").filter(Boolean);
  const abs = path.resolve(staticRoot, ...segments);
  const rootResolved = path.resolve(staticRoot);
  if (abs !== rootResolved && !abs.startsWith(rootResolved + path.sep)) {
    return null;
  }
  return abs;
}

app.prepare().then(() => {
  const handle = app.getRequestHandler();

  http
    .createServer(async (req, res) => {
      try {
        const pathname = (req.url || "/").split("?")[0] || "/";
        if (pathname.startsWith("/_next/static/")) {
          const abs = resolveUnderStatic(pathname);
          let ok = false;
          if (abs) {
            try {
              const st = fs.statSync(abs);
              ok = st.isFile();
            } catch {
              ok = false;
            }
          }
          if (!ok) {
            res.writeHead(404, {
              "Content-Type": "text/plain; charset=utf-8",
              "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
            });
            res.end("Not Found");
            return;
          }
        }
        await handle(req, res, parseUrl(req.url || "/", true));
      } catch (e) {
        console.error(e);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end("Internal Server Error");
        }
      }
    })
    .listen(port, hostname, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
