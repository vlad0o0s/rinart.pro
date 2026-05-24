import type { ReactNode } from "react";
import { getContactSettings, getSocialLinks } from "@/lib/site-settings";
import type { ContactSettings, SocialLink, SocialPlatform } from "@/types/site";
import styles from "./footer.module.css";

const ICON_CLASS_MAP: Partial<Record<SocialPlatform, keyof typeof styles>> = {
  instagram: "iconInstagram",
  telegram: "iconTelegram",
  vk: "iconVk",
  pinterest: "iconPinterest",
};

type FooterSectionProps = {
  contact: ContactSettings;
  socials: SocialLink[];
};

export async function Footer() {
  const [contact, socials] = await Promise.all([getContactSettings(), getSocialLinks()]);
  return (
    <>
      <FooterDesktop contact={contact} socials={socials} />
      <FooterMobile contact={contact} socials={socials} />
    </>
  );
}

function FooterDesktop({ contact, socials }: FooterSectionProps) {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.row}>
          <div className={styles.column}>
            <p className={styles.contactTitle}>{contact.footerTitle}</p>
            <a className={styles.ctaButton} href={contact.whatsappUrl} target="_blank" rel="noopener noreferrer">
              {contact.whatsappLabel} <span>→</span>
            </a>
          </div>

          <div className={`${styles.column} ${styles.columnCenter}`}>
            <span className={styles.city}>{contact.cityLabel}</span>
            <a className={`${styles.phone} ${styles.linkUnderline}`} href={contact.phoneHref}>
              {contact.phoneLabel}
            </a>
          </div>

          <div className={`${styles.column} ${styles.columnRight}`}>
            <div className={styles.socials}>
              {renderFooterSocialLinks(socials, contact)}
            </div>
          </div>

          <div className={styles.backToTopWrapper}>
            <a className={`${styles.backToTop} ${styles.linkUnderline}`} href="#">
              {contact.backToTopLabel}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterMobile({ contact, socials }: FooterSectionProps) {
  return (
    <footer className={styles.footerMobile}>
      <div className={styles.footerMobileInner}>
        <div className={styles.footerMobileColumns}>
          <div className={styles.footerMobileColumnLeft}>
            <p className={styles.contactTitle}>{contact.footerTitle}</p>
            <a className={styles.footerMobileButton} href={contact.whatsappUrl} target="_blank" rel="noopener noreferrer">
              {contact.whatsappLabel} <span>→</span>
            </a>
          </div>
          <div className={styles.footerMobileColumnRight}>
            <a className={`${styles.backToTop} ${styles.footerMobileBack}`} href="#">
              {contact.backToTopLabel}
            </a>
            <div className={styles.footerMobileSocials}>
              {renderFooterSocialLinks(socials, contact, "mobile-")}
            </div>
            <div className={styles.footerMobileLocation}>
              <span>{contact.cityLabel}</span>
              <a className={styles.phone} href={contact.phoneHref}>
                {contact.phoneLabel}
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function getIconClass(platform: SocialPlatform) {
  const key = ICON_CLASS_MAP[platform];
  return key ? styles[key] : null;
}

/** Соцсети из настроек; иконка MAX — канал (`maxChannelUrl`), не кнопка CTA. */
function renderFooterSocialLinks(socials: SocialLink[], contact: ContactSettings, keyPrefix = "") {
  const nodes: ReactNode[] = [];
  let maxInserted = false;
  const maxAria =
    contact.maxChannelLabel.trim().length > 0
      ? `Max: ${contact.maxChannelLabel.trim()}`
      : "MAX";

  for (const social of socials) {
    const iconClass = getIconClass(social.platform);
    if (iconClass) {
      nodes.push(
        <a
          key={`${keyPrefix}${social.id}`}
          className={styles.socialLink}
          href={social.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={social.label}
        >
          <span className={`${styles.icon} ${iconClass}`} />
        </a>,
      );
    }
    if (social.platform === "pinterest" && contact.maxChannelUrl) {
      nodes.push(
        <a
          key={`${keyPrefix}max-messenger`}
          className={styles.socialLink}
          href={contact.maxChannelUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={maxAria}
        >
          <span className={`${styles.icon} ${styles.iconMax}`} />
        </a>,
      );
      maxInserted = true;
    }
  }

  if (!maxInserted && contact.maxChannelUrl) {
    nodes.push(
      <a
        key={`${keyPrefix}max-messenger`}
        className={styles.socialLink}
        href={contact.maxChannelUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={maxAria}
      >
        <span className={`${styles.icon} ${styles.iconMax}`} />
      </a>,
    );
  }

  return nodes;
}

