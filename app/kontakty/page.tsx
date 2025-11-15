import type { Metadata } from "next";
import ContactsHero from "./contacts-hero";
import { Footer } from "@/components/footer";
import { SiteHeader } from "@/components/site-header";
import styles from "./page.module.css";
import { JsonLd } from "@/components/json-ld";
import { contactPageSchema } from "@/lib/seo/schema";
import { buildPageMetadata } from "@/lib/page-seo";
import { RouteReadyAnnouncer } from "@/components/route-ready-announcer";
import { getContactSettings, getSocialLinks } from "@/lib/site-settings";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata("kontakty");
}

export default async function KontaktyPage() {
  const [contactSettings, socialLinks] = await Promise.all([getContactSettings(), getSocialLinks()]);

  return (
    <>
      <SiteHeader showDesktopNav socialLinks={socialLinks} />
      <main className={styles.page}>
        <ContactsHero contact={contactSettings} socials={socialLinks} />
      </main>
      <Footer />
      <JsonLd schema={contactPageSchema()} />
      <RouteReadyAnnouncer />
    </>
  );
}
