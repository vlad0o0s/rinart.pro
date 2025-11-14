export type StaticSeoPage = {
  slug: string;
  label: string;
  path: string;
  defaults: {
    title?: string;
    description?: string;
    keywords?: string[];
    ogImageUrl?: string | null;
  };
};

export const STATIC_SEO_PAGES: StaticSeoPage[] = [
  {
    slug: "home",
    label: "Главная",
    path: "/",
    defaults: {
      title: "Архитектор Ринат Гильмутдинов — RINART",
      description:
        "Архитектурное бюро RINART: частные дома, арт-объекты, дизайн интерьеров и мастерская архитектора Рината Гильмутдинова в Москве.",
      keywords: [
        "архитектор ринат гильмутдинов",
        "rinart",
        "архитектурное бюро",
        "частные дома",
        "дизайн интерьеров",
      ],
      ogImageUrl: null,
    },
  },
  {
    slug: "masterskaja",
    label: "Мастерская",
    path: "/masterskaja",
    defaults: {
      title: "Мастерская — RINART",
      description:
        "Команда архитектурной мастерской RINART: философия работы, состав команды и публикации. Узнайте, кто создаёт частную архитектуру и дизайн.",
      keywords: ["мастерская rinart", "команда rinart", "архитектурная мастерская"],
      ogImageUrl: null,
    },
  },
  {
    slug: "proektirovanie",
    label: "Проектирование",
    path: "/proektirovanie",
    defaults: {
      title: "Проектирование — RINART",
      description:
        "Проектирование частных домов и сопровождающих объектов. Подробная информация о процессах и стоимости услуг архитектурного бюро RINART.",
      keywords: ["проектирование домов", "услуги rinart", "архитектурное проектирование"],
      ogImageUrl: null,
    },
  },
  {
    slug: "kontakty",
    label: "Контакты",
    path: "/kontakty",
    defaults: {
      title: "Контакты — RINART",
      description:
        "Контактная информация архитектурного бюро RINART: телефон, почта, WhatsApp, Telegram и социальные сети. Москва, Россия.",
      keywords: ["контакты rinart", "архитектор контакт", "rinart buro"],
      ogImageUrl: null,
    },
  },
];

export function getStaticSeoPage(slug: string): StaticSeoPage | undefined {
  return STATIC_SEO_PAGES.find((page) => page.slug === slug);
}


