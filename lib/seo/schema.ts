import type { ProjectDetail } from "../../types/project";
import { getStaticSeoPage } from "./static-pages";
import { filledOrUndefined, metaDescriptionFrom } from "./text";

export const SITE_URL = "https://rinart.pro";
const BRAND_NAME = "RINART";
const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

const PHONE = "+7-903-147-44-30";
const EMAIL = "rinartburo@mail.ru";
const SAME_AS = [
  "https://vk.ru/rinart_buro",
  "https://t.me/rinart_buro",
  "https://www.instagram.com/rinart.buro/",
];

/**
 * Адрес — как в карточке организации на Яндекс Картах (сверено 19.09.2026).
 * Часов работы здесь нет намеренно: полного графика у нас нет, а выдумывать его нельзя —
 * добавить `openingHoursSpecification`, когда бюро подтвердит часы.
 */
const POSTAL_ADDRESS = {
  "@type": "PostalAddress",
  streetAddress: "городок имени Баумана, 2, стр. 10, офис 5",
  addressLocality: "Москва",
  addressCountry: "RU",
};

/** Где бюро принимает заказы — так же, как написано на странице контактов. */
export const AREA_SERVED = [
  { "@type": "City", name: "Москва" },
  { "@type": "AdministrativeArea", name: "Московская область" },
];

const FOUNDER = {
  "@type": "Person",
  name: "Ринат Гильмутдинов",
  jobTitle: "Архитектор",
  image: `${SITE_URL}/img/team-rinat.webp`,
};

/**
 * Организация внутри другой сущности. Полное описание есть на каждой странице (корневой
 * шаблон), а здесь — имя, адрес сайта и @id, по которому их можно связать.
 */
const ORGANIZATION_REF = {
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  name: BRAND_NAME,
  url: SITE_URL,
};

/** В разметке нужны абсолютные адреса; картинки base64 туда попадать не должны. */
function absoluteUrl(url: string | null | undefined): string | null {
  if (!url || url.startsWith("data:")) {
    return null;
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${SITE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

function organizationEntity() {
  // Логотипа нет намеренно: раньше здесь стоял портрет основателя, а знак бюро ещё не прислали.
  return {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: BRAND_NAME,
    url: SITE_URL,
    email: EMAIL,
    telephone: PHONE,
    address: POSTAL_ADDRESS,
    areaServed: AREA_SERVED,
    founder: FOUNDER,
    sameAs: SAME_AS,
  };
}

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    ...organizationEntity(),
  };
}

export function webSiteSchema() {
  // Поиска по сайту нет, поэтому SearchAction здесь больше нет: разметка обещала роботу
  // адрес поиска, который отдаёт главную страницу.
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: BRAND_NAME,
    url: SITE_URL,
    inLanguage: "ru-RU",
    publisher: ORGANIZATION_REF,
  };
}

export function homePageSchema(projects: Array<{ title: string; slug: string }>) {
  // Название и описание — те же, что в title и description главной, а не отдельные строки.
  const seo = getStaticSeoPage("home")?.defaults;
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: seo?.title ?? BRAND_NAME,
    url: SITE_URL,
    description: seo?.description,
    about: ORGANIZATION_REF,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: projects.map((project, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${SITE_URL}/${project.slug}`,
        name: project.title,
      })),
    },
  };
}

export function projectPageSchema(project: ProjectDetail) {
  const projectUrl = `${SITE_URL}/${project.slug}`;
  const images = [
    ...new Set(
      [project.seo?.ogImage, project.heroImageUrl, ...project.gallery.map((item) => item.url)]
        .map(absoluteUrl)
        .filter((item): item is string => Boolean(item)),
    ),
  ];
  const keywords = project.seo?.keywords?.length ? project.seo.keywords : project.categories;
  const description = filledOrUndefined(project.seo?.description) ?? metaDescriptionFrom(project.descriptionBody);

  return [
    {
      // Кейс портфолио — это произведение бюро. Тип Project в schema.org описывает
      // организацию-проект, поэтому здесь CreativeWork.
      "@context": "https://schema.org",
      "@type": "CreativeWork",
      name: project.title,
      url: projectUrl,
      description,
      image: images.length ? images : undefined,
      keywords: keywords.length ? keywords.join(", ") : undefined,
      inLanguage: "ru-RU",
      creator: ORGANIZATION_REF,
    },
    {
      // Отдельного раздела «Проекты» на сайте нет: портфолио — это главная. Промежуточный
      // пункт «Проекты» вёл на неё же и дублировал первый.
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Главная",
          item: SITE_URL,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: project.title,
          item: projectUrl,
        },
      ],
    },
  ];
}

export function contactPageSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: "Контакты RINART",
    url: `${SITE_URL}/kontakty`,
    description:
      "Контактная информация архитектурного бюро RINART: телефон, почта, адрес офиса, мессенджеры и социальные сети.",
    mainEntity: organizationEntity(),
  };
}

export function masterskajaPageSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "Мастерская RINART",
    url: `${SITE_URL}/masterskaja`,
    description:
      "Команда архитектурной мастерской RINART, публикации и философия бюро. Узнайте, кто создаёт частную архитектуру и дизайн.",
    mainEntity: ORGANIZATION_REF,
  };
}

type ArticleForSchema = {
  slug: string;
  title: string;
  excerpt: string;
  seoDescription: string;
  coverImageUrl: string | null;
  authorName: string;
  authorRole: string;
  publishedAt: string | null;
  contentUpdatedAt: string | null;
};

const ARTICLES_URL = `${SITE_URL}/stati`;

export function articleSchema(article: ArticleForSchema) {
  const url = `${ARTICLES_URL}/${article.slug}`;
  const image = absoluteUrl(article.coverImageUrl);
  const modified =
    article.contentUpdatedAt && (!article.publishedAt || article.contentUpdatedAt > article.publishedAt)
      ? article.contentUpdatedAt
      : article.publishedAt;
  return [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: article.title,
      description: filledOrUndefined(article.seoDescription) ?? filledOrUndefined(article.excerpt),
      url,
      mainEntityOfPage: url,
      image: image ? [image] : undefined,
      datePublished: article.publishedAt ?? undefined,
      dateModified: modified ?? undefined,
      inLanguage: "ru-RU",
      author: article.authorName
        ? { "@type": "Person", name: article.authorName, jobTitle: filledOrUndefined(article.authorRole) }
        : ORGANIZATION_REF,
      publisher: ORGANIZATION_REF,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Главная", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Статьи", item: ARTICLES_URL },
        { "@type": "ListItem", position: 3, name: article.title, item: url },
      ],
    },
  ];
}

export function articlesListSchema(articles: Array<{ slug: string; title: string }>) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Статьи",
      url: ARTICLES_URL,
      about: ORGANIZATION_REF,
      mainEntity: {
        "@type": "ItemList",
        itemListElement: articles.map((article, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `${ARTICLES_URL}/${article.slug}`,
          name: article.title,
        })),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Главная", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Статьи", item: ARTICLES_URL },
      ],
    },
  ];
}

/** Разметка страницы услуги: одна функция на все будущие страницы услуг. */
export function servicePageSchema(service: { name: string; path: string; description?: string; serviceType?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.name,
    serviceType: service.serviceType,
    description: service.description,
    url: `${SITE_URL}${service.path}`,
    provider: ORGANIZATION_REF,
    areaServed: AREA_SERVED,
  };
}

export function proektirovaniePageSchema() {
  return servicePageSchema({
    name: "Проектирование частных домов",
    serviceType: "Архитектурное проектирование",
    path: "/proektirovanie",
  });
}
