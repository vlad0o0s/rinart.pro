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
const { resolveLegacyRedirect } = require("./legacy-redirects.cjs");

const projectDir = __dirname;
const dev = process.env.NODE_ENV !== "production";
// Слушаем только петлю: снаружи приложение должно быть доступно исключительно через nginx.
// Раньше здесь было "0.0.0.0", и http://<ip>:3000 отвечал напрямую в обход TLS,
// редиректа на https, канонизации домена и правил отдачи /uploads.
const hostname = process.env.HOSTNAME || "127.0.0.1";
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
        // Старые адреса отвечаем сами, до Next: иначе адрес со слешем на конце получил бы
        // сначала 308 от Next и только потом наш редирект — два перехода вместо одного.
        if (req.method === "GET" || req.method === "HEAD") {
          const legacyTarget = resolveLegacyRedirect(req.url || "/");
          if (legacyTarget) {
            res.writeHead(301, {
              Location: legacyTarget,
              "Content-Type": "text/plain; charset=utf-8",
              // Постоянный редирект браузеры кешируют бессрочно; час оставляет возможность
              // поправить соответствие, если оно окажется неверным.
              "Cache-Control": "public, max-age=3600",
            });
            res.end(req.method === "HEAD" ? undefined : `Moved Permanently: ${legacyTarget}\n`);
            return;
          }
        }
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
