import type { Metadata } from "next";
import ContactsHero, { type ContactItem } from "./contacts-hero";
import { Footer } from "@/components/footer";
import { SiteHeader } from "@/components/site-header";
import styles from "./page.module.css";
import { JsonLd } from "@/components/json-ld";
import { contactPageSchema } from "@/lib/seo/schema";
import { buildPageMetadata } from "@/lib/page-seo";

const contacts = [
  { type: "title", label: "Контактная информация" },
  { type: "link", label: "+7 903 147-44-30", href: "tel:+79031474430" },
  { type: "link", label: "rinartburo@mail.ru", href: "mailto:rinartburo@mail.ru" },
  {
    type: "link",
    label: "WhatsApp: rinart_buro",
    href: "https://wa.me/79031474430?text=%D0%97%D0%B4%D1%80%D0%B0%D0%B2%D1%81%D1%82%D0%B2%D1%83%D0%B9%D1%82%D0%B5,%20%D1%85%D0%BE%D1%87%D1%83%20%D0%BE%D0%B1%D1%81%D1%83%D0%B4%D0%B8%D1%82%D1%8C%20%D0%BF%D1%80%D0%BE%D0%B5%D0%BA%D1%82",
  },
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
      <SiteHeader showDesktopNav showDesktopBrand={false} />
      <main className={styles.page}>
        <ContactsHero contacts={contacts} />
      </main>
      <Footer />
      <JsonLd schema={contactPageSchema()} />
    </>
  );
}
