import type { Metadata } from "next";
import ContactsHero, { type ContactItem } from "./contacts-hero";
import { Footer } from "@/components/footer";
import { SiteHeader } from "@/components/site-header";
import styles from "./page.module.css";
import { JsonLd } from "@/components/json-ld";
import { contactPageSchema } from "@/lib/seo/schema";
import { buildPageMetadata } from "@/lib/page-seo";
import { RouteReadyAnnouncer } from "@/components/route-ready-announcer";

const contacts = [
  { type: "title", label: "Контактная информация" },
  { type: "link", label: "+7 903 147-44-30", href: "tel:+79031474430" },
  { type: "link", label: "rinartburo@mail.ru", href: "mailto:rinartburo@mail.ru" },
  { type: "link", label: "VK: rinart_buro", href: "https://vk.com/rinart_buro" },
  { type: "link", label: "TG: rinart_buro", href: "https://t.me/rinart_buro" },
  { type: "link", label: "INST: rinart.buro", href: "https://www.instagram.com/rinart.buro/" },
  { type: "plain", label: "Москва, Российская Федерация" },
] satisfies ContactItem[];

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata("kontakty");
}

export default function KontaktyPage() {
  return (
    <>
      <SiteHeader showDesktopNav />
      <main className={styles.page}>
        <ContactsHero contacts={contacts} />
      </main>
      <Footer />
      <JsonLd schema={contactPageSchema()} />
      <RouteReadyAnnouncer />
    </>
  );
}
