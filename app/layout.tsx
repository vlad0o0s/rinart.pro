import type { Metadata } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { PageTransition } from "@/components/page-transition";
import { JsonLd } from "@/components/json-ld";
import { isBotUserAgent } from "@/lib/is-bot";
import { organizationSchema, webSiteSchema } from "@/lib/seo/schema";
import { getAppearanceSettings } from "@/lib/site-settings";

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
  openGraph: {
    title: "Архитектор Ринат Гильмутдинов — RINART",
    description:
      "Проектирование частных домов и интерьеров, арт-объекты и мастерская архитектора Рината Гильмутдинова в Москве.",
    url: "https://rinart.pro",
    siteName: "RINART",
    locale: "ru_RU",
    type: "website",
  },
  alternates: {
    canonical: "https://rinart.pro",
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
  const appearanceSettings = await getAppearanceSettings();

  return (
    <html lang="ru" data-scroll-behavior="auto">
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
        <Script id="yandex-metrika" strategy="afterInteractive">
          {`
            (function(m,e,t,r,i,k,a){
              m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
              m[i].l=1*new Date();
              for (var j = 0; j < document.scripts.length; j++) {
                if (document.scripts[j].src === r) {
                  return;
                }
              }
              k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
            })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=105324096', 'ym');

            ym(105324096, 'init', { ssr: true, webvisor: true, clickmap: true, ecommerce: "dataLayer", accurateTrackBounce: true, trackLinks: true });
          `}
        </Script>
        <noscript>
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://mc.yandex.ru/watch/105324096"
              style={{ position: "absolute", left: "-9999px" }}
              alt=""
            />
          </div>
        </noscript>
        <div className="site-shell">
          <PageTransition
            enabled={!isBot}
            logoUrl={appearanceSettings.transitionImageUrl}
          />
          <JsonLd schema={[organizationSchema(), webSiteSchema()]} />
          {children}
        </div>
      </body>
    </html>
  );
}
