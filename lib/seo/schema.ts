import type { ProjectDetail } from "@/types/project";

export const SITE_URL = "https://rinart.pro";
const BRAND_NAME = "RINART";
const LOGO_URL = `${SITE_URL}/img/team-rinat.webp`;

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND_NAME,
    url: SITE_URL,
    logo: LOGO_URL,
    email: "rinartburo@mail.ru",
    telephone: "+7-903-147-44-30",
    sameAs: [
      "https://vk.com/rinart_buro",
      "https://t.me/rinart_buro",
      "https://www.instagram.com/rinart.buro/",
    ],
    address: {
      "@type": "PostalAddress",
      addressLocality: "Москва",
      addressCountry: "RU",
    },
  };
}

export function webSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BRAND_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function homePageSchema(projects: Array<{ title: string; slug: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Архитектор Ринат Гильмутдинов — RINART",
    url: SITE_URL,
    description:
      "Архитектурное бюро RINART — проектирование частных домов, интерьеров и арт-объектов. Работает архитектор Ринат Гильмутдинов.",
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
    project.seo?.ogImage,
    project.heroImageUrl,
    ...project.gallery.map((item) => item.url),
  ].filter((item): item is string => typeof item === "string" && item.length > 0);
  const keywords = project.seo?.keywords?.length ? project.seo.keywords : project.categories;
  const description =
    project.seo?.description ??
    project.descriptionBody.find((paragraph) => paragraph && paragraph.trim().length > 0) ??
    undefined;

  return [
    {
      "@context": "https://schema.org",
      "@type": "Project",
      name: project.title,
      url: projectUrl,
      description,
      image: images,
      keywords: keywords.length ? keywords.join(", ") : undefined,
      creator: {
        "@type": "Organization",
        name: BRAND_NAME,
        url: SITE_URL,
      },
    },
    {
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
          name: "Проекты",
          item: `${SITE_URL}/`,
        },
        {
          "@type": "ListItem",
          position: 3,
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
      "Контактная информация архитектурного бюро RINART: телефон, почта, мессенджеры и социальные сети.",
    mainEntity: {
      "@type": "Organization",
      name: BRAND_NAME,
      url: SITE_URL,
      telephone: "+7-903-147-44-30",
      email: "rinartburo@mail.ru",
      sameAs: [
        "https://vk.com/rinart_buro",
        "https://t.me/rinart_buro",
        "https://www.instagram.com/rinart.buro/",
      ],
      address: {
        "@type": "PostalAddress",
        addressLocality: "Москва",
        addressCountry: "RU",
      },
    },
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
    mainEntity: {
      "@type": "Organization",
      name: BRAND_NAME,
      url: SITE_URL,
    },
  };
}

export function proektirovaniePageSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Проектирование частных домов",
    url: `${SITE_URL}/proektirovanie`,
    provider: {
      "@type": "Organization",
      name: BRAND_NAME,
      url: SITE_URL,
    },
    areaServed: {
      "@type": "Country",
      name: "Россия",
    },
  };
}

