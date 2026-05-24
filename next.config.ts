import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    ];
  },
  /** Новый id на каждый билд — инвалидация путей с BUILD_ID (_buildManifest и т.д.). */
  generateBuildId: async () => process.env.NEXT_BUILD_ID?.trim() || `build-${Date.now()}`,
  images: {
    qualities: [70, 75],
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
