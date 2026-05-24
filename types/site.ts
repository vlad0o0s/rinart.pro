export type SocialPlatform = "instagram" | "telegram" | "vk" | "pinterest" | "behance" | "youtube";

export type SocialLink = {
  id: string;
  platform: SocialPlatform;
  label: string;
  url: string;
};

export type ContactSettings = {
  heroTitle: string;
  phoneLabel: string;
  phoneHref: string;
  emailLabel: string;
  emailHref: string;
  locationLabel: string;
  heroImageUrl: string | null;
  footerTitle: string;
  cityLabel: string;
  whatsappLabel: string;
  /** Ссылка кнопки «Перейти в MAX» в подвале (личный профиль / чат). */
  whatsappUrl: string;
  /** Канал MAX: иконка в подвале и строка на странице контактов. */
  maxChannelUrl: string;
  /** Текст после «Max: » на странице контактов (например rinartburo). */
  maxChannelLabel: string;
  backToTopLabel: string;
};

export type TeamMember = {
  id: number;
  name: string;
  role: string | null;
  label: string | null;
  imageUrl: string | null;
  mobileImageUrl: string | null;
  isFeatured: boolean;
  order: number;
};

export type AppearanceSettings = {
  homeHeroImageUrl: string;
  transitionImageUrl: string;
};

