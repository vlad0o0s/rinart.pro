import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Каталог сборки. Раньше `next build` писал прямо в `.next` под работающим приложением:
   * пока шла сборка, сервер не находил своих файлов, падал с «Could not find a production
   * build» и перезапускался — сайт лежал всю сборку, минуту-две на каждый деплой.
   * Теперь деплой собирает в отдельный каталог (scripts/deploy.sh) и подменяет готовый
   * результат одним движением, поэтому простоя во время сборки нет.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",
  /* config options here */
  reactCompiler: true,
  /**
   * Все чанки (JS/CSS) под /chunks: без долгого immutable на CDN — после деплоя не отдаём
   * устаревшие файлы по тому же URL и чаще согласуемся с новым HTML.
   * (Имена с хэшем всё равно меняются; проблема — кеш документа со старыми хэшами.)
   */
  async headers() {
    return [
      {
        source: "/_next/static/chunks/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
      {
        // Заголовки безопасности: раньше не отдавался ни один, из-за чего аудит помечал
        // отсутствие HSTS, защиты от кликджекинга и изоляции источников.
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        // Загруженные картинки не меняются по одному и тому же адресу — имена содержат uuid,
        // поэтому их можно смело держать в кеше браузера долго.
        source: "/uploads/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/img/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000" }],
      },
    ];
  },
  /** Новый id на каждый билд — инвалидация путей с BUILD_ID (_buildManifest и т.д.). */
  generateBuildId: async () => process.env.NEXT_BUILD_ID?.trim() || `build-${Date.now()}`,
  images: {
    qualities: [70, 75],
    /**
     * Ограничиваем набор размеров, которые оптимизатор вправе создавать. По умолчанию Next
     * готов пережимать восемь ширин, а каждая обработка держится в памяти — на машине с
     * 2 ГБ это приводило к падению сервера «heap out of memory» под нагрузкой.
     * Список совпадает с RESPONSIVE_WIDTHS в lib/image-srcset.ts.
     */
    deviceSizes: [384, 640, 1080, 1920],
    imageSizes: [96, 256],
    /** Готовый вариант живёт в кеше месяц, а не сутки: меньше повторных пережатий. */
    minimumCacheTTL: 2592000,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.prod.website-files.com",
      },
      {
        protocol: "https",
        hostname: "rinart.pro",
      },
    ],
  },
};

export default nextConfig;
