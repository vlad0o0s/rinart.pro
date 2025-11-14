import type { Metadata } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import "./globals.css";
import { PageTransition } from "@/components/page-transition";
import { JsonLd } from "@/components/json-ld";
import { isBotUserAgent } from "@/lib/is-bot";
import { organizationSchema, webSiteSchema } from "@/lib/seo/schema";
import { RouteReadyAnnouncer } from "@/components/route-ready-announcer";

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

  return (
    <html lang="ru" data-scroll-behavior="smooth">
      <body className={`${neueHaasUnica.variable} antialiased`}>
        <div className="site-shell">
          <PageTransition enabled={!isBot} />
          <RouteReadyAnnouncer />
          <JsonLd schema={[organizationSchema(), webSiteSchema()]} />
          {children}
        </div>
      </body>
    </html>
  );
}
