import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { PageTransition } from "@/components/page-transition";
import { YandexMetrika } from "@/components/yandex-metrika";
import { CookieBanner } from "@/components/cookie-banner";
import { AttributionCapture } from "@/components/attribution-capture";
import { JsonLd } from "@/components/json-ld";
import { isBotUserAgent } from "@/lib/is-bot";
import { organizationSchema, webSiteSchema } from "@/lib/seo/schema";
import { getGlobalBlocks } from "@/lib/global-blocks";
import { CONSENT_COOKIE_NAME, isAnalyticsAllowed, parseConsent } from "@/lib/cookie-consent";

/** Явно: без статического кеша оболочки на CDN — иначе после деплоя остаются старые ссылки на чанки (.js/.css). */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const neueHaasUnica = localFont({
  variable: "--font-neue-haas",
  display: "swap",
  src: [
    {
      path: "../public/fonts/neuehaasunica-light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../public/fonts/neuehaasunica-regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/neuehaasunica-medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/fonts/neuehaasunica-bold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../public/fonts/neuehaasunica-black.woff2",
      weight: "900",
      style: "normal",
    },
  ],
});

export const metadata: Metadata = {
  title: "Архитектор Ринат Гильмутдинов — RINART",
  description:
    "Архитектурное бюро RINART: частные дома, арт-объекты, дизайн интерьеров и мастерская архитектора Рината Гильмутдинова в Москве.",
  metadataBase: new URL("https://rinart.pro"),
  // Ни canonical, ни og:url здесь не задаются: их наследовали страницы без своих значений —
  // политика конфиденциальности и все 404 указывали на главную как на свой основной адрес.
  // Каждая индексируемая страница задаёт их сама.
  openGraph: {
    title: "Архитектор Ринат Гильмутдинов — RINART",
    description:
      "Проектирование частных домов и интерьеров, арт-объекты и мастерская архитектора Рината Гильмутдинова в Москве.",
    siteName: "RINART",
    locale: "ru_RU",
    type: "website",
  },
  // Коды подтверждения Яндекс Вебмастера и Google Search Console берутся из .env
  // (YANDEX_VERIFICATION, GOOGLE_SITE_VERIFICATION): пока переменная не задана, тега нет.
  verification: {
    ...(process.env.YANDEX_VERIFICATION ? { yandex: process.env.YANDEX_VERIFICATION } : {}),
    ...(process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : {}),
    other: {
      "zen-verification": "81wapJfK78Sa5rJ98tOeBeMYIQHxazRrkULzKnpfAkw2PEpSuvhxlTZ1hsOLwKLR",
    },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const userAgent = headersList.get("user-agent") ?? "";
  const isBot = isBotUserAgent(userAgent);
  // Выбор посетителя о файлах куки. Сервер читает его из запроса и передаёт счётчику и баннеру:
  // у тех, кому аналитика разрешена, счётчик запускается сразу после загрузки страницы,
  // а разметка сервера и браузера совпадает. Сам код счётчика в HTML не попадает — его вставляет браузер.
  const cookieConsent = parseConsent((await cookies()).get(CONSENT_COOKIE_NAME)?.value);
  const blocks = await getGlobalBlocks();
  // Логотип заставки — только файл с самого сайта. Запасной адрес в старых настройках ведёт
  // на зарубежный сервер: браузер каждого посетителя обращался бы к нему с любой страницы,
  // а политика обработки данных обещает, что за границу данные не передаются.
  const transitionImage = blocks["page-transition"]?.imageUrl;
  const transitionImageUrl =
    transitionImage && transitionImage.startsWith("/") && !transitionImage.startsWith("//") ? transitionImage : undefined;

  return (
    <html lang="ru" data-scroll-behavior="auto">
      <head>
        <noscript>
          {/* Без JavaScript анимацию заставки некому довести до конца, и занавес
              остался бы поверх страницы навсегда. Скрываем его сразу. */}
          <style>{`[data-preload-curtain]{display:none !important}`}</style>
        </noscript>
      </head>
      <body className={`${neueHaasUnica.variable} antialiased`} suppressHydrationWarning>
        <Script
          id="disable-scroll-restoration"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined' && 'scrollRestoration' in history) {
                history.scrollRestoration = 'manual';
              }
            `,
          }}
        />
        <YandexMetrika initialConsent={cookieConsent} />
        <AttributionCapture />
        {/* Пиксель для браузеров без JavaScript — только там, где аналитика разрешена. */}
        {isAnalyticsAllowed(cookieConsent) ? (
          <noscript>
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://mc.yandex.ru/watch/105099236"
                style={{ position: "absolute", left: "-9999px" }}
                alt=""
              />
            </div>
          </noscript>
        ) : null}
        <div className="site-shell">
          <PageTransition
            enabled={!isBot}
            logoUrl={transitionImageUrl}
          />
          <JsonLd schema={[organizationSchema(), webSiteSchema()]} />
          {children}
        </div>
        {/* Баннер показывается всем: от него зависит запуск счётчика, а определение робота
            по названию браузера ошибается и на людях. В HTML от сервера баннера нет. */}
        <CookieBanner initialConsent={cookieConsent} />
      </body>
    </html>
  );
}
