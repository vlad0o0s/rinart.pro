import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Снижает риск отдачи устаревшего HTML с хэшами чанков от предыдущего билда
 * (иначе браузер запрашивает уже удалённые `/_next/static/chunks/*` → 500/ошибки).
 * Статика `/_next/static` и прочие исключения не трогаем.
 */
export function middleware(_request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set(
    "Cache-Control",
    "private, no-cache, no-store, max-age=0, must-revalidate",
  );
  // Часть CDN (в т.ч. Cloudflare) смотрит отдельно от Cache-Control
  response.headers.set("CDN-Cache-Control", "private, no-store, max-age=0, must-revalidate");
  response.headers.set("Surrogate-Control", "no-store");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set(
    "Vary",
    "RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch, Accept-Encoding",
  );
  return response;
}

export const config = {
  matcher: [
    "/",
    // Весь /_next/* (static, data, image, webpack-hmr и т.д.) — без middleware
    "/((?!_next/|api/|uploads/|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)",
  ],
};
