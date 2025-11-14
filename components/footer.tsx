import styles from "./footer.module.css";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.row}>
          <div className={styles.column}>
            <p className={styles.contactTitle}>Обсудим ваш проект:</p>
            <a
              className={styles.ctaButton}
              href="https://wa.me/79031474430"
              target="_blank"
              rel="noopener noreferrer"
            >
              Написать в WhatsApp <span>→</span>
            </a>
          </div>

          <div className={`${styles.column} ${styles.columnCenter}`}>
            <span className={styles.city}>г. Москва</span>
            <a className={`${styles.phone} ${styles.linkUnderline}`} href="tel:+79031474430">
              +7 903 147-44-30
            </a>
          </div>

          <div className={`${styles.column} ${styles.columnRight}`}>
            <div className={styles.socials}>
              <a
                className={styles.socialLink}
                href="https://www.instagram.com/rinart.buro/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram RINART"
              >
                <span className={`${styles.icon} ${styles.iconInstagram}`} />
              </a>
              <a
                className={styles.socialLink}
                href="https://t.me/rinart_buro"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Telegram RINART"
              >
                <span className={`${styles.icon} ${styles.iconTelegram}`} />
              </a>
              <a
                className={styles.socialLink}
                href="https://vk.com/rinart_buro"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="VK RINART"
              >
                <span className={`${styles.icon} ${styles.iconVk}`} />
              </a>
            </div>
          </div>

          <div className={styles.backToTopWrapper}>
            <a className={`${styles.backToTop} ${styles.linkUnderline}`} href="#">
              В начало
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

