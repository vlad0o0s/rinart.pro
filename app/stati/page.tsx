import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/footer";
import { JsonLd } from "@/components/json-ld";
import { RouteReadyAnnouncer } from "@/components/route-ready-announcer";
import { SiteHeader } from "@/components/site-header";
import { getPublishedArticles } from "@/lib/article-repository";
import { ARTICLES_LABEL, ARTICLES_PATH, formatArticleDate } from "@/lib/articles";
import { getMainNavLinks } from "@/lib/navigation";
import { articlesListSchema, SITE_URL } from "@/lib/seo/schema";
import { getSocialLinks } from "@/lib/site-settings";
import styles from "./stati.module.css";

export const dynamic = "force-dynamic";

const TITLE = "Статьи об архитектуре и проектировании домов — RINART";
const DESCRIPTION =
  "Статьи архитектурного бюро RINART: как проектируют частные и загородные дома, из чего складывается проект, интерьеры и реконструкция.";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = `${SITE_URL}${ARTICLES_PATH}`;
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical },
    openGraph: { title: TITLE, description: DESCRIPTION, url: canonical, siteName: "RINART", locale: "ru_RU", type: "website" },
  };
}

export default async function ArticlesPage() {
  const [articles, socialLinks, navLinks] = await Promise.all([getPublishedArticles(), getSocialLinks(), getMainNavLinks()]);

  // Пока не опубликовано ни одной статьи, раздела нет: ни в меню, ни по прямой ссылке.
  if (!articles.length) {
    notFound();
  }

  return (
    <>
      <SiteHeader showDesktopNav socialLinks={socialLinks} navLinks={navLinks} breadcrumbLabel={ARTICLES_LABEL} />
      <main className={styles.page}>
        <header className={styles.listHeader}>
          <h1 className={styles.listTitle}>{ARTICLES_LABEL}</h1>
        </header>
        <ul className={styles.cards}>
          {articles.map((article) => (
            <li key={article.id} className={styles.card}>
              <Link href={`${ARTICLES_PATH}/${article.slug}`} className={styles.cardLink}>
                {article.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={article.coverImageUrl} alt={article.title} loading="lazy" decoding="async" className={styles.cardImage} />
                ) : null}
                {article.publishedAt ? (
                  <time className={styles.cardDate} dateTime={article.publishedAt}>
                    {formatArticleDate(article.publishedAt)}
                  </time>
                ) : null}
                <h2 className={styles.cardTitle}>{article.title}</h2>
                {article.excerpt ? <p className={styles.cardExcerpt}>{article.excerpt}</p> : null}
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <Footer />
      <JsonLd schema={articlesListSchema(articles)} />
      <RouteReadyAnnouncer />
    </>
  );
}
